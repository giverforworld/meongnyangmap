-- 커뮤니티 댓글 (2026-09-16)
--
-- Supabase → SQL Editor → 통째로 붙여넣고 Run. 여러 번 실행해도 안전하다.
-- 글과 같은 규칙이다: 로그인하면 계정으로(서버가 토큰 확인), 아니면 닉네임+비밀번호.

create table if not exists public.comments (
  id              bigint generated always as identity primary key,
  post_id         bigint      not null references public.posts (id) on delete cascade,
  nickname        text        not null check (char_length(nickname) between 1 and 20),
  body            text        not null check (char_length(body) between 1 and 1000),
  password_hash   text        not null,
  -- 로그인해서 쓴 댓글이면 계정·아이 스냅샷. 비로그인이면 전부 null
  author_id       uuid,
  author_name     text,
  author_avatar   text,
  author_provider text,
  pet_name        text,
  pet_emoji       text,
  pet_label       text,
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index if not exists comments_post_idx on public.comments (post_id, created_at) where deleted_at is null;

alter table public.comments enable row level security;
-- 읽기·쓰기 전부 서버 라우트(service_role)를 거친다. 정책 없음 = 브라우저에서 직접 접근 불가

-- 글 목록에 '댓글 N' 을 쓰기 위한 카운터. 댓글이 생기거나 지워질 때 트리거가 맞춘다
alter table public.posts add column if not exists comment_count int not null default 0;

create or replace function public.bump_comment_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif tg_op = 'UPDATE' and old.deleted_at is null and new.deleted_at is not null then
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = new.post_id;
  end if;
  return new;
end $$;

drop trigger if exists comments_count on public.comments;
create trigger comments_count after insert or update on public.comments
  for each row execute function public.bump_comment_count();

comment on table public.comments is '커뮤니티 댓글. 로그인 댓글은 계정으로, 비로그인은 닉네임+비밀번호로 지운다';
