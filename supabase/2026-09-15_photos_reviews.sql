-- 커뮤니티 사진 첨부 · 장소 연결 · 장소별 방문 리뷰 (2026-09-15)
--
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 안전하다.
-- board.sql(posts 표)이 먼저 실행돼 있어야 한다.

-- ── ① 게시글 — 사진과 장소 연결
-- 사진은 Storage 'photos' 버킷에 올리고 여기엔 공개 URL 만 둔다 (최대 4장, 서버가 검사)
alter table public.posts add column if not exists photos      text[] not null default '{}';
-- 어느 장소 이야기인지. 한국관광공사 contentid. 없으면 자유글
alter table public.posts add column if not exists place_id    text;
alter table public.posts add column if not exists place_title text;
alter table public.posts add column if not exists place_addr  text;

create index if not exists posts_place_idx on public.posts (place_id, created_at desc) where deleted_at is null;

comment on column public.posts.photos   is 'Storage photos 버킷의 공개 URL. 최대 4장';
comment on column public.posts.place_id is '한국관광공사 contentid. 지도·핫플레이스에서 "이곳 이야기 쓰기"로 연결된다';

-- ── ② 장소별 방문 리뷰
-- 이 서비스가 있는 이유가 "가서 못 들어가는 일"을 막는 것이라, 별점보다 **실제로 들어갔는지**를 먼저 묻는다.
create table if not exists public.reviews (
  id            bigint generated always as identity primary key,
  place_id      text        not null,
  place_title   text        not null,
  nickname      text        not null check (char_length(nickname) between 1 and 20),
  rating        smallint    not null check (rating between 1 and 5),
  -- 입장 결과: ok 문제없이 들어감 · cond 조건(입마개·이동장 등) 붙음 · denied 거부당함. 모르면 null
  entry         text        check (entry in ('ok', 'cond', 'denied')),
  body          text        not null check (char_length(body) between 1 and 1000),
  photos        text[]      not null default '{}',
  -- 어떤 아이와 갔는지 — 소형견 리뷰가 대형견에게 그대로 맞지는 않는다. 프로필이 있으면 자동
  pet_size      text        check (pet_size in ('small', 'medium', 'large')),
  password_hash text        not null,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists reviews_place_idx on public.reviews (place_id, created_at desc) where deleted_at is null;

comment on table public.reviews is '멍냥맵 사용자가 남긴 장소별 방문 리뷰. 한국관광공사 데이터가 아니다 — 화면에서도 그렇게 표시한다';
comment on column public.reviews.entry is 'ok 입장 · cond 조건부 입장 · denied 입장 거부';

alter table public.reviews enable row level security;
-- 읽기·쓰기 전부 서버 라우트(service_role)를 거친다. 정책 없음 = 브라우저에서 직접 접근 불가

-- ── ③ 사진 버킷 — 공개 읽기, 쓰기는 서버만
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
