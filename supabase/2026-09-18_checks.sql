-- 현장 확인 — 별점·글 없이 "들어갔나 / 조건이 있었나 / 거부됐나"와 요구된 것만 30초에 남긴다.
-- 새 표를 만들지 않고 reviews 를 넓힌다: 같은 장소·같은 작성자 표시·같은 삭제 규칙을 그대로 쓴다.
--   rating   → null 허용 (현장 확인만 남긴 행)
--   body     → 빈 문자열 허용
--   needs    → 현장에서 요구된 것(목줄·입마개·이동장·체중 제한·실내 불가 …)
--   visited_on → 다녀온 날
-- 무엇이든 하나는 있어야 한다: entry 가 있거나, 별점+글이 있거나.
-- Supabase SQL Editor 에서 그대로 실행. 여러 번 실행해도 안전하다.

-- ① 기존 check 제약 제거 — 인라인 check 의 자동 이름은 보통 reviews_rating_check / reviews_body_check 이지만
--    확실하지 않아 컬럼을 참조하는 check 를 찾아 지운다
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.reviews'::regclass and contype = 'c'
      and (pg_get_constraintdef(oid) ilike '%rating%' or pg_get_constraintdef(oid) ilike '%body%' or pg_get_constraintdef(oid) ilike '%needs%')
  loop
    execute format('alter table public.reviews drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.reviews alter column rating drop not null;
alter table public.reviews alter column body set default '';
alter table public.reviews add column if not exists needs      text[] not null default '{}';
alter table public.reviews add column if not exists visited_on date;

alter table public.reviews add constraint reviews_rating_check check (rating is null or rating between 1 and 5);
alter table public.reviews add constraint reviews_body_check   check (char_length(body) <= 1000);
alter table public.reviews add constraint reviews_has_content  check (entry is not null or (rating is not null and char_length(body) > 0));
alter table public.reviews add constraint reviews_needs_check  check (cardinality(needs) <= 6);

comment on column public.reviews.needs is '현장에서 실제로 요구된 것 — 멍냥맵 사용자가 고른 칩. 공사 데이터와 별개';
comment on column public.reviews.visited_on is '다녀온 날. 없으면 작성일로 본다';
