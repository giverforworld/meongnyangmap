-- 프로필에 강아지/고양이 구분 추가 (2026-09-16)
--
-- 이미 pets 표가 있는 프로젝트에서 한 번 실행한다. Supabase → SQL Editor → Run.

alter table public.pets add column if not exists species text not null default 'dog' check (species in ('dog', 'cat'));
