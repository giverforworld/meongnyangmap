-- 멍냥맵 — 한국관광공사 반려동물 동반여행 API 적재 스키마
--
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 실행하면 된다.
-- 데이터를 뜯어보며 인사이트를 찾는 게 목적이라, 정규화한 컬럼과 함께
-- **원본 응답(raw jsonb)을 통째로** 보관한다. 정규화 컬럼만 두면 나중에
-- "이 필드 뭐였지"를 확인할 방법이 없어진다.

-- ─────────────────────────────────────────────────────────────
-- ① 장소 목록 — petTourSyncList2 (전국 9,691건, 1콜)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.places (
  contentid       text primary key,
  contenttypeid   text not null,
  cat             text,                    -- 관광지·숙박·음식점 …
  title           text not null,
  addr1           text,
  mapx            double precision,        -- 경도
  mapy            double precision,        -- 위도
  firstimage      text,
  lcls_systm1     text,                    -- 분류체계 1depth (NA, SH …)
  lcls_systm2     text,                    -- 2depth
  lcls_systm3     text,                    -- 3depth (SH040300 = 사후면세점)
  regn_cd         text,                    -- 법정동 시도
  signgu_cd       text,                    -- 법정동 시군구
  createdtime     text,
  modifiedtime    text,
  showflag        text,
  raw             jsonb not null,
  synced_at       timestamptz not null default now()
);

create index if not exists places_type_idx on public.places (contenttypeid);
create index if not exists places_regn_idx on public.places (regn_cd, signgu_cd);
create index if not exists places_lcls_idx on public.places (lcls_systm2);
create index if not exists places_title_idx on public.places using gin (to_tsvector('simple', title));

comment on table public.places is '전국 반려동물 동반여행지 목록. petTourSyncList2 1콜로 전량 수집';
comment on column public.places.lcls_systm3 is 'SH040300 = 사후면세점(택스리펀 가맹점). 쇼핑 8,647건의 대부분';

-- ─────────────────────────────────────────────────────────────
-- ② 동반 조건 — detailPetTour2 (장소당 1콜). 이 서비스의 핵심
-- ─────────────────────────────────────────────────────────────
create table if not exists public.pet_rules (
  contentid            text primary key references public.places (contentid) on delete cascade,
  -- 원본 9필드 (전부 자연어)
  acmpy_type_cd        text,   -- 동반구분: 전구역 / 일부구역
  acmpy_psbl_cpam      text,   -- 동반가능동물: 148종의 자유 텍스트
  acmpy_need_mtr       text,   -- 필요사항: 쉼표로 구조화됨
  etc_acmpy_info       text,   -- 기타: 개행 없이 '- '로 이어지기도
  rela_poses_fclty     text,
  rela_frnsh_prdlst    text,
  rela_purc_prdlst     text,
  rela_rntl_prdlst     text,
  rela_acdnt_risk_mtr  text,
  -- parseRules 가 뽑아낸 구조
  zone                 text,      -- all / partial / unknown
  no_pets              boolean,
  service_dog_only     boolean,
  max_kg               numeric,
  max_kg_inclusive     boolean,   -- '이하'면 true, '미만'이면 false
  allowed_sizes        text[],
  exclude_dangerous    boolean,
  needs                text[],
  notes                text[],
  zone_hint            text,
  completeness         text,      -- A / B / C
  attention            text,      -- 구조로 못 옮긴 조건 (나이·체고·마리수·계절)
  raw                  jsonb not null,
  synced_at            timestamptz not null default now()
);

create index if not exists pet_rules_zone_idx on public.pet_rules (zone);
create index if not exists pet_rules_cpam_idx on public.pet_rules (acmpy_psbl_cpam);

comment on table public.pet_rules is '동반 조건. 원본 자연어와 파싱 결과를 나란히 두어 파싱 품질을 눈으로 확인할 수 있다';

-- ─────────────────────────────────────────────────────────────
-- ③ 상세 — detailCommon2 / Intro2 / Info2 / Image2 (장소당 4콜)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.place_details (
  contentid    text primary key references public.places (contentid) on delete cascade,
  overview     text,        -- 사람이 쓴 소개글
  homepage     text,        -- 조건이 없을 때 기댈 마지막 곳
  usetime      text,        -- 영업시간
  restdate     text,        -- 휴무일 — '매주 월요일 (단, 공휴일이면 개관)' 류
  parking      text,
  tels         text[],
  extras       jsonb,       -- detailInfo2: 입장료·화장실 …
  images       jsonb,       -- detailImage2: url + 저작권(Type1/Type3)
  common_raw   jsonb,
  intro_raw    jsonb,
  synced_at    timestamptz not null default now()
);

comment on column public.place_details.images is 'cpyrhtDivCd=Type3 은 변경 금지(자르기·필터·글자 넣기 불가)';

-- ─────────────────────────────────────────────────────────────
-- ④ 코드표 — ldongCode2 / lclsSystmCode2 / areaCode2 / categoryCode2
-- ─────────────────────────────────────────────────────────────
create table if not exists public.codes (
  source     text not null,   -- ldong / lcls / area / category  (뒤 둘은 폐기 예정 구버전)
  code       text not null,
  name       text not null,
  -- 상위 코드 (시도코드, 1depth 코드 …). 최상위는 빈 문자열이다 —
  -- 기본키에 넣어야 하는데 Postgres 는 표현식(coalesce)을 기본키에 못 쓰고,
  -- null 은 유일성 비교에서 서로 다르게 취급돼 중복이 쌓인다
  parent     text not null default '',
  depth      int  not null default 1,
  raw        jsonb,
  synced_at  timestamptz not null default now(),
  primary key (source, code, parent)
);

comment on table public.codes is '지역·분류 코드표. area/category 는 구버전이라 번호 체계가 다르다 — 비교용으로만 적재';

-- ─────────────────────────────────────────────────────────────
-- ⑤ 수집 이력 — 배치가 언제 무엇을 몇 콜로 받았는지
-- ─────────────────────────────────────────────────────────────
create table if not exists public.sync_runs (
  id          bigint generated always as identity primary key,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  operation   text not null,   -- petTourSyncList2 …
  rows        int,
  api_calls   int,
  ok          boolean,
  message     text
);

comment on table public.sync_runs is 'API 호출 이력. 어떤 오퍼레이션을 언제 몇 번 불렀는지 남긴다';

-- ─────────────────────────────────────────────────────────────
-- RLS — 기본 거부. 적재는 service_role 이 RLS 를 우회한다.
-- 나중에 앱에서 읽어야 하면 그때 테이블별로 정책을 연다.
-- ─────────────────────────────────────────────────────────────
alter table public.places        enable row level security;
alter table public.pet_rules     enable row level security;
alter table public.place_details enable row level security;
alter table public.codes         enable row level security;
alter table public.sync_runs     enable row level security;
