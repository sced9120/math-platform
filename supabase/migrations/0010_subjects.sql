-- 0010: 교과(subjects) 계층 추가
-- 구조: 교과(subjects) → 단원(units) → 활동(activities)
-- 학생 화면: 내 교과 → 교과 상세(단원별로 묶인 활동) → 활동
-- 기존 단원은 subject_id 가 null 이어도 그대로 동작한다(교과 미지정 단원).

-- 1) 교과 테이블 -------------------------------------------------------------
create table public.subjects (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  grade        int not null,
  order_index  int not null default 0,
  is_published boolean not null default false,
  created_at   timestamptz not null default now()
);

alter table public.subjects enable row level security;

-- 학생은 자기 학년의 공개 교과만, 교사는 전부
create policy "subjects_student_read_published"
  on public.subjects for select
  using (is_published and grade = public.my_grade());

create policy "subjects_teacher_all"
  on public.subjects for all
  using (public.is_teacher())
  with check (public.is_teacher());

-- 2) 단원에 교과 연결 --------------------------------------------------------
alter table public.units
  add column subject_id uuid references public.subjects (id) on delete set null;

create index units_subject_id_idx on public.units (subject_id);

-- 3) 공통 가시성 헬퍼 --------------------------------------------------------
-- 단원이 나에게 보이는가? (공개 + 내 학년 + 교과가 있으면 그 교과도 공개)
-- 정책과 RPC 양쪽에서 같은 규칙을 쓰도록 한 곳에 모은다.
create or replace function public.unit_visible_to_me(p_unit_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.units u
    join public.profiles p on p.id = auth.uid()
    left join public.subjects s on s.id = u.subject_id
    where u.id = p_unit_id
      and u.is_published
      and u.grade = p.grade
      and (u.subject_id is null or (s.is_published and s.grade = p.grade))
  );
$$;

revoke all on function public.unit_visible_to_me(uuid) from public;
grant execute on function public.unit_visible_to_me(uuid) to authenticated;

-- 4) 단원/활동 읽기 정책에 교과 조건 반영 ------------------------------------
drop policy "units_student_read_published" on public.units;
create policy "units_student_read_published"
  on public.units for select
  using (
    is_published
    and grade = public.my_grade()
    and (
      subject_id is null
      or exists (
        select 1 from public.subjects s
        where s.id = subject_id
          and s.is_published
          and s.grade = public.my_grade()
      )
    )
  );

drop policy "activities_student_read_published" on public.activities;
create policy "activities_student_read_published"
  on public.activities for select
  using (is_published and public.unit_visible_to_me(unit_id));

-- 5) 학생용 활동 조회 RPC: 교과 조건 + subject_id 반환 -----------------------
-- 반환 타입이 바뀌므로 drop 후 재생성한다.
drop function if exists public.student_activities(uuid, uuid);

create function public.student_activities(
  p_unit_id uuid default null,
  p_activity_id uuid default null
)
returns table (
  id uuid,
  unit_id uuid,
  subject_id uuid,
  type text,
  title text,
  content jsonb,
  order_index int
)
language sql stable security definer
set search_path = public
as $$
  select a.id, a.unit_id, u.subject_id, a.type, a.title,
         case when a.type = 'problem'
              then (a.content - 'answer') - 'tolerance'
              else a.content
         end as content,
         a.order_index
  from public.activities a
  join public.units u on u.id = a.unit_id
  join public.profiles p on p.id = auth.uid()
  left join public.subjects s on s.id = u.subject_id
  where a.is_published
    and u.is_published
    and u.grade = p.grade
    and (u.subject_id is null or (s.is_published and s.grade = p.grade))
    and (a.assigned_classes is null or p.class_no = any(a.assigned_classes))
    and (p_unit_id is null or a.unit_id = p_unit_id)
    and (p_activity_id is null or a.id = p_activity_id)
  order by a.order_index;
$$;

-- 6) 채점/글저장 RPC 의 접근 검사도 같은 규칙으로 통일 -----------------------
-- 0005 의 본문을 그대로 두고, 단원 가시성 검사만 unit_visible_to_me 로 교체한다.
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
  join public.profiles p on p.id = auth.uid()
  where a.id = p_activity_id
    and a.type = 'problem'
    and a.is_published
    and public.unit_visible_to_me(a.unit_id)   -- 교과 공개 여부까지 확인
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
  join public.profiles p on p.id = auth.uid()
  where a.id = p_activity_id
    and a.is_published
    and public.unit_visible_to_me(a.unit_id)   -- 교과 공개 여부까지 확인
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
