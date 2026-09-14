-- 견종 입력을 없애고 맹견 여부를 체크로 받는다 (2026-09-15)
--
-- 이미 pets.sql 을 실행한 프로젝트에서 한 번 실행한다.
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run.

alter table public.pets add column if not exists is_dangerous boolean not null default false;
alter table public.pets drop column if exists breed;

comment on table public.pets is '로그인한 사용자의 반려동물 프로필. 크기는 저장하지 않는다 — 무게에서 계산한다';
