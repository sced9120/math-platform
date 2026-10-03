-- ============================================================
-- 0017: 누구나 교사로 가입하는 플랫폼 — 교사별 공간 + 교사별 AI + 만져보는 수학
--
-- 0016 까지는 한 학교(관리자 + 관리자가 만든 교사)만 쓰는 사이트였다.
--   - 교사면 누구나 모든 교과·단원·소단원을 고치고, 모든 학생 기록을 볼 수 있었다
--   - 교사는 서버의 "전체 학생 명단"을 보고 아무 학생이나 자기 목록에 담을 수 있었다(0016)
--   - AI 키·모델·한도·프롬프트는 사이트에 하나였다
-- 누구나 교사로 가입하게 열면 모르는 사람이 이 모든 것에 닿게 되므로 이렇게 나눈다.
--
--  1) 교사 두 종류
--     - 학교 교사: 관리자 + 관리자가 만든 교사 (self_signup = false)
--       학교 학생 명단을 보고 골라 담는다(0016 그대로). 학생은 학번만으로 로그인.
--     - 가입 교사: /signup 으로 직접 가입 (self_signup = true)
--       학교 명단이 보이지 않는다. 자기가 만든 학생만. 학생은 학번 + 학급 코드로 로그인.
--  2) 교과·단원·소단원(activities)·활동(activity_screens)에 주인(owner_id)
--     - 교사(관리자 포함)는 자기가 만든 것만 보고 고친다
--     - 학생은 자기를 담은 교사들이 만든 것만 본다
--     - 기존 자료는 가장 먼저 만들어진 관리자에게 붙인다 (지금 화면 그대로)
--  3) 학생 기록(진도·서술·사진)은 그 학생을 담은 교사만 본다 (관리자도 예외 없음)
--  4) AI 키·모델·한도·프롬프트를 교사마다 따로
--     - 학생의 AI 는 그 활동을 만든 교사(자유 질문·첨삭은 담당 교사)의 설정을 쓴다
--     - 조작 활동 만들기는 교사 본인의 설정을 쓴다
--  5) 관리자 → 교사로 넘기기 함수 (관리자는 교사 계정만 관리하게)
--  6) 사이트 설정(누구나 교사 가입 허용) + 만져보는 수학(로그인 없이 쓰는 공개 자료)
--
-- 0016_teacher_students 다음에 실행. 여러 번 실행해도 된다(멱등).
-- 지금 배포된 코드도 이 SQL 실행 후 그대로 동작한다. (그다음 새 코드 배포)
-- ============================================================


-- 1. 교사 종류 · 학급 코드 ------------------------------------------------------
alter table public.profiles add column if not exists self_signup boolean not null default false;
alter table public.profiles add column if not exists class_code text;

-- 학급 코드는 가입 교사에게만 있다. 겹치면 안 된다.
create unique index if not exists profiles_class_code_key
  on public.profiles (class_code)
  where class_code is not null;


-- 2. 헬퍼 -----------------------------------------------------------------------
-- 모두 security definer — 정책 안에서 표를 다시 읽을 때 생기는 무한재귀를 막는다.

-- 학교 교사인가 (관리자 또는 관리자가 만든 교사)
create or replace function public.is_school_staff(p_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = p_id and role in ('admin', 'teacher') and not self_signup
  );
$$;

-- (학생 화면) 이 교사가 나를 목록에 담고 있는가 — 담당 교사의 자료만 보여 줄 때
create or replace function public.taught_by(p_teacher_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.teacher_students
    where student_id = auth.uid() and teacher_id = p_teacher_id
  );
$$;

-- 저장소 경로의 첫 폴더(학생 uuid 문자열)로 "내가 담은 학생인가" 판별
create or replace function public.teaches_student_folder(p_folder text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.teacher_students
    where student_id::text = p_folder and teacher_id = auth.uid()
  );
$$;

-- 이 학생을 내 목록에 담을 수 있는가
--  - 내가 만든 학생은 언제나
--  - 학교 교사는 학교 학생(학교 교사가 만든 학생)도
--  - 가입 교사는 남이 만든 학생을 담을 수 없다
create or replace function public.can_claim_student(p_student_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles s
    where s.id = p_student_id
      and s.role = 'student'
      and (
        s.teacher_id = auth.uid()
        or (
          public.is_school_staff(auth.uid())
          and (s.teacher_id is null or public.is_school_staff(s.teacher_id))
        )
      )
  );
$$;

revoke all on function public.is_school_staff(uuid) from public;
revoke all on function public.taught_by(uuid) from public;
revoke all on function public.teaches_student_folder(text) from public;
revoke all on function public.can_claim_student(uuid) from public;
grant execute on function public.is_school_staff(uuid) to authenticated;
grant execute on function public.taught_by(uuid) to authenticated;
grant execute on function public.teaches_student_folder(text) to authenticated;
grant execute on function public.can_claim_student(uuid) to authenticated;


-- 3. 학생 명단 · 담기 — 가입 교사에게 학교 명단을 열지 않는다 --------------------
create or replace function public.all_students()
returns table (
  id         uuid,
  grade      int,
  class_no   int,
  student_no int,
  name       text,
  is_mine    boolean
)
language sql stable security definer
set search_path = public
as $$
  select p.id, p.grade, p.class_no, p.student_no, p.name,
         exists (
           select 1 from public.teacher_students ts
           where ts.student_id = p.id and ts.teacher_id = auth.uid()
         ) as is_mine
  from public.profiles p
  where p.role = 'student'
    and public.is_teacher()   -- 교사·관리자가 아니면 빈 결과
    and (
      p.teacher_id = auth.uid()                          -- 내가 만든 학생
      or (
        public.is_school_staff(auth.uid())               -- 학교 교사에게는 학교 학생
        and (p.teacher_id is null or public.is_school_staff(p.teacher_id))
      )
    )
  order by p.grade, p.class_no, p.student_no;
$$;

drop policy if exists "teacher_students_own" on public.teacher_students;
create policy "teacher_students_own"
  on public.teacher_students for all
  using (public.is_teacher() and teacher_id = auth.uid())
  with check (
    public.is_teacher()
    and teacher_id = auth.uid()
    and public.can_claim_student(student_id)
  );


-- 4. 자료의 주인 ----------------------------------------------------------------
alter table public.subjects   add column if not exists owner_id uuid references public.profiles (id) on delete set null;
alter table public.units      add column if not exists owner_id uuid references public.profiles (id) on delete set null;
alter table public.activities add column if not exists owner_id uuid references public.profiles (id) on delete set null;

-- 기존 자료의 주인 = 가장 먼저 만들어진 관리자 (없으면 가장 먼저 만들어진 교사)
do $$
declare
  v_owner uuid;
begin
  select id into v_owner from public.profiles
  where role = 'admin' order by created_at limit 1;
  if v_owner is null then
    select id into v_owner from public.profiles
    where role = 'teacher' order by created_at limit 1;
  end if;

  if v_owner is not null then
    update public.subjects   set owner_id = v_owner where owner_id is null;
    update public.units      set owner_id = v_owner where owner_id is null;
    update public.activities set owner_id = v_owner where owner_id is null;
  end if;
end $$;

-- 앞으로 만드는 것은 만든 사람이 주인 (앱 코드는 그대로 두어도 된다)
alter table public.subjects   alter column owner_id set default auth.uid();
alter table public.units      alter column owner_id set default auth.uid();
alter table public.activities alter column owner_id set default auth.uid();

create index if not exists subjects_owner_idx   on public.subjects (owner_id);
create index if not exists units_owner_idx      on public.units (owner_id);
create index if not exists activities_owner_idx on public.activities (owner_id);


-- 5. 자료 정책: 교사는 자기 것만, 학생은 담당 교사 것만 ---------------------------
-- 교과
drop policy if exists "subjects_teacher_all" on public.subjects;
drop policy if exists "subjects_owner_all"   on public.subjects;
create policy "subjects_owner_all"
  on public.subjects for all
  using (public.is_teacher() and owner_id = auth.uid())
  with check (public.is_teacher() and owner_id = auth.uid());

drop policy if exists "subjects_student_read_published" on public.subjects;
create policy "subjects_student_read_published"
  on public.subjects for select
  using (is_published and grade = public.my_grade() and public.taught_by(owner_id));

-- 단원 (교과에 넣을 때는 내 교과에만)
drop policy if exists "units_teacher_all" on public.units;
drop policy if exists "units_owner_all"   on public.units;
create policy "units_owner_all"
  on public.units for all
  using (public.is_teacher() and owner_id = auth.uid())
  with check (
    public.is_teacher()
    and owner_id = auth.uid()
    and (
      subject_id is null
      or exists (select 1 from public.subjects s
                 where s.id = subject_id and s.owner_id = auth.uid())
    )
  );

drop policy if exists "units_student_read_published" on public.units;
create policy "units_student_read_published"
  on public.units for select
  using (
    is_published
    and grade = public.my_grade()
    and public.taught_by(owner_id)
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

-- 소단원(activities) — 내 단원 안에만 만든다.
-- 학생용 SELECT 정책은 일부러 두지 않는다(0002): 정답이 들어 있어 RPC 로만 내려준다.
drop policy if exists "activities_teacher_all" on public.activities;
drop policy if exists "activities_owner_all"   on public.activities;
create policy "activities_owner_all"
  on public.activities for all
  using (public.is_teacher() and owner_id = auth.uid())
  with check (
    public.is_teacher()
    and owner_id = auth.uid()
    and exists (select 1 from public.units u
                where u.id = unit_id and u.owner_id = auth.uid())
  );

-- 활동(화면) — 내 소단원 안의 것만
drop policy if exists "activity_screens_teacher_all" on public.activity_screens;
drop policy if exists "activity_screens_owner_all"   on public.activity_screens;
create policy "activity_screens_owner_all"
  on public.activity_screens for all
  using (
    public.is_teacher()
    and exists (select 1 from public.activities a
                where a.id = activity_id and a.owner_id = auth.uid())
  )
  with check (
    public.is_teacher()
    and exists (select 1 from public.activities a
                where a.id = activity_id and a.owner_id = auth.uid())
  );


-- 6. 학생 기록 정책: 그 학생을 담은 교사만 (관리자도 예외 없음) --------------------
drop policy if exists "progress_teacher_all"          on public.progress;
drop policy if exists "progress_teacher_own_students" on public.progress;
create policy "progress_teacher_own_students"
  on public.progress for all
  using (public.is_teacher() and public.teaches_student(student_id))
  with check (public.is_teacher() and public.teaches_student(student_id));

drop policy if exists "screen_responses_teacher_all"          on public.screen_responses;
drop policy if exists "screen_responses_teacher_own_students" on public.screen_responses;
create policy "screen_responses_teacher_own_students"
  on public.screen_responses for all
  using (public.is_teacher() and public.teaches_student(student_id))
  with check (public.is_teacher() and public.teaches_student(student_id));

drop policy if exists "ai_usage_select_own_or_teacher" on public.ai_usage;
create policy "ai_usage_select_own_or_teacher"
  on public.ai_usage for select
  using (student_id = auth.uid() or public.teaches_student(student_id));

-- 학생 첨부 사진: 본인 또는 담은 교사만
drop policy if exists "student_uploads_select_own_or_teacher" on storage.objects;
create policy "student_uploads_select_own_or_teacher" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'student-uploads'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (public.is_teacher() and public.teaches_student_folder((storage.foldername(name))[1]))
    )
  );

drop policy if exists "student_uploads_delete_own_or_teacher" on storage.objects;
create policy "student_uploads_delete_own_or_teacher" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'student-uploads'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (public.is_teacher() and public.teaches_student_folder((storage.foldername(name))[1]))
    )
  );

-- 활동 이미지: 올리기는 교사 누구나, 고치기·지우기는 올린 사람만
drop policy if exists "activity_files_teacher_update" on storage.objects;
create policy "activity_files_teacher_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'activity-files' and public.is_teacher() and owner = auth.uid());

drop policy if exists "activity_files_teacher_delete" on storage.objects;
create policy "activity_files_teacher_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'activity-files' and public.is_teacher() and owner = auth.uid());


-- 7. 학생용 함수: "나를 담은 교사의 자료"만 --------------------------------------
-- 7-1. 단원 가시성 헬퍼 (save_response·submit_answer 와 아래 함수들이 쓴다)
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
      and exists (select 1 from public.teacher_students ts
                  where ts.student_id = p.id and ts.teacher_id = u.owner_id)
      and (u.subject_id is null or (s.is_published and s.grade = p.grade))
  );
$$;

-- 7-2. 소단원 목록 (0010 본문 + 담당 교사 조건)
create or replace function public.student_activities(
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
    and exists (select 1 from public.teacher_students ts
                where ts.student_id = p.id and ts.teacher_id = u.owner_id)
    and (u.subject_id is null or (s.is_published and s.grade = p.grade))
    and (a.assigned_classes is null or p.class_no = any(a.assigned_classes))
    and (p_unit_id is null or a.unit_id = p_unit_id)
    and (p_activity_id is null or a.id = p_activity_id)
  order by a.order_index;
$$;

-- 7-3. 화면 조회 (0013 본문 + 단원 가시성)
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
  join public.profiles p on p.id = auth.uid()
  where s.activity_id = p_activity_id
    and a.is_published
    and public.unit_visible_to_me(a.unit_id)
    and (a.assigned_classes is null or p.class_no = any(a.assigned_classes))
  order by s.order_index;
$$;

-- 7-4. 글·사진 저장 (0013 본문 + 단원 가시성)
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
  join public.profiles p on p.id = auth.uid()
  where a.id = p_activity_id
    and a.is_published
    and public.unit_visible_to_me(a.unit_id)
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

-- 7-5. 단답·선택형 채점 (0013 본문 + 단원 가시성)
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
  join public.profiles p on p.id = auth.uid(),
       lateral jsonb_array_elements(s.questions) as q
  where s.activity_id = p_activity_id
    and s.screen_key = p_screen_key
    and q->>'id' = p_question_key
    and a.is_published
    and public.unit_visible_to_me(a.unit_id)
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


-- 8. AI 를 교사별로 ------------------------------------------------------------
alter table public.ai_secrets add column if not exists owner_id uuid references public.profiles (id) on delete cascade;
alter table public.ai_models  add column if not exists owner_id uuid references public.profiles (id) on delete cascade;
alter table public.ai_limits  add column if not exists owner_id uuid references public.profiles (id) on delete cascade;
alter table public.ai_prompts add column if not exists owner_id uuid references public.profiles (id) on delete cascade;

-- 지금 있는 사이트 설정은 가장 먼저 만든 관리자의 것이 된다 → 실행 직후에도 AI 는 지금처럼 돈다
do $$
declare
  v_admin uuid;
begin
  select id into v_admin from public.profiles
  where role = 'admin' order by created_at limit 1;

  if v_admin is not null then
    update public.ai_secrets set owner_id = v_admin where owner_id is null;
    update public.ai_models  set owner_id = v_admin where owner_id is null;
    update public.ai_limits  set owner_id = v_admin where owner_id is null;
    update public.ai_prompts set owner_id = v_admin where owner_id is null;
  end if;

  -- 주인을 정할 수 없는 행(관리자가 없는 새 사이트)은 쓸 사람이 없으므로 지운다
  delete from public.ai_secrets where owner_id is null;
  delete from public.ai_models  where owner_id is null;
  delete from public.ai_limits  where owner_id is null;
  delete from public.ai_prompts where owner_id is null;
end $$;

alter table public.ai_secrets alter column owner_id set not null;
alter table public.ai_models  alter column owner_id set not null;
alter table public.ai_limits  alter column owner_id set not null;
alter table public.ai_prompts alter column owner_id set not null;

-- 기본키를 "교사 + 항목"으로. 이미 바뀌었으면 건너뛴다.
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('ai_secrets', 'provider'),
      ('ai_limits',  'feature'),
      ('ai_prompts', 'key')
    ) as t(tbl, col)
  loop
    if exists (
      select 1 from pg_constraint
      where conrelid = ('public.' || r.tbl)::regclass
        and contype = 'p'
        and array_length(conkey, 1) = 1
    ) then
      execute format('alter table public.%I drop constraint %I', r.tbl, r.tbl || '_pkey');
      execute format('alter table public.%I add primary key (owner_id, %I)', r.tbl, r.col);
    end if;
  end loop;
end $$;

create index if not exists ai_models_owner_idx on public.ai_models (owner_id, sort_order);

-- ai_secrets·ai_limits·ai_prompts: 정책 없음 그대로 = 서버(service role)만.
--   키는 절대 브라우저로 내려가지 않는다. 교사 화면은 서버 API 가 "자기 것"만 다룬다.
-- ai_models: 모델 이름은 비밀이 아니다. 내 것 + 나를 담은 교사들 것만 읽는다(학생 선택지).
drop policy if exists "ai_models_read_authenticated" on public.ai_models;
drop policy if exists "ai_models_read_own_or_teacher" on public.ai_models;
create policy "ai_models_read_own_or_teacher"
  on public.ai_models for select
  to authenticated
  using (owner_id = auth.uid() or public.taught_by(owner_id));


-- 9. 관리자 → 교사로 넘기기 ----------------------------------------------------
-- 관리자가 지금 가진 학생 목록·자료·AI 설정을 학교 교사 한 명에게 넘긴다.
--  - 학생: 받는 교사의 목록에 담고 관리자 목록에서는 뺀다. 관리자가 만든 학생 계정의
--    "만든 사람"도 넘긴다(계정 삭제 권한). 학생 이메일은 그대로 → 학번만으로 로그인.
--  - 받는 교사에게 같은 항목(같은 제공자의 키, 같은 기능의 한도, 같은 프롬프트)이
--    이미 있으면 그 항목은 받는 교사 것을 그대로 둔다.
create or replace function public.transfer_teaching(p_to uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_from       uuid := auth.uid();
  v_students   int;
  v_subjects   int;
  v_units      int;
  v_activities int;
begin
  if v_from is null or not public.is_admin() then
    raise exception 'admin only';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_to and role = 'teacher' and not self_signup
  ) then
    raise exception 'target must be a school teacher';
  end if;

  insert into public.teacher_students (teacher_id, student_id)
  select p_to, student_id from public.teacher_students where teacher_id = v_from
  on conflict do nothing;
  delete from public.teacher_students where teacher_id = v_from;
  get diagnostics v_students = row_count;

  update public.profiles set teacher_id = p_to
  where role = 'student' and teacher_id = v_from;

  update public.subjects set owner_id = p_to where owner_id = v_from;
  get diagnostics v_subjects = row_count;
  update public.units set owner_id = p_to where owner_id = v_from;
  get diagnostics v_units = row_count;
  update public.activities set owner_id = p_to where owner_id = v_from;
  get diagnostics v_activities = row_count;

  update public.ai_secrets s set owner_id = p_to
  where s.owner_id = v_from
    and not exists (select 1 from public.ai_secrets t
                    where t.owner_id = p_to and t.provider = s.provider);
  update public.ai_models set owner_id = p_to where owner_id = v_from;
  update public.ai_limits l set owner_id = p_to
  where l.owner_id = v_from
    and not exists (select 1 from public.ai_limits t
                    where t.owner_id = p_to and t.feature = l.feature);
  update public.ai_prompts pr set owner_id = p_to
  where pr.owner_id = v_from
    and not exists (select 1 from public.ai_prompts t
                    where t.owner_id = p_to and t.key = pr.key);

  return jsonb_build_object(
    'students', v_students,
    'subjects', v_subjects,
    'units', v_units,
    'activities', v_activities
  );
end;
$$;

revoke all on function public.transfer_teaching(uuid) from public;
grant execute on function public.transfer_teaching(uuid) to authenticated;


-- 10. 사이트 설정 ---------------------------------------------------------------
create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- 정책 없음 = 서버(service role)만 읽고 쓴다
alter table public.site_settings enable row level security;

insert into public.site_settings (key, value)
values ('open_signup', 'true'::jsonb)
on conflict (key) do nothing;


-- 11. 만져보는 수학 -------------------------------------------------------------
-- 로그인 없이 누구나 여는 조작 자료. 쓰기는 관리자만.
-- 교사는 이것을 자기 소단원에 "활동 한 화면"으로 복사해 넣는다(복사본이라 원본과 따로 논다).
-- 정답이 섞일 수 있는 질문(questions)은 여기 두지 않는다 — 공개 조회라 그대로 노출되기 때문.
create table if not exists public.manipulatives (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,59}$'),
  title        text not null check (length(title) between 1 and 100),
  summary      text not null default '',
  topic        text not null default '',          -- 분류 (예: 도형의 방정식)
  order_index  int  not null default 0,
  type         text not null default 'html'
               check (type in ('text','plane','geogebra','image','html')),
  config       jsonb not null default '{}'::jsonb, -- activity_screens.config 와 같은 모양
  is_published boolean not null default false,
  owner_id     uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists manipulatives_order_idx
  on public.manipulatives (topic, order_index);

alter table public.manipulatives enable row level security;

drop policy if exists "manipulatives_public_read" on public.manipulatives;
create policy "manipulatives_public_read"
  on public.manipulatives for select
  to anon, authenticated
  using (is_published);

drop policy if exists "manipulatives_admin_all" on public.manipulatives;
create policy "manipulatives_admin_all"
  on public.manipulatives for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.manipulatives to anon, authenticated;

-- 처음 들어갈 예시 (코드 없이 설정만으로 도는 좌표평면 조작)
insert into public.manipulatives (slug, title, summary, topic, order_index, type, config, is_published, owner_id)
values
  ('two-point-distance', '두 점 사이의 거리',
   '두 점을 끌어 움직이며 거리가 어떻게 바뀌는지 관찰합니다.',
   '도형의 방정식', 1, 'plane',
   '{"plane":{"min":-7,"max":7,"grid":true,
      "points":[{"name":"A","x":-2,"y":-1,"draggable":true},{"name":"B","x":3,"y":3,"draggable":true}],
      "segments":[{"from":"A","to":"B","label":true}],
      "lines":[],"circles":[],"readouts":["distance"]}}'::jsonb,
   true, null),
  ('segment-midpoint', '선분의 중점',
   '양 끝점을 움직이며 중점의 좌표가 두 점 좌표의 평균이 되는지 확인합니다.',
   '도형의 방정식', 2, 'plane',
   '{"plane":{"min":-7,"max":7,"grid":true,
      "points":[{"name":"A","x":-4,"y":1,"draggable":true},{"name":"B","x":4,"y":5,"draggable":true}],
      "segments":[{"from":"A","to":"B","label":false}],
      "lines":[],"circles":[],"readouts":["midpoint"]}}'::jsonb,
   true, null),
  ('line-slope', '직선의 기울기',
   '두 점을 지나는 직선의 기울기를 관찰하고, 기울기가 없는 경우를 찾아봅니다.',
   '도형의 방정식', 3, 'plane',
   '{"plane":{"min":-7,"max":7,"grid":true,
      "points":[{"name":"P","x":-3,"y":-2,"draggable":true},{"name":"Q","x":2,"y":3,"draggable":true}],
      "segments":[{"from":"P","to":"Q","label":false}],
      "lines":[],"circles":[],"readouts":["slope","distance"]}}'::jsonb,
   true, null),
  ('circle-radius', '원 위의 점과 반지름',
   '원 위의 점 P 를 움직이면 중심과의 거리가 항상 반지름과 같은지 확인합니다.',
   '도형의 방정식', 4, 'plane',
   '{"plane":{"min":-6,"max":6,"grid":true,
      "points":[{"name":"O","x":0,"y":0,"draggable":false},{"name":"P","x":3,"y":4,"draggable":true}],
      "segments":[{"from":"O","to":"P","label":true}],
      "lines":[],"circles":[{"center":"O","r":5}],"readouts":["distance"]}}'::jsonb,
   true, null)
on conflict (slug) do nothing;
