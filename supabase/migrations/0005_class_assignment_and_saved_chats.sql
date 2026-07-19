-- ============================================================
-- 반별 활동 부여 + AI 대화 저장 (최대 5개)
-- ============================================================

-- 1. 활동 대상 반: null = 해당 학년 전체, 배열 = 지정한 반만 보임
alter table public.activities add column assigned_classes int[];

-- 2. 학생용 활동 조회에 반 필터 반영 (정답 제거 로직은 그대로)
create or replace function public.student_activities(
  p_unit_id uuid default null,
  p_activity_id uuid default null
)
returns table (
  id uuid,
  unit_id uuid,
  type text,
  title text,
  content jsonb,
  order_index int
)
language sql stable security definer
set search_path = public
as $$
  select a.id, a.unit_id, a.type, a.title,
         case when a.type = 'problem'
              then (a.content - 'answer') - 'tolerance'
              else a.content
         end as content,
         a.order_index
  from public.activities a
  join public.units u on u.id = a.unit_id
  join public.profiles p on p.id = auth.uid()
  where a.is_published
    and u.is_published
    and u.grade = p.grade
    and (a.assigned_classes is null or p.class_no = any(a.assigned_classes))
    and (p_unit_id is null or a.unit_id = p_unit_id)
    and (p_activity_id is null or a.id = p_activity_id)
  order by a.order_index;
$$;

-- 3. 채점 함수에도 반 필터 반영
create or replace function public.submit_answer(p_activity_id uuid, p_answer text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_activity public.activities%rowtype;
  v_expected text;
  v_tolerance numeric;
  v_correct boolean;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select a.* into v_activity
  from public.activities a
  join public.units u on u.id = a.unit_id
  join public.profiles p on p.id = auth.uid()
  where a.id = p_activity_id
    and a.type = 'problem'
    and a.is_published
    and u.is_published
    and u.grade = p.grade
    and (a.assigned_classes is null or p.class_no = any(a.assigned_classes));

  if not found then
    raise exception 'activity not accessible';
  end if;

  v_expected := trim(v_activity.content->>'answer');
  v_tolerance := coalesce(nullif(v_activity.content->>'tolerance', '')::numeric, 0);

  begin
    v_correct := abs(trim(p_answer)::numeric - v_expected::numeric) <= v_tolerance;
  exception when others then
    v_correct := trim(p_answer) = v_expected;
  end;

  insert into public.progress (student_id, activity_id, completed, score, submission)
  values (
    auth.uid(), p_activity_id, v_correct,
    case when v_correct then 100 else 0 end,
    jsonb_build_object('answer', p_answer, 'correct', v_correct)
  )
  on conflict (student_id, activity_id) do update
    set completed  = progress.completed or excluded.completed,
        score      = greatest(coalesce(progress.score, 0), coalesce(excluded.score, 0)),
        submission = excluded.submission,
        updated_at = now();

  return jsonb_build_object('correct', v_correct);
end;
$$;

-- 4. 글 저장 함수에도 반 필터 반영
create or replace function public.save_response(p_activity_id uuid, p_text text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_type text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_text is null or length(trim(p_text)) = 0 or length(p_text) > 4000 then
    raise exception 'invalid text';
  end if;

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

  insert into public.progress (student_id, activity_id, completed, response_text)
  values (auth.uid(), p_activity_id, v_type <> 'problem', p_text)
  on conflict (student_id, activity_id) do update
    set response_text = excluded.response_text,
        completed = progress.completed or (v_type <> 'problem'),
        updated_at = now();
end;
$$;

-- 5. AI 대화 저장 (학생당 최대 5개, 본인만 접근 — 교사도 볼 수 없음)
create table public.ai_conversations (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.profiles (id) on delete cascade,
  activity_id    uuid references public.activities (id) on delete set null,
  activity_title text not null default '',
  title          text not null,
  messages       jsonb not null,
  created_at     timestamptz not null default now()
);

create index ai_conversations_student_idx on public.ai_conversations (student_id);

alter table public.ai_conversations enable row level security;

create policy "ai_conv_select_own" on public.ai_conversations
  for select using (student_id = auth.uid());

create policy "ai_conv_delete_own" on public.ai_conversations
  for delete using (student_id = auth.uid());

-- insert는 RPC로만 — 5개 제한을 DB에서 강제
create or replace function public.save_conversation(
  p_activity_id uuid,
  p_title text,
  p_messages jsonb
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_count int;
  v_activity_title text;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_title is null or length(trim(p_title)) = 0 or length(p_title) > 100 then
    raise exception 'invalid title';
  end if;
  if p_messages is null or jsonb_typeof(p_messages) <> 'array'
     or jsonb_array_length(p_messages) = 0
     or length(p_messages::text) > 60000 then
    raise exception 'invalid messages';
  end if;

  select count(*) into v_count
  from public.ai_conversations where student_id = auth.uid();
  if v_count >= 5 then
    raise exception 'conversation limit reached';
  end if;

  select title into v_activity_title
  from public.activities where id = p_activity_id;

  insert into public.ai_conversations (student_id, activity_id, activity_title, title, messages)
  values (auth.uid(), p_activity_id, coalesce(v_activity_title, ''), trim(p_title), p_messages)
  returning id into v_id;
  return v_id;
end;
$$;
