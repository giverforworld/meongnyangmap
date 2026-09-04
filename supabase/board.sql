-- 커뮤니티 자유게시판
--
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행한다.
--
-- 로그인이 없는 서비스라 닉네임과 비밀번호로만 쓴다. 비밀번호는 글을 지울 때만
-- 쓰이고, 평문으로 두지 않도록 scrypt 해시로 저장한다(해시는 서버에서 만든다).
-- 읽기·쓰기는 전부 서버 라우트를 거치므로 RLS 는 기본 거부 그대로 둔다.

create table if not exists public.posts (
  id            bigint generated always as identity primary key,
  nickname      text        not null check (char_length(nickname) between 1 and 20),
  title         text        not null check (char_length(title) between 1 and 80),
  body          text        not null check (char_length(body) between 1 and 4000),
  -- 삭제할 때 대조할 값. 평문 비밀번호는 저장하지 않는다
  password_hash text        not null,
  views         int         not null default 0,
  created_at    timestamptz not null default now(),
  -- 지운 글은 실제로 지우지 않고 표시만 한다 — 잘못 지웠을 때 되살릴 수 있게
  deleted_at    timestamptz
);

create index if not exists posts_created_idx on public.posts (created_at desc) where deleted_at is null;

comment on table public.posts is '커뮤니티 자유게시판. 로그인이 없어 닉네임+비밀번호로 쓴다';
comment on column public.posts.password_hash is 'scrypt(비밀번호, salt). 삭제 시 대조용';

alter table public.posts enable row level security;
