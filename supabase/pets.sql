-- 반려동물 프로필 — 로그인한 사람 것만
--
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행한다.
--
-- 로그인은 선택이다. 안 하면 프로필은 브라우저에만 남고, 하면 여기에 올라와
-- 다른 기기에서도 같은 아이로 판정할 수 있다. 그래서 이 표는 "있어도 되고
-- 없어도 되는" 데이터다 — 비어 있어도 서비스는 그대로 돈다.
--
-- 브라우저가 anon 키로 직접 읽고 쓴다. 게시판(posts)이 서버 라우트를 거치는 것과
-- 다르다. 그래서 RLS 가 실제 방어선이다 — 정책이 없으면 남의 아이가 보인다.

create table if not exists public.pets (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,
  -- 브라우저가 쓰는 식별자(pet1, pet2 …). 기기에서 올린 것과 대조하는 데 쓴다
  key         text        not null,
  name        text        not null check (char_length(name) between 1 and 20),
  kg          numeric(5,1) not null check (kg > 0 and kg <= 120),
  emoji       text        not null default '🐶' check (char_length(emoji) <= 4),
  has_cage    boolean     not null default false,
  has_muzzle  boolean     not null default false,
  -- 동물보호법 맹견 5종(과 그 잡종). 견종을 받지 않으므로 직접 체크한다
  is_dangerous boolean    not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, key)
);

comment on table public.pets is '로그인한 사용자의 반려동물 프로필. 크기는 저장하지 않는다 — 무게에서 계산한다';

alter table public.pets enable row level security;

-- 본인 것만. select/insert/update/delete 전부
drop policy if exists "own pets" on public.pets;
create policy "own pets" on public.pets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- updated_at 자동 갱신
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists pets_touch on public.pets;
create trigger pets_touch before update on public.pets
  for each row execute function public.touch_updated_at();
