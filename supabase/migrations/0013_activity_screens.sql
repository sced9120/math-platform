-- ============================================================
-- 0013: 활동을 "화면" 단위로 (docs/07_SCREEN_ARCHITECTURE.md)
--
-- 지금까지는 활동 하나가 HTML 한 덩어리라
--   - 한 화면만 고치려면 통짜 코드를 건드려야 하고
--   - 한 화면이 깨지면 나머지 화면의 조작까지 멈추고
--   - 화면을 다른 활동으로 옮기면 코드가 따라오지 않았다.
-- 이제 화면을 행으로 두고, 화면마다 유형과 질문을 갖는다.
--
-- 기존 활동은 건드리지 않는다. 화면 행이 하나도 없는 활동은 예전 방식대로 돈다.
-- ============================================================

-- 1. 화면 ---------------------------------------------------------------------
create table if not exists public.activity_screens (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  screen_key  text not null,                       -- 활동 안에서 고유. 학생 기록이 이 값으로 붙는다
  order_index int  not null default 0,
  type        text not null default 'text'
              check (type in ('text','plane','geogebra','image','html','legacy')),
  title       text not null default '',
  config      jsonb not null default '{}'::jsonb,  -- 유형별 설정 (본문·자료ID·평면 설정·HTML 등)
  questions   jsonb not null default '[]'::jsonb,  -- 아래 3번 참고
  sheet       text not null default '',            -- 학습지 배지
  teach       jsonb not null default '{}'::jsonb,  -- 수업 진행 칩
  created_at  timestamptz not null default now(),
  unique (activity_id, screen_key)
);

create index if not exists activity_screens_activity_idx
  on public.activity_screens (activity_id, order_index);

alter table public.activity_screens enable row level security;

drop policy if exists "activity_screens_teacher_all" on public.activity_screens;
drop policy if exists "activity_screens_student_read" on public.activity_screens;

-- 교사는 전부. 학생은 직접 읽지 못한다 — 정답이 들어 있으므로 아래 RPC 로만 내려준다.
create policy "activity_screens_teacher_all"
  on public.activity_screens for all
  using (public.is_teacher())
  with check (public.is_teacher());

-- 2. 학생 기록을 질문 단위로 넓힌다 -------------------------------------------
alter table public.screen_responses
  add column if not exists question_key text not null default '';
alter table public.screen_responses
  add column if not exists correct boolean;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'screen_responses_pkey'
      and conrelid = 'public.screen_responses'::regclass
  ) then
    alter table public.screen_responses drop constraint screen_responses_pkey;
  end if;
end $$;

alter table public.screen_responses
  add primary key (student_id, activity_id, screen_key, question_key);

-- 3. 학생용 화면 조회 ----------------------------------------------------------
-- 질문 스키마
--   { id, type: 'text',   prompt, photo? }
--   { id, type: 'short',  prompt, answer, tolerance? }
--   { id, type: 'choice', prompt, choices[], answer }
-- 정답(answer·tolerance)은 절대 학생에게 내려가면 안 된다. 여기서 걷어낸다.
create or replace function public.student_screens(p_activity_id uuid)
returns table (
  screen_key  text,
  order_index int,
  type        text,
  title       text,
  config      jsonb,
  questions   jsonb,
  sheet       text,
  teach       jsonb
)
language sql stable security definer
set search_path = public
as $$
  select s.screen_key, s.order_index, s.type, s.title, s.config,
         coalesce(
           (select jsonb_agg((q - 'answer') - 'tolerance' order by ord)
            from jsonb_array_elements(s.questions) with ordinality as t(q, ord)),
           '[]'::jsonb
         ) as questions,
         s.sheet, s.teach
  from public.activity_screens s
  join public.activities a on a.id = s.activity_id
  join public.units u on u.id = a.unit_id
  join public.profiles p on p.id = auth.uid()
  where s.activity_id = p_activity_id
    and a.is_published
    and u.is_published
    and u.grade = p.grade
    and (a.assigned_classes is null or p.class_no = any(a.assigned_classes))
  order by s.order_index;
$$;

revoke all on function public.student_screens(uuid) from public;
grant execute on function public.student_screens(uuid) to authenticated;

-- 4. 글·사진 저장 (질문 단위) --------------------------------------------------
create or replace function public.save_screen_response(
  p_activity_id uuid,
  p_screen_key  text,
  p_prompt      text,
  p_text        text,
  p_images      text[] default '{}',
  p_question_key text default ''
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_type text;
  v_img  text;
  v_text text := coalesce(p_text, '');
  v_imgs text[] := coalesce(p_images, '{}');
  v_qkey text := coalesce(p_question_key, '');
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_screen_key is null or length(trim(p_screen_key)) = 0 or length(p_screen_key) > 40 then
    raise exception 'invalid screen key';
  end if;
  if length(v_qkey) > 40 then
    raise exception 'invalid question key';
  end if;
  if length(v_text) > 4000 then
    raise exception 'text too long';
  end if;
  if array_length(v_imgs, 1) > 5 then
    raise exception 'too many images';
  end if;
  if length(trim(v_text)) = 0 and coalesce(array_length(v_imgs, 1), 0) = 0 then
    raise exception 'empty response';
  end if;

  foreach v_img in array v_imgs loop
    if v_img !~ ('^' || auth.uid()::text || '/') then
      raise exception 'invalid image path';
    end if;
  end loop;

  select a.type into v_type
  from public.activities a
  join public.units u on u.id = a.unit_id
  join public.profiles p on p.id = auth.uid()
  where a.id = p_activity_id
    and a.is_published
    and u.is_published
    and u.grade = p.grade
    and (a.assigned_classes is null or p.class_no = any(a.assigned_classes));
  if not found then
    raise exception 'activity not accessible';
  end if;

  insert into public.screen_responses
    (student_id, activity_id, screen_key, question_key, prompt, text, images)
  values
    (auth.uid(), p_activity_id, trim(p_screen_key), v_qkey, coalesce(p_prompt, ''), v_text, v_imgs)
  on conflict (student_id, activity_id, screen_key, question_key) do update
    set prompt = excluded.prompt,
        text   = excluded.text,
        images = excluded.images,
        updated_at = now();

  insert into public.progress (student_id, activity_id, completed)
  values (auth.uid(), p_activity_id, v_type <> 'problem')
  on conflict (student_id, activity_id) do update
    set completed = progress.completed or (v_type <> 'problem'),
        updated_at = now();
end;
$$;

revoke all on function public.save_screen_response(uuid, text, text, text, text[], text) from public;
grant execute on function public.save_screen_response(uuid, text, text, text, text[], text) to authenticated;

-- 5. 단답·선택형 채점 ----------------------------------------------------------
-- 채점은 여기서만 한다. 정답은 클라이언트로 내려가지 않는다.
create or replace function public.submit_screen_answer(
  p_activity_id  uuid,
  p_screen_key   text,
  p_question_key text,
  p_answer       text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_q         jsonb;
  v_type      text;
  v_expected  text;
  v_tolerance numeric;
  v_correct   boolean;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_answer is null or length(p_answer) > 500 then
    raise exception 'invalid answer';
  end if;

  select q into v_q
  from public.activity_screens s
  join public.activities a on a.id = s.activity_id
  join public.units u on u.id = a.unit_id
  join public.profiles p on p.id = auth.uid(),
       lateral jsonb_array_elements(s.questions) as q
  where s.activity_id = p_activity_id
    and s.screen_key = p_screen_key
    and q->>'id' = p_question_key
    and a.is_published
    and u.is_published
    and u.grade = p.grade
    and (a.assigned_classes is null or p.class_no = any(a.assigned_classes));
  if not found then
    raise exception 'question not accessible';
  end if;

  v_type := v_q->>'type';
  if v_type = 'choice' then
    v_correct := trim(p_answer) = (v_q->>'answer');
  elsif v_type = 'short' then
    v_expected := trim(coalesce(v_q->>'answer', ''));
    v_tolerance := coalesce(nullif(v_q->>'tolerance', '')::numeric, 0);
    begin
      v_correct := abs(trim(p_answer)::numeric - v_expected::numeric) <= v_tolerance;
    exception when others then
      v_correct := trim(p_answer) = v_expected;
    end;
  else
    raise exception 'not a graded question';
  end if;

  insert into public.screen_responses
    (student_id, activity_id, screen_key, question_key, prompt, text, correct)
  values
    (auth.uid(), p_activity_id, p_screen_key, p_question_key,
     coalesce(v_q->>'prompt', ''), p_answer, v_correct)
  on conflict (student_id, activity_id, screen_key, question_key) do update
    set text = excluded.text,
        correct = excluded.correct,
        prompt = excluded.prompt,
        updated_at = now();

  insert into public.progress (student_id, activity_id, completed)
  values (auth.uid(), p_activity_id, true)
  on conflict (student_id, activity_id) do update
    set completed = progress.completed or true,
        updated_at = now();

  return jsonb_build_object('correct', v_correct);
end;
$$;

revoke all on function public.submit_screen_answer(uuid, text, text, text) from public;
grant execute on function public.submit_screen_answer(uuid, text, text, text) to authenticated;

-- 6. 예전 5인자 save_screen_response 정리 ---------------------------------------
-- 0012 의 함수는 인자가 5개, 위의 새 함수는 6개다. 이름이 같아 둘 다 남아 있으면
-- 인자를 5개만 준 호출에서 "어느 함수인지 못 고르겠다"는 오류가 날 수 있다.
-- 지금은 앱이 항상 6개를 보내므로 예전 것을 지운다.
drop function if exists public.save_screen_response(uuid, text, text, text, text[]);
