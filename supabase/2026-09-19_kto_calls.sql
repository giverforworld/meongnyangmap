-- 공사 API 호출 기록 — 호출 1건 = 행 1개.
-- 공공데이터포털 마이페이지에는 호출 통계 화면이 없다(한도만 보인다). 배치(GitHub Actions)·
-- Vercel 서버·로컬 개발이 같은 인증키를 쓰므로, 한도 대조는 우리가 직접 세는 수밖에 없다.
-- lib/kto.ts 의 call() 이 호출마다 한 행을 남긴다 (서버는 즉시, 배치는 모아서).
-- Supabase SQL Editor 에서 그대로 실행. 여러 번 실행해도 안전하다 — 쌓인 기록은 지우지 않는다.
--
-- 이전 버전(날짜×오퍼레이션 합계 표 kto_calls(day, op, n) + kto_count RPC)만 지운다.
-- 그 표는 2026-09-19 하루치 합계뿐이었고, 지금 표와 컬럼이 달라 그대로 못 쓴다.
-- 포털에 호출 통계가 없어 이 표가 유일한 누적 기록이다 — 새 스키마의 표는 절대 drop 하지 않는다.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'kto_calls' and column_name = 'n'
  ) then
    drop table public.kto_calls;
  end if;
end $$;
drop function if exists public.kto_count(date, jsonb);

create table if not exists public.kto_calls (
  id       bigint generated always as identity primary key,
  at       timestamptz not null,                 -- 호출 시각 (UTC 저장, 아래 at_kst 가 사람용)
  at_kst   text not null,                        -- '2026-09-19 05:07:31' — 트리거가 채운다. 포털 한도가 KST 자정에 초기화
  source   text not null,                        -- batch(GitHub Actions) · server(Vercel) · local(개발 PC)
  service  text not null,                        -- KorPetTourService2 · GoCamping · DataLabService · TatsCnctrRateService
  op       text not null,                        -- detailPetTour2 …
  op_name  text not null,                        -- '반려동물 동반여행 조회' — 포털 활용신청 상세기능 이름
  rows     integer not null default 0,           -- 응답 items 건수. 오류면 0
  ok       boolean not null default true,
  error    text,                                 -- ok=false 일 때 사유 (한도 초과·인증 실패·네트워크)
  ms       integer                               -- 응답까지 걸린 시간
);

create index if not exists kto_calls_at_idx on public.kto_calls (at desc);
create index if not exists kto_calls_op_at_idx on public.kto_calls (op, at desc);

-- service_role 만 쓴다. 정책이 없으므로 anon/authenticated 는 읽지도 쓰지도 못한다
alter table public.kto_calls enable row level security;

-- at_kst 는 클라이언트가 안 보내도 at 에서 만든다. 생성 컬럼으로 못 하는 이유:
-- timezone() 이 immutable 이 아니라서(시간대 DB 가 바뀔 수 있음) generated column 에 못 쓴다
create or replace function public.kto_calls_fill_kst()
returns trigger
language plpgsql
as $$
begin
  new.at_kst := to_char(new.at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS');
  return new;
end $$;

drop trigger if exists kto_calls_fill_kst on public.kto_calls;
create trigger kto_calls_fill_kst
  before insert or update of at on public.kto_calls
  for each row execute function public.kto_calls_fill_kst();

-- 날짜(KST)×오퍼레이션 합계 — npm run kto:stats 가 읽는다.
-- 원본 표를 그대로 읽으면 전량 재수집 날 1만 행이라 PostgREST 1,000행 상한에 걸린다
create or replace view public.kto_daily
with (security_invoker = false) as
select
  (at at time zone 'Asia/Seoul')::date as day,
  source,
  service,
  op,
  op_name,
  count(*)::integer                     as calls,
  count(*) filter (where not ok)::integer as failed,
  sum(rows)::integer                    as rows
from public.kto_calls
group by 1, 2, 3, 4, 5;

revoke all on public.kto_daily from anon, authenticated;

comment on table public.kto_calls is '한국관광공사 OpenAPI 호출 기록. 호출 1건 = 1행. lib/kto.ts 가 채운다';
comment on view  public.kto_daily is 'kto_calls 를 KST 날짜×출처×오퍼레이션으로 합친 것. npm run kto:stats 가 읽는다';

-- 최근 호출 100건:
--   select at_kst, source, op_name, op, rows, ok, ms from kto_calls order by at desc limit 100;
-- 최근 10일 일별 합계:
--   select day, sum(calls) calls, sum(rows) rows from kto_daily where day >= current_date - 10 group by day order by day desc;
-- 오늘 오퍼레이션별:
--   select * from kto_daily where day = (now() at time zone 'Asia/Seoul')::date order by calls desc;
