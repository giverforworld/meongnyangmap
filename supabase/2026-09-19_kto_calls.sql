-- 공사 API 호출 카운터 — 날짜 × 오퍼레이션별로 몇 번 불렀나.
-- 공공데이터포털 마이페이지에는 호출 통계 화면이 없다(한도만 보인다). 배치(GitHub Actions)·
-- Vercel 서버·로컬 개발이 같은 인증키를 쓰므로, 한도 대조는 우리가 직접 세는 수밖에 없다.
-- lib/kto.ts 의 call() 이 호출마다 메모리에 모아 두고 kto_count() 로 한 번에 더한다.
-- 날짜는 KST 기준 — 포털 한도가 자정(KST)에 초기화된다.
-- Supabase SQL Editor 에서 그대로 실행. 여러 번 실행해도 안전하다.

create table if not exists public.kto_calls (
  day date    not null,
  op  text    not null,             -- 'KorPetTourService2/detailPetTour2' 꼴
  n   integer not null default 0,
  primary key (day, op)
);

-- service_role 만 쓴다. 정책이 없으므로 anon/authenticated 는 읽지도 쓰지도 못한다
alter table public.kto_calls enable row level security;

-- {"KorPetTourService2/detailPetTour2": 4, "GoCamping/basedList": 1} 을 받아 해당 날짜 행에 더한다
create or replace function public.kto_count(p_day date, p_counts jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.kto_calls (day, op, n)
  select p_day, key, value::integer from jsonb_each_text(p_counts)
  on conflict (day, op) do update set n = kto_calls.n + excluded.n;
$$;

revoke execute on function public.kto_count(date, jsonb) from public, anon, authenticated;

comment on table public.kto_calls is '한국관광공사 OpenAPI 일별·오퍼레이션별 호출 수 (KST). lib/kto.ts 가 채운다';

-- 최근 10일 조회:
--   select day, op, n from public.kto_calls where day >= current_date - 10 order by day desc, n desc;
-- 일별 합계:
--   select day, sum(n) from public.kto_calls where day >= current_date - 10 group by day order by day desc;
