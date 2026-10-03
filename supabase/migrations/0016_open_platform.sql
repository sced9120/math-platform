-- ============================================================
-- 0016: 누구나 교사로 가입해 "내 학급"을 꾸리는 구조 + 만져보는 수학
--
-- 지금까지는 한 학교(관리자 1명 + 그가 만든 교사)만 쓰는 사이트라
-- 교사면 누구나 모든 교과·단원·활동과 모든 학생 기록을 고칠 수 있었다.
-- 누구나 교사로 가입하게 열면 모르는 교사가 남의 자료를 지우거나
-- 남의 학생 기록을 볼 수 있으므로, 이제 "교사마다 자기 공간"으로 나눈다.
--
--  1) 교과·단원·소단원(activities)·활동(activity_screens)에 주인(owner_id)
--     - 교사(관리자 포함)는 자기가 만든 것만 보고 고친다
--     - 학생은 "자기 담당 교사"가 만든 것만 본다
--     - 기존 자료는 전부 가장 먼저 만들어진 관리자에게 붙인다 (지금 화면 그대로)
--  2) 학생 기록(progress·screen_responses·첨부 사진)은 담당 교사만
--  3) 학급 코드 — 학번(10101)은 학교마다 겹치므로, 새 교사의 학생은
--     "학번 + 학급 코드"로 로그인한다. (기존 학생은 지금처럼 학번만)
--  4) 사이트 설정 — 누구나 교사 가입 허용 여부 (관리자가 켜고 끔)
--  5) 만져보는 수학 — 로그인 없이 누구나 여는 조작 자료 모음.
--     교사는 이것을 자기 소단원에 "활동 한 화면"으로 복사해 넣는다.
--
-- 이 파일은 여러 번 실행해도 되게(멱등) 작성했다.
-- 실행 순서: 이 SQL 을 먼저 실행 → 그다음 새 코드 배포.
-- (지금 배포된 코드도 이 SQL 실행 후 그대로 동작한다)
-- ============================================================


-- 0. 헬퍼 ---------------------------------------------------------------------

-- 내 담당 교사 (학생 화면에서 "어느 교사의 자료를 보여 줄지" 정할 때)
create or replace function public.my_teacher_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select teacher_id from public.profiles where id = auth.uid();
$$;

revoke all on function public.my_teacher_id() from public;
grant execute on function public.my_teacher_id() to authenticated;

-- 내가 담당하는 학생인가 — 관리자도 예외 없이 "자기 학생"만.
-- (0011 의 is_my_student 는 관리자에게 전부 허용한다. 기록 열람은 이 엄격한 버전을 쓴다)
create or replace function public.is_own_student(p_student_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles s
    where s.id = p_student_id
      and s.role = 'student'
      and s.teacher_id = auth.uid()
  );
$$;

revoke all on function public.is_own_student(uuid) from public;
grant execute on function public.is_own_student(uuid) to authenticated;

-- 저장소 경로의 첫 폴더(학생 uuid 문자열)로 판별하는 버전
create or replace function public.is_own_student_folder(p_folder text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles s
    where s.id::text = p_folder
      and s.role = 'student'
      and s.teacher_id = auth.uid()
  );
$$;

revoke all on function public.is_own_student_folder(text) from public;
grant execute on function public.is_own_student_folder(text) to authenticated;


-- 1. 사이트 설정 --------------------------------------------------------------
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


-- 2. 학급 코드 ----------------------------------------------------------------
alter table public.profiles add column if not exists class_code text;

create unique index if not exists profiles_class_code_key
  on public.profiles (class_code)
  where class_code is not null;

-- 헷갈리는 글자(0/o, 1/l/i)를 뺀 6자리
create or replace function public.new_class_code()
returns text
language plpgsql volatile
set search_path = public
as $$
declare
  v_chars text := 'abcdefghjkmnpqrstuvwxyz23456789';
  v_code  text;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where class_code = v_code);
  end loop;
  return v_code;
end;
$$;

revoke all on function public.new_class_code() from public;

-- 관리자는 학급 코드가 없다 — 관리자 학생은 지금처럼 학번만으로 로그인한다.
-- 그 밖의 교사에게는 코드를 하나씩 준다.
update public.profiles
set class_code = public.new_class_code()
where role = 'teacher' and class_code is null;


-- 3. 주인(owner_id) -----------------------------------------------------------
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


-- 4. 자료 정책: 교사는 자기 것만 --------------------------------------------
-- 0001·0010·0013 의 "교사면 전부" 정책을 지우고 주인 기준으로 바꾼다.

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
  using (
    is_published
    and grade = public.my_grade()
    and owner_id = public.my_teacher_id()
  );

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
    and owner_id = public.my_teacher_id()
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


-- 5. 학생 기록 정책: 담당 교사만 ---------------------------------------------
drop policy if exists "progress_teacher_all"          on public.progress;
drop policy if exists "progress_teacher_own_students" on public.progress;
create policy "progress_teacher_own_students"
  on public.progress for all
  using (public.is_teacher() and public.is_own_student(student_id))
  with check (public.is_teacher() and public.is_own_student(student_id));

drop policy if exists "screen_responses_teacher_all"          on public.screen_responses;
drop policy if exists "screen_responses_teacher_own_students" on public.screen_responses;
create policy "screen_responses_teacher_own_students"
  on public.screen_responses for all
  using (public.is_teacher() and public.is_own_student(student_id))
  with check (public.is_teacher() and public.is_own_student(student_id));

drop policy if exists "ai_usage_select_own_or_teacher" on public.ai_usage;
create policy "ai_usage_select_own_or_teacher"
  on public.ai_usage for select
  using (student_id = auth.uid() or public.is_own_student(student_id));

-- 학생 첨부 사진: 본인 또는 담당 교사만
drop policy if exists "student_uploads_select_own_or_teacher" on storage.objects;
create policy "student_uploads_select_own_or_teacher" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'student-uploads'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (public.is_teacher() and public.is_own_student_folder((storage.foldername(name))[1]))
    )
  );

drop policy if exists "student_uploads_delete_own_or_teacher" on storage.objects;
create policy "student_uploads_delete_own_or_teacher" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'student-uploads'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (public.is_teacher() and public.is_own_student_folder((storage.foldername(name))[1]))
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


-- 6. 학생용 함수: "내 담당 교사의 자료"만 -------------------------------------
-- 6-1. 단원 가시성 헬퍼 (save_response·submit_answer 가 이것을 쓴다)
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
      and u.owner_id = p.teacher_id
      and (u.subject_id is null or (s.is_published and s.grade = p.grade))
  );
$$;

-- 6-2. 소단원 목록 (0010 본문 + 주인 조건)
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
    and u.owner_id = p.teacher_id
    and (u.subject_id is null or (s.is_published and s.grade = p.grade))
    and (a.assigned_classes is null or p.class_no = any(a.assigned_classes))
    and (p_unit_id is null or a.unit_id = p_unit_id)
    and (p_activity_id is null or a.id = p_activity_id)
  order by a.order_index;
$$;

-- 6-3. 화면 조회 (0013 본문 + 주인·교과 조건)
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

-- 6-4. 글·사진 저장 (0013 본문 + 주인·교과 조건)
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

-- 6-5. 단답·선택형 채점 (0013 본문 + 주인·교과 조건)
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


-- 7. 만져보는 수학 ------------------------------------------------------------
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
