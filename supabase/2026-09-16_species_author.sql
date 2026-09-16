-- 2026-09-16 한 번에 실행 — ① 프로필 강아지/고양이 ② 글·리뷰 작성자 스냅샷
-- Supabase → SQL Editor → 통째로 붙여넣고 Run. 여러 번 실행해도 안전하다.

-- ① pets: 강아지인지 고양이인지
alter table public.pets add column if not exists species text not null default 'dog' check (species in ('dog', 'cat'));

-- ② posts / reviews: 로그인해서 쓰면 서버가 토큰을 확인하고 계정과 아이를 스냅샷으로 남긴다. 비로그인이면 null
alter table public.posts add column if not exists author_id       uuid;
alter table public.posts add column if not exists author_name     text;
alter table public.posts add column if not exists author_avatar   text;
alter table public.posts add column if not exists author_provider text;
alter table public.posts add column if not exists pet_name        text;
alter table public.posts add column if not exists pet_emoji       text;
alter table public.posts add column if not exists pet_label       text;

alter table public.reviews add column if not exists author_id       uuid;
alter table public.reviews add column if not exists author_name     text;
alter table public.reviews add column if not exists author_avatar   text;
alter table public.reviews add column if not exists author_provider text;
alter table public.reviews add column if not exists pet_name        text;
alter table public.reviews add column if not exists pet_emoji       text;

comment on column public.posts.author_id is '로그인해서 쓴 글이면 계정 id. 서버가 토큰으로 확인한 값만 들어간다';
comment on column public.posts.pet_label is '글 쓸 때 기준이던 아이의 크기 이름표(소형견·중형묘 …). 계정의 pets 에서 서버가 읽어 스냅샷';
