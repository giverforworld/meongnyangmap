-- 글 수정 — 언제 고쳤는지 남긴다. 화면은 '수정됨 9/19' 로 보여준다.
-- Supabase SQL Editor 에서 그대로 실행. 여러 번 실행해도 안전하다.
alter table public.posts add column if not exists edited_at timestamptz;
comment on column public.posts.edited_at is '마지막으로 고친 시각. 없으면 고친 적 없음';
