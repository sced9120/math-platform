-- ============================================================
-- 수학 학습 플랫폼 — 전체 DB 설정 (한 번에 실행)
-- 새 Supabase 프로젝트의 SQL Editor에 통째로 붙여넣고 Run 하세요.
-- (개별 마이그레이션 0001~0018을 순서대로 합친 파일입니다)
-- ============================================================


-- ===== 0001_init.sql =====

-- ============================================================
-- 수학 학습 플랫폼 — 초기 스키마 + RLS (STEP 1)
-- 적용 방법: Supabase 대시보드 SQL Editor에 붙여넣어 실행하거나
--            supabase CLI: `supabase db push`
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. 테이블
-- ------------------------------------------------------------

-- auth.users 확장 프로필. 교사 계정은 grade/class_no/student_no가 null일 수 있다.
create table public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  grade                int,
  class_no             int,
  student_no           int,
  name                 text not null,
  role                 text not null default 'student' check (role in ('student', 'teacher')),
  must_change_password boolean not null default true,
  created_at           timestamptz not null default now()
);

create table public.units (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  grade        int not null,
  order_index  int not null default 0,
  is_published boolean not null default false,
  created_at   timestamptz not null default now()
);

-- type은 이번 단계(MVP) 한정 3종. 2단계에서 'socratic','feedback'을 constraint에 추가한다.
create table public.activities (
  id           uuid primary key default gen_random_uuid(),
  unit_id      uuid not null references public.units (id) on delete cascade,
  type         text not null check (type in ('geogebra', 'content', 'problem')),
  title        text not null,
  content      jsonb not null default '{}'::jsonb,
  order_index  int not null default 0,
  is_published boolean not null default false,
  created_at   timestamptz not null default now()
);

create index activities_unit_id_idx on public.activities (unit_id);

create table public.progress (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  completed   boolean not null default false,
  score       numeric,
  submission  jsonb,
  updated_at  timestamptz not null default now(),
  unique (student_id, activity_id)
);

create index progress_activity_id_idx on public.progress (activity_id);

-- 2단계(AI) 비용 통제용. 지금은 테이블만 만들어 둔다.
-- 기록/증가는 서버(service role)에서만 수행한다.
create table public.ai_usage (
  student_id uuid not null references public.profiles (id) on delete cascade,
  date       date not null default current_date,
  count      int not null default 0,
  primary key (student_id, date)
);

-- ------------------------------------------------------------
-- 2. 헬퍼 함수
-- ------------------------------------------------------------

-- security definer: profiles의 RLS를 우회해 역할을 조회한다.
-- (profiles 정책 안에서 profiles를 다시 조회할 때 생기는 무한재귀를 방지)
create or replace function public.is_teacher()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'teacher'
  );
$$;

-- 로그인한 학생의 학년 (교사·미로그인 시 null)
create or replace function public.my_grade()
returns int
language sql stable security definer
set search_path = public
as $$
  select grade from public.profiles where id = auth.uid();
$$;

-- 최초 로그인 비밀번호 변경 완료 시 학생 본인이 호출하는 RPC (STEP 2에서 사용).
-- 학생에게 profiles UPDATE 권한을 직접 주지 않고 이 함수로만 플래그를 내린다.
create or replace function public.mark_password_changed()
returns void
language sql security definer
set search_path = public
as $$
  update public.profiles
  set must_change_password = false
  where id = auth.uid();
$$;

-- progress.updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger progress_set_updated_at
before update on public.progress
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 3. RLS 정책
--    원칙: 학생은 자기 데이터 + 자기 학년의 공개 콘텐츠만.
--          교사는 전부. service role은 RLS를 우회(서버 전용 작업).
-- ------------------------------------------------------------

alter table public.profiles   enable row level security;
alter table public.units      enable row level security;
alter table public.activities enable row level security;
alter table public.progress   enable row level security;
alter table public.ai_usage   enable row level security;

-- profiles: 본인 행 읽기 가능. 수정은 교사만(학생의 플래그 해제는 위 RPC로만).
create policy "profiles_select_own_or_teacher"
  on public.profiles for select
  using (id = auth.uid() or public.is_teacher());

create policy "profiles_teacher_write"
  on public.profiles for all
  using (public.is_teacher())
  with check (public.is_teacher());

-- units: 학생은 자기 학년의 공개 단원만 읽기. 교사는 전부.
create policy "units_student_read_published"
  on public.units for select
  using (is_published and grade = public.my_grade());

create policy "units_teacher_all"
  on public.units for all
  using (public.is_teacher())
  with check (public.is_teacher());

-- activities: 공개 활동이면서 소속 단원도 공개 + 자기 학년일 때만 학생 읽기 가능.
create policy "activities_student_read_published"
  on public.activities for select
  using (
    is_published
    and exists (
      select 1 from public.units u
      where u.id = unit_id
        and u.is_published
        and u.grade = public.my_grade()
    )
  );

create policy "activities_teacher_all"
  on public.activities for all
  using (public.is_teacher())
  with check (public.is_teacher());

-- progress: 학생은 자기 기록만 read/write. 삭제는 교사만.
create policy "progress_student_select_own"
  on public.progress for select
  using (student_id = auth.uid());

create policy "progress_student_insert_own"
  on public.progress for insert
  with check (student_id = auth.uid());

create policy "progress_student_update_own"
  on public.progress for update
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy "progress_teacher_all"
  on public.progress for all
  using (public.is_teacher())
  with check (public.is_teacher());

-- ai_usage: 학생은 자기 사용량 조회만 가능. 쓰기 정책은 의도적으로 없음 —
-- 카운트 증가는 서버측 API Route(service role)에서만 수행해 조작을 차단한다.
create policy "ai_usage_select_own_or_teacher"
  on public.ai_usage for select
  using (student_id = auth.uid() or public.is_teacher());

-- ===== 0002_step4_answer_security.sql =====

-- ============================================================
-- STEP 4 — 학생 활동 실행 + 정답 보안 강화
--  1) 학생의 activities 직접 조회를 차단하고,
--     정답(answer/tolerance)이 제거된 조회 함수로 대체
--  2) 문제 채점은 DB 함수(submit_answer)에서만 수행
--     → 정답이 어떤 경로로도 학생 클라이언트에 내려가지 않음
--  3) problem 유형의 progress는 학생이 직접 쓰지 못하게 정책 강화
--     → "정답 처리 완료"를 조작하는 치팅 차단
-- ============================================================

-- 1. 학생의 activities 직접 SELECT 차단
drop policy "activities_student_read_published" on public.activities;

-- 정답이 제거된 학생용 활동 조회 함수.
-- 인자 없이 호출하면 접근 가능한 전체 활동, p_unit_id/p_activity_id로 필터 가능.
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
  where a.is_published
    and u.is_published
    and u.grade = (select grade from public.profiles where id = auth.uid())
    and (p_unit_id is null or a.unit_id = p_unit_id)
    and (p_activity_id is null or a.id = p_activity_id)
  order by a.order_index;
$$;

-- 2. 문제 채점 + 진행기록 upsert (정답 비교는 DB 안에서만)
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

  -- 접근 가능(공개 + 자기 학년)한 problem 활동인지 확인
  select a.* into v_activity
  from public.activities a
  join public.units u on u.id = a.unit_id
  where a.id = p_activity_id
    and a.type = 'problem'
    and a.is_published
    and u.is_published
    and u.grade = (select grade from public.profiles where id = auth.uid());

  if not found then
    raise exception 'activity not accessible';
  end if;

  v_expected := trim(v_activity.content->>'answer');
  v_tolerance := coalesce(nullif(v_activity.content->>'tolerance', '')::numeric, 0);

  -- 둘 다 숫자면 허용오차 비교, 아니면 문자열 비교
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
    set completed  = progress.completed or excluded.completed,  -- 한 번 맞히면 유지
        score      = greatest(coalesce(progress.score, 0), coalesce(excluded.score, 0)),
        submission = excluded.submission,
        updated_at = now();

  return jsonb_build_object('correct', v_correct);
end;
$$;

-- 3. problem 유형의 progress 직접 쓰기 차단
-- 주의: 정책 안의 서브쿼리는 호출자 권한으로 실행돼 activities RLS에 걸리므로
--       (학생은 이제 activities를 못 봄) security definer 헬퍼로 판별한다.
create or replace function public.is_problem_activity(p_activity_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.activities
    where id = p_activity_id and type = 'problem'
  );
$$;

drop policy "progress_student_insert_own" on public.progress;
drop policy "progress_student_update_own" on public.progress;

create policy "progress_student_insert_own"
  on public.progress for insert
  with check (
    student_id = auth.uid()
    and not public.is_problem_activity(activity_id)
  );

create policy "progress_student_update_own"
  on public.progress for update
  using (student_id = auth.uid())
  with check (
    student_id = auth.uid()
    and not public.is_problem_activity(activity_id)
  );

-- ===== 0003_ai_features.sql =====

-- ============================================================
-- 2단계 — AI 기능 (소크라테스 챗봇 + 단계별 첨삭)
--  1) ai_usage를 기능별 일일 카운트로 확장 (비용 통제)
--  2) 사용량 증가 함수 — 서버(service role) 전용, KST 기준
--  3) 응답 캐시 테이블 — 동일 입력 중복 호출 절감
--  4) AI 사용 동의 (외부 API 전송 고지·동의)
-- ============================================================

-- 1. ai_usage: 기능별 카운트 (socratic: 챗봇 / feedback: 첨삭)
alter table public.ai_usage
  add column feature text not null default 'socratic'
  check (feature in ('socratic', 'feedback'));

alter table public.ai_usage drop constraint ai_usage_pkey;
alter table public.ai_usage add primary key (student_id, date, feature);

-- 2. 사용량 증가 + 한도 체크 (원자적). 한도 초과 시 -1 반환.
--    날짜는 한국 시간 기준 (UTC 기준이면 오전 9시에 리셋되는 문제 방지)
create or replace function public.increment_ai_usage(
  p_student_id uuid,
  p_feature text,
  p_limit int
)
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  v_date date := (now() at time zone 'Asia/Seoul')::date;
  v_count int;
begin
  insert into public.ai_usage (student_id, date, feature, count)
  values (p_student_id, v_date, p_feature, 1)
  on conflict (student_id, date, feature) do update
    set count = ai_usage.count + 1
    where ai_usage.count < p_limit
  returning count into v_count;

  if v_count is null then
    return -1; -- 오늘 한도 초과
  end if;
  return v_count;
end;
$$;

-- 서버(service role)에서만 호출 가능 — 클라이언트가 직접 카운트 조작 불가
revoke all on function public.increment_ai_usage(uuid, text, int)
  from public, anon, authenticated;
grant execute on function public.increment_ai_usage(uuid, text, int)
  to service_role;

-- 3. 응답 캐시 (입력 해시 → 응답). 정책 없음 = 서버 전용.
create table public.ai_cache (
  key        text primary key,
  feature    text not null,
  response   jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.ai_cache enable row level security;

-- 4. AI 사용 동의 시각 (null이면 미동의 — 서버가 AI 호출을 거부)
alter table public.profiles add column ai_consent_at timestamptz;

create or replace function public.accept_ai_consent()
returns void
language sql security definer
set search_path = public
as $$
  update public.profiles
  set ai_consent_at = now()
  where id = auth.uid() and ai_consent_at is null;
$$;

-- ===== 0004_activity_types_and_responses.sql =====

-- ============================================================
-- 활동 유형 확장 (image/html) + 학생 글 작성(response) + 이미지 저장소
-- ============================================================

-- 1. 활동 유형에 image(사진), html(HTML 콘텐츠) 추가
alter table public.activities drop constraint activities_type_check;
alter table public.activities add constraint activities_type_check
  check (type in ('geogebra', 'content', 'problem', 'image', 'html'));

-- 2. 학생 작성글 (소감/답변/풀이 과정 서술)
alter table public.progress add column response_text text;

-- 학생 글 저장 RPC — problem 유형의 progress 직접 쓰기 차단(치팅 방지)을
-- 우회하지 않도록, 글만 저장하고 problem의 완료/점수는 건드리지 않는다.
-- problem 외 유형은 글 저장 시 완료 처리.
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

  -- 접근 가능(공개 + 자기 학년)한 활동인지 확인
  select a.type into v_type
  from public.activities a
  join public.units u on u.id = a.unit_id
  where a.id = p_activity_id
    and a.is_published
    and u.is_published
    and u.grade = (select grade from public.profiles where id = auth.uid());
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

-- 3. 활동 이미지 저장소 (공개 읽기, 쓰기는 교사만)
insert into storage.buckets (id, name, public)
values ('activity-files', 'activity-files', true)
on conflict (id) do nothing;

create policy "activity_files_teacher_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'activity-files' and public.is_teacher());

create policy "activity_files_teacher_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'activity-files' and public.is_teacher());

create policy "activity_files_teacher_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'activity-files' and public.is_teacher());

-- ===== 0005_class_assignment_and_saved_chats.sql =====

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

-- ===== 0006_admin_role.sql =====

-- ============================================================
-- 관리자(admin) 역할 추가
--  계층: admin ⊃ teacher ⊃ student
--  - admin: 교사 계정 생성/관리 + 교사의 모든 권한
--  - teacher: 학생 계정 생성 + 단원/활동/기록
--  - student: 활동 수행
-- ============================================================

-- 1. role 제약에 'admin' 추가
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student', 'teacher', 'admin'));

-- 2. 기존 교사용 RLS/헬퍼가 admin에게도 통하도록 is_teacher()를 확장.
--    (units/activities/progress/profiles의 교사 정책을 admin이 그대로 획득)
create or replace function public.is_teacher()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('teacher', 'admin')
  );
$$;

-- 3. 관리자 판별 함수
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ===== 0007_ai_prompts.sql =====

-- ============================================================
-- AI 프롬프트 저장 (관리자가 웹에서 수정)
--  값이 없으면 코드의 기본 프롬프트(lib/ai/prompts.ts)를 사용한다.
--  읽기/쓰기 모두 서버(service role)에서만 — 학생·교사에게 노출 불필요.
-- ============================================================

create table public.ai_prompts (
  key        text primary key,
  content    text not null,
  updated_at timestamptz not null default now()
);

alter table public.ai_prompts enable row level security;
-- 정책 없음 = anon/authenticated 접근 불가. service role만 읽고 쓴다.

-- ===== 0008_ai_keys_and_models.sql =====

-- ============================================================
-- AI 제공자 API 키 + 학생이 고를 수 있는 모델 목록 (관리자 관리)
-- ============================================================

-- 1. 제공자별 API 키 (서버 전용 — 절대 클라이언트로 내려가지 않음)
create table public.ai_secrets (
  provider   text primary key check (provider in ('openai', 'gemini', 'anthropic')),
  api_key    text not null,
  updated_at timestamptz not null default now()
);

alter table public.ai_secrets enable row level security;
-- 정책 없음 = anon/authenticated 접근 불가. service role만 읽고 쓴다.

-- 2. 학생이 선택할 수 있는 AI 모델 목록
create table public.ai_models (
  id         uuid primary key default gen_random_uuid(),
  provider   text not null check (provider in ('openai', 'gemini', 'anthropic')),
  model_id   text not null,          -- 예: gpt-5-mini, gemini-2.5-flash, claude-sonnet-5
  label      text not null,          -- 학생에게 보일 이름 (예: "GPT-5 mini (빠름)")
  enabled    boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 모델 ID·이름은 민감정보가 아니므로 로그인 사용자가 목록을 읽을 수 있게 한다
-- (학생이 활동 화면에서 모델을 고르려면 필요). 쓰기는 서버(service role)만.
alter table public.ai_models enable row level security;

create policy "ai_models_read_authenticated" on public.ai_models
  for select to authenticated using (true);

-- ---------- 0009_ai_limits ----------

-- 학생별 AI 일일 사용 한도를 관리자가 웹에서 조정할 수 있게 저장.
-- 행이 없으면 코드 기본값(socratic 20, feedback 10)이 사용된다.
create table if not exists ai_limits (
  feature text primary key check (feature in ('socratic', 'feedback')),
  daily_limit int not null check (daily_limit between 1 and 500),
  updated_at timestamptz not null default now()
);

-- RLS: 정책을 만들지 않음 = service role(서버)만 접근 가능.
-- 한도 값 자체는 비밀이 아니지만, 조작은 서버 API(관리자 가드)로만 한다.
alter table ai_limits enable row level security;


-- ---------- 0010_subjects ----------

-- 0010: 교과(subjects) 계층 추가
-- 구조: 교과(subjects) → 단원(units) → 활동(activities)
-- 학생 화면: 내 교과 → 교과 상세(단원별로 묶인 활동) → 활동
-- 기존 단원은 subject_id 가 null 이어도 그대로 동작한다(교과 미지정 단원).

-- 1) 교과 테이블 -------------------------------------------------------------
-- 중간에 실패해도 다시 실행할 수 있도록 전부 멱등하게 작성한다.
create table if not exists public.subjects (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  grade        int not null,
  order_index  int not null default 0,
  is_published boolean not null default false,
  created_at   timestamptz not null default now()
);

alter table public.subjects enable row level security;

-- 학생은 자기 학년의 공개 교과만, 교사는 전부
drop policy if exists "subjects_student_read_published" on public.subjects;
create policy "subjects_student_read_published"
  on public.subjects for select
  using (is_published and grade = public.my_grade());

drop policy if exists "subjects_teacher_all" on public.subjects;
create policy "subjects_teacher_all"
  on public.subjects for all
  using (public.is_teacher())
  with check (public.is_teacher());

-- 2) 단원에 교과 연결 --------------------------------------------------------
alter table public.units
  add column if not exists subject_id uuid references public.subjects (id) on delete set null;

create index if not exists units_subject_id_idx on public.units (subject_id);

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
drop policy if exists "units_student_read_published" on public.units;
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

-- activities 에는 학생용 SELECT 정책을 두지 않는다(0002 에서 의도적으로 제거함).
-- 학생이 activities 를 직접 읽으면 problem 유형의 정답(answer/tolerance)이 노출되므로,
-- 반드시 정답을 걷어낸 student_activities() RPC 로만 조회하게 한다.

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


-- ---------- 0011_student_owner ----------

-- 0011: 학생을 담당 교사별로 나눠 관리
--
-- 지금까지는 교사면 누구나 모든 학생을 보고 고칠 수 있었다.
-- 여러 교사가 한 사이트를 함께 쓰면 서로의 학생까지 보이므로,
-- "내가 만든 학생은 내 목록에" 가 되도록 담당 교사를 붙인다.
--
--  - 교사: 자기가 만든(담당하는) 학생만 조회·수정·삭제
--  - 관리자: 전체 조회·수정 (담당 교사 재지정 포함)
--  - 학생: 예전처럼 자기 것만

-- 1) 담당 교사 ---------------------------------------------------------------
alter table public.profiles
  add column if not exists teacher_id uuid references public.profiles (id) on delete set null;

create index if not exists profiles_teacher_id_idx on public.profiles (teacher_id);

-- 기존 학생이 아무에게도 안 보이게 되는 일을 막는다.
-- 담당이 비어 있는 학생은 가장 먼저 만들어진 교사/관리자에게 넘긴다.
update public.profiles s
set teacher_id = (
  select p.id from public.profiles p
  where p.role in ('teacher', 'admin')
  order by p.created_at
  limit 1
)
where s.role = 'student' and s.teacher_id is null;

-- 2) 조회 정책 ---------------------------------------------------------------
drop policy if exists "profiles_select_own_or_teacher" on public.profiles;
drop policy if exists "profiles_select_own_or_mine" on public.profiles;

create policy "profiles_select_own_or_mine"
  on public.profiles for select
  using (
    id = auth.uid()                                        -- 본인
    or public.is_admin()                                   -- 관리자는 전부
    or (public.is_teacher() and teacher_id = auth.uid())   -- 내가 담당하는 학생
  );

-- 3) 수정 정책 ---------------------------------------------------------------
-- is_teacher() 는 관리자도 참이므로, 관리자용 정책을 따로 두고 OR 로 합친다.
-- 0001 에서 만든 이름은 profiles_teacher_write 다. 이걸 지우지 않으면
-- "교사면 전부 허용" 정책이 살아남아 OR 로 합쳐지므로 아래 제한이 무의미해진다.
drop policy if exists "profiles_teacher_write" on public.profiles;
drop policy if exists "profiles_teacher_all" on public.profiles;
drop policy if exists "profiles_admin_all" on public.profiles;
drop policy if exists "profiles_teacher_own_students" on public.profiles;

create policy "profiles_admin_all"
  on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());

-- 교사는 자기가 담당하는 학생만 손댈 수 있다.
-- with check 까지 걸어 두어 남의 학생으로 옮겨 가는 것도 막는다.
create policy "profiles_teacher_own_students"
  on public.profiles for all
  using (public.is_teacher() and teacher_id = auth.uid())
  with check (public.is_teacher() and teacher_id = auth.uid());

-- 4) 담당 교사 판별 헬퍼 (서버 API 에서 소유권 확인용) ------------------------
create or replace function public.is_my_student(p_student_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles s
    where s.id = p_student_id
      and s.role = 'student'
      and (public.is_admin() or s.teacher_id = auth.uid())
  );
$$;

revoke all on function public.is_my_student(uuid) from public;
grant execute on function public.is_my_student(uuid) to authenticated;




-- ---------- 0012_screen_responses ----------

-- ============================================================
-- 0012: 활동 "화면별" 기록칸 + 사진 첨부
--
-- 지금까지는 활동 하나에 기록칸이 하나뿐이라(progress.response_text),
-- 여섯 화면을 넘겨도 아래에는 늘 같은 질문이 떠 있었다.
-- 이제 화면마다 다른 질문을 두고, 학생 답도 화면 단위로 저장한다.
--   - 질문이 필요 없는 화면에는 아예 기록칸을 두지 않는다(HTML 에 질문이 없으면 안 뜬다).
--   - 마지막 '자유 기록' 화면과 '확장 탐구' 화면은 사진(공책 촬영)으로도 낼 수 있다.
-- 기존 progress.response_text 는 지우지 않는다(예전에 낸 글 보존).
-- ============================================================

-- 1. 화면별 기록 --------------------------------------------------------------
create table if not exists public.screen_responses (
  student_id  uuid not null references public.profiles (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  screen_key  text not null,                    -- 활동 HTML 의 data-key (예: s3, ext, free)
  prompt      text not null default '',         -- 답할 때 보였던 질문 (나중에 문항이 바뀌어도 맥락 보존)
  text        text not null default '',
  images      text[] not null default '{}',     -- student-uploads 버킷 안의 경로들
  updated_at  timestamptz not null default now(),
  primary key (student_id, activity_id, screen_key)
);

create index if not exists screen_responses_activity_idx
  on public.screen_responses (activity_id);

alter table public.screen_responses enable row level security;

-- 두 번 실행해도 되도록 같은 이름이 있으면 먼저 지운다
drop policy if exists "screen_responses_student_select_own" on public.screen_responses;
drop policy if exists "screen_responses_teacher_all" on public.screen_responses;

-- 학생은 자기 기록만, 교사는 전부(progress 와 같은 원칙).
-- 쓰기는 아래 RPC 로만 하지만, 잘못 열리지 않도록 정책도 좁게 둔다.
create policy "screen_responses_student_select_own"
  on public.screen_responses for select
  using (student_id = auth.uid());

create policy "screen_responses_teacher_all"
  on public.screen_responses for all
  using (public.is_teacher())
  with check (public.is_teacher());

drop trigger if exists screen_responses_set_updated_at on public.screen_responses;
create trigger screen_responses_set_updated_at
before update on public.screen_responses
for each row execute function public.set_updated_at();

-- 2. 저장 RPC ----------------------------------------------------------------
-- 접근 가능한(공개 + 자기 학년 + 자기 반) 활동인지 DB 에서 다시 확인한다.
-- 사진 경로는 반드시 본인 폴더(auth.uid()/...) 안이어야 한다.
create or replace function public.save_screen_response(
  p_activity_id uuid,
  p_screen_key  text,
  p_prompt      text,
  p_text        text,
  p_images      text[] default '{}'
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
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_screen_key is null or length(trim(p_screen_key)) = 0 or length(p_screen_key) > 40 then
    raise exception 'invalid screen key';
  end if;
  if length(v_text) > 4000 then
    raise exception 'text too long';
  end if;
  if array_length(v_imgs, 1) > 5 then
    raise exception 'too many images';
  end if;
  -- 글도 사진도 없으면 저장할 것이 없다
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

  insert into public.screen_responses (student_id, activity_id, screen_key, prompt, text, images)
  values (auth.uid(), p_activity_id, trim(p_screen_key), coalesce(p_prompt, ''), v_text, v_imgs)
  on conflict (student_id, activity_id, screen_key) do update
    set prompt = excluded.prompt,
        text   = excluded.text,
        images = excluded.images,
        updated_at = now();

  -- 글을 남기면 그 활동은 완료로 본다(problem 유형의 채점 결과는 건드리지 않는다)
  insert into public.progress (student_id, activity_id, completed)
  values (auth.uid(), p_activity_id, v_type <> 'problem')
  on conflict (student_id, activity_id) do update
    set completed = progress.completed or (v_type <> 'problem'),
        updated_at = now();
end;
$$;

revoke all on function public.save_screen_response(uuid, text, text, text, text[]) from public;
grant execute on function public.save_screen_response(uuid, text, text, text, text[]) to authenticated;

-- 3. 학생 첨부 사진 저장소 ----------------------------------------------------
-- 비공개 버킷. 경로 규칙: {학생 uuid}/{활동 uuid}/{화면키}-{타임스탬프}.jpg
insert into storage.buckets (id, name, public)
values ('student-uploads', 'student-uploads', false)
on conflict (id) do nothing;

drop policy if exists "student_uploads_insert_own" on storage.objects;
drop policy if exists "student_uploads_select_own_or_teacher" on storage.objects;
drop policy if exists "student_uploads_delete_own_or_teacher" on storage.objects;

create policy "student_uploads_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'student-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "student_uploads_select_own_or_teacher" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'student-uploads'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_teacher())
  );

create policy "student_uploads_delete_own_or_teacher" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'student-uploads'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_teacher())
  );


-- ---------- 0013_activity_screens ----------

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


-- ---------- 0014_ai_authoring ----------

-- 교사용 '조작 활동 만들기' 챗봇을 AI 기능 목록에 추가한다.
--
--  ai_usage.feature 은 text 이고 제약이 없어 그대로 쓸 수 있지만,
--  ai_limits 는 check 로 두 기능만 허용하고 있어 넓혀 준다.
--  (한도를 관리자 화면에서 조절할 수 있어야 하므로)

alter table ai_limits drop constraint if exists ai_limits_feature_check;
alter table ai_limits
  add constraint ai_limits_feature_check
  check (feature in ('socratic', 'feedback', 'authoring'));

-- 기본 한도: 교사 하루 40회. 실수로 무한 호출되는 것을 막는 안전장치다.
insert into ai_limits (feature, daily_limit)
values ('authoring', 40)
on conflict (feature) do nothing;


-- ---------- 0015_ai_usage_authoring ----------

-- 0014 에서 ai_limits 만 넓히고 ai_usage 를 빠뜨렸다.
--
-- ai_usage.feature 에도 같은 check 가 걸려 있어(0003 에서 컬럼과 함께 추가),
-- 제작 챗봇을 쓰면 사용량을 기록하다가
--   new row for relation "ai_usage" violates check constraint "ai_usage_feature_check"
-- 로 터진다. 실제로 500 이 났다.

alter table public.ai_usage drop constraint if exists ai_usage_feature_check;
alter table public.ai_usage
  add constraint ai_usage_feature_check
  check (feature in ('socratic', 'feedback', 'authoring'));


-- ---------- 0016_teacher_students ----------

-- 0016: 담당 학생을 여러 교사가 나눠 가질 수 있게
--
-- 0011 은 학생 한 명에 담당 교사 하나만 두었다 (profiles.teacher_id).
-- 그래서 관리자가 학생을 일괄 등록하면 그 학생은 전부 관리자의 것이 되고,
-- 교사 화면에는 끝내 나타나지 않는다. 교사가 가져올 방법도 없었다.
-- 한 학생을 교과 교사와 담임이 함께 보는 경우도 담지 못한다.
--
-- 담당 관계를 teacher_students 표로 옮긴다.
--  - 교사: 서버에 등록된 전체 학생 명단을 보고, 그중 골라 자기 목록에 담는다
--  - 한 학생이 여러 교사의 목록에 동시에 있어도 된다
--  - profiles.teacher_id 는 남기되 뜻이 바뀐다: "이 계정을 만든 사람"
--    담당(목록에 담김)과 달리 계정 삭제 권한의 근거로만 쓴다.

-- 1) 담당 표 -----------------------------------------------------------------
create table if not exists public.teacher_students (
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (teacher_id, student_id)
);

-- "이 학생을 담당하는 교사들" 조회용 (관리자 화면)
create index if not exists teacher_students_student_id_idx
  on public.teacher_students (student_id);

-- 지금 있는 담당 관계를 그대로 옮긴다 — 아무도 목록을 잃지 않게.
insert into public.teacher_students (teacher_id, student_id)
select s.teacher_id, s.id
from public.profiles s
where s.role = 'student'
  and s.teacher_id is not null
on conflict do nothing;

-- 2) 헬퍼 -------------------------------------------------------------------
-- security definer: 정책 안에서 표를 다시 읽을 때 생기는 무한재귀를 막는다.

-- 로그인한 교사가 이 학생을 자기 목록에 담고 있는가
create or replace function public.teaches_student(p_student_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.teacher_students ts
    where ts.student_id = p_student_id
      and ts.teacher_id = auth.uid()
  );
$$;

-- 이 id 가 학생 계정인가 (교사를 학생으로 담는 것을 막는 데 쓴다)
create or replace function public.is_student_profile(p_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = p_id and role = 'student'
  );
$$;

revoke all on function public.teaches_student(uuid) from public;
revoke all on function public.is_student_profile(uuid) from public;
grant execute on function public.teaches_student(uuid) to authenticated;
grant execute on function public.is_student_profile(uuid) to authenticated;

-- 0011 이 만든 판별 함수도 담당 표를 보게 바꾼다 (뜻은 그대로)
create or replace function public.is_my_student(p_student_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles s
    where s.id = p_student_id
      and s.role = 'student'
      and (public.is_admin() or public.teaches_student(s.id))
  );
$$;

-- 3) 담당 표의 보안 정책 -----------------------------------------------------
alter table public.teacher_students enable row level security;

drop policy if exists "teacher_students_admin_all" on public.teacher_students;
drop policy if exists "teacher_students_own" on public.teacher_students;

create policy "teacher_students_admin_all"
  on public.teacher_students for all
  using (public.is_admin())
  with check (public.is_admin() and public.is_student_profile(student_id));

-- 교사는 자기 줄만 넣고 뺀다. 남의 목록은 읽지도 고치지도 못한다.
create policy "teacher_students_own"
  on public.teacher_students for all
  using (public.is_teacher() and teacher_id = auth.uid())
  with check (
    public.is_teacher()
    and teacher_id = auth.uid()
    and public.is_student_profile(student_id)
  );

-- 4) profiles 정책을 담당 표 기준으로 -----------------------------------------
-- 0011 의 정책은 teacher_id 컬럼을 직접 보고 있었다. 담당 표를 보도록 갈아 끼운다.
drop policy if exists "profiles_select_own_or_mine" on public.profiles;

create policy "profiles_select_own_or_mine"
  on public.profiles for select
  using (
    id = auth.uid()                                          -- 본인
    or public.is_admin()                                     -- 관리자는 전부
    or (public.is_teacher() and public.teaches_student(id))  -- 내 목록에 담은 학생
  );

-- 0011 의 쓰기 정책은 for all 이라 삭제까지 열려 있었다. 담당이 하나뿐일 때는
-- 그래도 됐지만, 이제는 학생을 담기만 하면 남의 학생 프로필을 지울 수 있게 된다.
-- 프로필 생성·삭제는 앱에서 전부 service role 로만 하므로 교사에게는 수정만 준다.
-- (계정 삭제는 서버 API 가 "만든 사람인지" 확인한 뒤 auth 쪽에서 처리한다)
drop policy if exists "profiles_teacher_own_students" on public.profiles;
drop policy if exists "profiles_teacher_update_mine" on public.profiles;

create policy "profiles_teacher_update_mine"
  on public.profiles for update
  using (public.is_teacher() and public.teaches_student(id))
  with check (public.is_teacher() and public.teaches_student(id));

-- 5) 전체 학생 명단 -----------------------------------------------------------
-- 담당이 아니어도 보여야 하므로 위 정책으로는 안 되고, 함수로 따로 연다.
-- 내려보내는 것은 명렬표에 있는 값(학년·반·번호·이름)까지다.
-- 비밀번호 상태나 다른 교사의 담당 여부 같은 것은 담지 않는다.
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
  order by p.grade, p.class_no, p.student_no;
$$;

revoke all on function public.all_students() from public;
grant execute on function public.all_students() to authenticated;


-- ---------- 0017_open_platform ----------

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


-- ===== 0018_hands_on_levels.sql =====

-- ============================================================
-- 0018 만져보는 수학 — 학교급 메뉴 + 중학교 '작도'
--  1) manipulatives.school_level: 초등학교(elementary) · 중학교(middle) · 고등학교(high)
--     목록·교사 화면·활동 가져오기 창이 이 값으로 메뉴를 나눈다.
--     지금 있는 예시 4개(도형의 방정식)는 고등학교로 들어간다.
--  2) 중학교 '작도'에 자유 작도(눈금 없는 자와 컴퍼스)를 넣는다.
--     HTML 원본은 content/hands-on/compass-straightedge.html,
--     아래 insert 는 scripts/build-hands-on-sql.mjs 가 만든 것과 같다.
-- 0017 다음에 실행하세요. 여러 번 실행해도 안전합니다.
-- ============================================================

alter table public.manipulatives
  add column if not exists school_level text not null default 'high'
  check (school_level in ('elementary', 'middle', 'high'));

create index if not exists manipulatives_level_idx
  on public.manipulatives (school_level, topic, order_index);

-- 자유 작도 — 눈금 없는 자와 컴퍼스  (원본: content/hands-on/compass-straightedge.html)
insert into public.manipulatives
  (slug, title, summary, topic, school_level, order_index, type, config, is_published, owner_id)
values (
  'compass-straightedge',
  '자유 작도 — 눈금 없는 자와 컴퍼스',
  '자를 고정해 가장자리로 곧은 선을, 컴퍼스 침을 고정하고 연필을 돌려 원을 그립니다. 끝없이 넓은 종이에서 확대·축소하며 작도해 보세요.',
  '작도', 'middle', 1, 'html',
  jsonb_build_object('height', 660, 'html', $hands_on$<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>자유 작도 — 눈금 없는 자와 컴퍼스</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif; color: #1f2937; }
  #app { height: 660px; display: flex; flex-direction: column; user-select: none; -webkit-user-select: none; }
  #bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px; border-bottom: 1px solid #e5e7eb; background: #f9fafb; }
  .grp { display: flex; align-items: center; gap: 4px; padding-right: 6px; margin-right: 2px; border-right: 1px solid #e5e7eb; }
  .grp:last-child { border-right: 0; }
  button { font: inherit; font-size: 13px; border: 1px solid #d1d5db; background: #fff; color: #374151; border-radius: 8px; padding: 6px 9px; cursor: pointer; line-height: 1; white-space: nowrap; }
  button:hover { background: #f3f4f6; }
  button.on { background: #2563eb; border-color: #2563eb; color: #fff; }
  button.lock.on { background: #f59e0b; border-color: #f59e0b; color: #fff; }
  button:disabled { opacity: .4; cursor: default; }
  button.warn { border-color: #fca5a5; color: #b91c1c; }
  .dot { width: 22px; height: 22px; padding: 0; border-radius: 999px; border: 2px solid #fff; box-shadow: 0 0 0 1px #d1d5db; }
  .dot.on { box-shadow: 0 0 0 2px #2563eb; }
  #stage { position: relative; flex: 1; overflow: hidden; touch-action: none; background: #fdfdfb; }
  #cv { position: absolute; inset: 0; display: block; }
  #hint { position: absolute; left: 10px; bottom: 10px; max-width: min(560px, calc(100% - 190px)); background: rgba(255,255,255,.92); border: 1px solid #e5e7eb; border-radius: 10px; padding: 7px 10px; font-size: 12.5px; line-height: 1.5; color: #374151; pointer-events: none; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
  #zoom { position: absolute; right: 10px; bottom: 10px; display: flex; gap: 4px; align-items: center; background: rgba(255,255,255,.92); border: 1px solid #e5e7eb; border-radius: 10px; padding: 4px; }
  #zoom button { padding: 5px 8px; }
  #zv { min-width: 46px; text-align: center; font-size: 12px; color: #4b5563; }
  @media (max-width: 560px) { #hint { max-width: calc(100% - 20px); bottom: 56px; } button { padding: 6px 7px; } }
</style>
</head>
<body>
<div id="app">
  <div id="bar">
    <div class="grp">
      <button data-mode="hand" title="화면 이동 (스페이스바를 누른 채 끌어도 됩니다)">✋ 이동</button>
      <button data-mode="pen" class="on" title="펜으로 긋기">✏️ 펜</button>
      <button data-mode="point" title="점 찍기">• 점</button>
      <button data-mode="erase" title="지우개 — 지울 선이나 점을 누르거나 문지르세요">🧽 지우개</button>
    </div>
    <div class="grp">
      <button id="bRuler" class="on" title="눈금 없는 자 꺼내기/넣기">📏 자</button>
      <button id="bRulerLock" class="lock" title="자를 움직이지 않게 고정 — 고정하면 가장자리를 따라 곧은 선이 그어집니다">🔒 자 고정</button>
      <button id="bComp" class="on" title="컴퍼스 꺼내기/넣기">🧭 컴퍼스</button>
      <button id="bPin" class="lock" title="컴퍼스 침 고정 — 고정한 뒤 연필 끝을 끌면 원이 그려집니다">📌 침 고정</button>
    </div>
    <div class="grp" id="colors"></div>
    <div class="grp">
      <button id="bUndo" title="되돌리기 (Ctrl+Z)">↶</button>
      <button id="bRedo" title="다시 하기 (Ctrl+Shift+Z)">↷</button>
      <button id="bGrid" title="격자 보이기">격자</button>
      <button id="bClear" class="warn" title="그린 것 모두 지우기">모두 지우기</button>
    </div>
  </div>
  <div id="stage">
    <canvas id="cv"></canvas>
    <div id="hint"></div>
    <div id="zoom">
      <button id="zOut" title="축소">−</button>
      <span id="zv">100%</span>
      <button id="zIn" title="확대">+</button>
      <button id="zHome" title="처음 보기로">⌖</button>
    </div>
  </div>
</div>
<script>
(function () {
  "use strict";
  var TAU = Math.PI * 2;
  var cv = document.getElementById("cv");
  var ctx = cv.getContext("2d");
  var stage = document.getElementById("stage");
  var hintEl = document.getElementById("hint");
  var W = 0, H = 0, DPR = 1;

  // ── 보기(무한 캔버스) — 화면좌표 = (세계좌표 - o) × z ─────────────
  var V = { ox: 0, oy: 0, z: 1 };
  var ZMIN = 0.08, ZMAX = 10;

  // ── 상태 ─────────────────────────────────────────────────────
  var S = { mode: "pen", color: "#111827", grid: false, objs: [], hist: [], fut: [], ver: 0, focus: "compass" };
  var COLORS = [["#111827", "검정"], ["#2563eb", "파랑"], ["#dc2626", "빨강"], ["#059669", "초록"]];
  // 눈금 없는 자: 중심(x,y), 각 a, 길이·폭은 실제 물건처럼 고정
  var R = { on: true, x: 0, y: 175, a: 0, len: 680, wid: 58, fixed: false };
  // 컴퍼스: 침(nx,ny), 벌린 거리 r, 방향 a(침→연필), 다리 길이 LEG
  var LEG = 230, MAXR = LEG * 2 * 0.95, MINR = 3;
  var C = { on: true, nx: -150, ny: 40, r: 170, a: 0, pinned: false, flip: false };

  var op = null;        // 지금 하는 조작
  var preview = null;   // 그리는 중인 선
  var snapMark = null;  // 붙는 점 표시
  var edgeHot = null;   // 펜이 닿을 자의 가장자리 (+1/-1)
  var pointers = new Map();
  var pinch = null;
  var spaceDown = false;

  // ── 수학 도우미 ───────────────────────────────────────────────
  function d2(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  function wrap(t) { while (t > Math.PI) t -= TAU; while (t <= -Math.PI) t += TAU; return t; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function segDist(p, a, b) {
    var vx = b.x - a.x, vy = b.y - a.y, L = vx * vx + vy * vy;
    var t = L ? clamp(((p.x - a.x) * vx + (p.y - a.y) * vy) / L, 0, 1) : 0;
    return d2(p, { x: a.x + vx * t, y: a.y + vy * t });
  }
  function toWorld(sx, sy) { return { x: sx / V.z + V.ox, y: sy / V.z + V.oy }; }
  function px(n) { return n / V.z; } // 화면 n픽셀을 세계 길이로

  // ── 자 ────────────────────────────────────────────────────────
  function rAxes() { var c = Math.cos(R.a), s = Math.sin(R.a); return { ux: c, uy: s, vx: -s, vy: c }; }
  function rLocal(p) { var A = rAxes(), dx = p.x - R.x, dy = p.y - R.y; return { u: dx * A.ux + dy * A.uy, v: dx * A.vx + dy * A.vy }; }
  function rWorld(u, v) { var A = rAxes(); return { x: R.x + A.ux * u + A.vx * v, y: R.y + A.uy * u + A.vy * v }; }
  function rKnob() { return rWorld(R.len / 2 - 30, 0); }
  function rHit(p) { var L = rLocal(p); return Math.abs(L.u) <= R.len / 2 && Math.abs(L.v) <= R.wid / 2; }
  // 펜이 가장자리 가까이 있는가 → 어느 쪽 가장자리, 가장자리 위의 위치 u
  function rNearEdge(p, tol) {
    var L = rLocal(p);
    if (Math.abs(L.u) > R.len / 2 + tol) return null;
    var best = null;
    [1, -1].forEach(function (sg) {
      var dist = Math.abs(L.v - sg * R.wid / 2);
      if (dist < tol && (!best || dist < best.dist)) best = { sign: sg, u: clamp(L.u, -R.len / 2, R.len / 2), dist: dist };
    });
    return best;
  }

  // ── 컴퍼스 ────────────────────────────────────────────────────
  function cPen() { return { x: C.nx + C.r * Math.cos(C.a), y: C.ny + C.r * Math.sin(C.a) }; }
  function cNormal() { var n = { x: Math.sin(C.a), y: -Math.cos(C.a) }; return C.flip ? { x: -n.x, y: -n.y } : n; }
  function cHinge() {
    var P = cPen(), n = cNormal(), h = Math.sqrt(Math.max(LEG * LEG - (C.r / 2) * (C.r / 2), 0));
    return { x: (C.nx + P.x) / 2 + n.x * h, y: (C.ny + P.y) / 2 + n.y * h };
  }
  function cKnob() { var Hh = cHinge(), n = cNormal(); return { x: Hh.x + n.x * 56, y: Hh.y + n.y * 56 }; }
  // 세워 놓을 때는 경첩이 화면 위쪽으로 오게 (돌리는 중에는 바꾸지 않아 부드럽게 돈다)
  function cUpright() { C.flip = Math.cos(C.a) < 0; }

  // ── 붙는 점: 찍은 점·선분 끝점·원의 중심·교점 ───────────────────
  var snapCache = { ver: -1, pts: [] };
  function inArc(o, th) {
    var span = o.a1 - o.a0;
    if (Math.abs(span) >= TAU - 1e-6) return true;
    var d = th - o.a0;
    if (span >= 0) { d = ((d % TAU) + TAU) % TAU; return d <= span + 1e-6; }
    d = ((-d % TAU) + TAU) % TAU; return d <= -span + 1e-6;
  }
  function onSeg(o, p) { return segDist(p, { x: o.x1, y: o.y1 }, { x: o.x2, y: o.y2 }) < 1e-4 * Math.max(1, d2({ x: o.x1, y: o.y1 }, { x: o.x2, y: o.y2 })); }
  function interLL(a, b) {
    var x1 = a.x1, y1 = a.y1, x2 = a.x2, y2 = a.y2, x3 = b.x1, y3 = b.y1, x4 = b.x2, y4 = b.y2;
    var den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(den) < 1e-9) return [];
    var t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
    var u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;
    if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) return [];
    return [{ x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) }];
  }
  function interLC(s, c) {
    var dx = s.x2 - s.x1, dy = s.y2 - s.y1, fx = s.x1 - c.cx, fy = s.y1 - c.cy;
    var A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), Cc = fx * fx + fy * fy - c.r * c.r;
    var disc = B * B - 4 * A * Cc, out = [];
    if (A < 1e-12 || disc < 0) return out;
    var sq = Math.sqrt(disc);
    [(-B - sq) / (2 * A), (-B + sq) / (2 * A)].forEach(function (t) {
      if (t < -1e-6 || t > 1 + 1e-6) return;
      var p = { x: s.x1 + t * dx, y: s.y1 + t * dy };
      if (inArc(c, Math.atan2(p.y - c.cy, p.x - c.cx))) out.push(p);
    });
    return out;
  }
  function interCC(a, b) {
    var dx = b.cx - a.cx, dy = b.cy - a.cy, d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1e-9 || d > a.r + b.r + 1e-9 || d < Math.abs(a.r - b.r) - 1e-9) return [];
    var l = (a.r * a.r - b.r * b.r + d * d) / (2 * d), h = Math.sqrt(Math.max(a.r * a.r - l * l, 0));
    var mx = a.cx + dx * l / d, my = a.cy + dy * l / d, out = [];
    [[mx + h * dy / d, my - h * dx / d], [mx - h * dy / d, my + h * dx / d]].forEach(function (q, i) {
      if (i === 1 && h < 1e-9) return;
      var p = { x: q[0], y: q[1] };
      if (inArc(a, Math.atan2(p.y - a.cy, p.x - a.cx)) && inArc(b, Math.atan2(p.y - b.cy, p.x - b.cx))) out.push(p);
    });
    return out;
  }
  function snapPoints() {
    if (snapCache.ver === S.ver) return snapCache.pts;
    var pts = [], segs = [], arcs = [];
    S.objs.forEach(function (o) {
      if (o.t === "pt") pts.push({ x: o.x, y: o.y });
      else if (o.t === "seg") { segs.push(o); pts.push({ x: o.x1, y: o.y1 }, { x: o.x2, y: o.y2 }); }
      else if (o.t === "arc") {
        arcs.push(o); pts.push({ x: o.cx, y: o.cy });
        if (Math.abs(o.a1 - o.a0) < TAU - 1e-6) {
          pts.push({ x: o.cx + o.r * Math.cos(o.a0), y: o.cy + o.r * Math.sin(o.a0) });
          pts.push({ x: o.cx + o.r * Math.cos(o.a1), y: o.cy + o.r * Math.sin(o.a1) });
        }
      }
    });
    var i, j;
    for (i = 0; i < segs.length; i++) for (j = i + 1; j < segs.length; j++) pts.push.apply(pts, interLL(segs[i], segs[j]));
    for (i = 0; i < segs.length; i++) for (j = 0; j < arcs.length; j++) pts.push.apply(pts, interLC(segs[i], arcs[j]));
    for (i = 0; i < arcs.length; i++) for (j = i + 1; j < arcs.length; j++) pts.push.apply(pts, interCC(arcs[i], arcs[j]));
    snapCache = { ver: S.ver, pts: pts };
    return pts;
  }
  function findSnap(p, tolPx, except) {
    var tol = px(tolPx), best = null, bd = tol;
    snapPoints().forEach(function (q) {
      if (except && d2(q, except) < 1e-6) return;
      var d = d2(p, q);
      if (d < bd) { bd = d; best = q; }
    });
    return best;
  }

  // ── 기록(되돌리기) ────────────────────────────────────────────
  function commit(next) { S.hist.push(S.objs); if (S.hist.length > 200) S.hist.shift(); S.objs = next; S.fut = []; S.ver++; syncButtons(); }
  function addObj(o) { commit(S.objs.concat([o])); }
  function undo() { if (!S.hist.length) return; S.fut.push(S.objs); S.objs = S.hist.pop(); S.ver++; syncButtons(); draw(); }
  function redo() { if (!S.fut.length) return; S.hist.push(S.objs); S.objs = S.fut.pop(); S.ver++; syncButtons(); draw(); }
  function nextLabel() {
    var used = {};
    S.objs.forEach(function (o) { if (o.t === "pt") used[o.label] = 1; });
    var abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (var k = 0; k < 10; k++) for (var i = 0; i < abc.length; i++) {
      var l = abc[i] + (k ? String(k) : "");
      if (!used[l]) return l;
    }
    return "P";
  }

  // ── 지우개 ────────────────────────────────────────────────────
  function hitObj(o, p, tol) {
    if (o.t === "pt") return d2(o, p) < tol + px(4);
    if (o.t === "seg") return segDist(p, { x: o.x1, y: o.y1 }, { x: o.x2, y: o.y2 }) < tol;
    if (o.t === "arc") return Math.abs(d2(p, { x: o.cx, y: o.cy }) - o.r) < tol && inArc(o, Math.atan2(p.y - o.cy, p.x - o.cx));
    if (o.t === "free") {
      for (var i = 1; i < o.pts.length; i++) if (segDist(p, { x: o.pts[i - 1][0], y: o.pts[i - 1][1] }, { x: o.pts[i][0], y: o.pts[i][1] }) < tol) return true;
      return o.pts.length === 1 && d2(p, { x: o.pts[0][0], y: o.pts[0][1] }) < tol;
    }
    return false;
  }
  function eraseAt(p) {
    var tol = px(9), keep = S.objs.filter(function (o) { return !hitObj(o, p, tol); });
    if (keep.length !== S.objs.length) { S.objs = keep; S.ver++; op.changed = true; }
  }
  // 빠르게 문질러도 사이를 건너뛰지 않도록 지나온 길을 촘촘히 훑는다
  function eraseAlong(a, b) {
    var n = Math.max(1, Math.ceil(d2(a, b) / px(4)));
    for (var i = 1; i <= n; i++) eraseAt({ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n });
  }

  // ── 그리기 ────────────────────────────────────────────────────
  var queued = false;
  function draw() { if (!queued) { queued = true; requestAnimationFrame(render); } }

  function render() {
    queued = false;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = "#fdfdfb";
    ctx.fillRect(0, 0, W, H);
    if (S.grid) drawGrid();
    ctx.setTransform(DPR * V.z, 0, 0, DPR * V.z, -V.ox * V.z * DPR, -V.oy * V.z * DPR);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    // 자는 투명 아크릴이라 그린 선이 비쳐 보여야 한다 — 자를 먼저 깔고 그 위에 선을 그린다
    if (R.on) drawRuler();
    S.objs.forEach(function (o) { if (o.t !== "pt") drawObj(o); });
    if (preview) drawObj(preview);
    S.objs.forEach(function (o) { if (o.t === "pt") drawObj(o); });
    if (C.on) drawCompass();
    if (snapMark) {
      ctx.strokeStyle = "#e11d48"; ctx.lineWidth = px(2);
      ctx.beginPath(); ctx.arc(snapMark.x, snapMark.y, px(8), 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(snapMark.x - px(12), snapMark.y); ctx.lineTo(snapMark.x + px(12), snapMark.y);
      ctx.moveTo(snapMark.x, snapMark.y - px(12)); ctx.lineTo(snapMark.x, snapMark.y + px(12)); ctx.stroke();
    }
    document.getElementById("zv").textContent = Math.round(V.z * 100) + "%";
  }

  function drawGrid() {
    var step = 50; while (step * V.z < 22) step *= 2; while (step * V.z > 90) step /= 2;
    var x0 = Math.floor(V.ox / step) * step, y0 = Math.floor(V.oy / step) * step;
    ctx.fillStyle = "#d4d4d8";
    for (var x = x0; x < V.ox + W / V.z; x += step)
      for (var y = y0; y < V.oy + H / V.z; y += step)
        ctx.fillRect((x - V.ox) * V.z - 1, (y - V.oy) * V.z - 1, 2, 2);
  }

  function drawObj(o) {
    ctx.strokeStyle = o.c || "#111827";
    ctx.lineWidth = px(o.w || 2.2);
    if (o.t === "seg") { ctx.beginPath(); ctx.moveTo(o.x1, o.y1); ctx.lineTo(o.x2, o.y2); ctx.stroke(); }
    else if (o.t === "arc") { ctx.beginPath(); ctx.arc(o.cx, o.cy, o.r, o.a0, o.a1, o.a1 < o.a0); ctx.stroke(); }
    else if (o.t === "free") {
      var p = o.pts; ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
      if (p.length === 1) ctx.lineTo(p[0][0] + 0.01, p[0][1]);
      for (var i = 1; i < p.length - 1; i++) ctx.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
      if (p.length > 1) ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
      ctx.stroke();
    } else if (o.t === "pt") {
      ctx.fillStyle = o.c || "#111827";
      ctx.beginPath(); ctx.arc(o.x, o.y, px(4), 0, TAU); ctx.fill();
      ctx.font = "600 " + px(15) + "px -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
      ctx.fillText(o.label, o.x + px(7), o.y - px(7));
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }

  // 눈금 없는 자 — 반투명 아크릴 판. 눈금이 없다.
  function drawRuler() {
    var L = R.len, Wd = R.wid;
    ctx.save();
    ctx.translate(R.x, R.y); ctx.rotate(R.a);
    ctx.shadowColor = "rgba(15,23,42,.18)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
    roundRect(-L / 2, -Wd / 2, L, Wd, 7);
    var g = ctx.createLinearGradient(0, -Wd / 2, 0, Wd / 2);
    g.addColorStop(0, "rgba(224,242,254,.88)"); g.addColorStop(.5, "rgba(186,230,253,.72)"); g.addColorStop(1, "rgba(147,214,250,.78)");
    ctx.fillStyle = g; ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.lineWidth = px(R.fixed ? 2.6 : 1.4);
    ctx.strokeStyle = R.fixed ? "#f59e0b" : "rgba(3,105,161,.75)";
    ctx.stroke();
    // 아크릴 두께감
    ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = px(1.5);
    ctx.beginPath(); ctx.moveTo(-L / 2 + 8, -Wd / 2 + 4); ctx.lineTo(L / 2 - 8, -Wd / 2 + 4); ctx.stroke();
    ctx.strokeStyle = "rgba(3,105,161,.25)";
    ctx.beginPath(); ctx.moveTo(-L / 2 + 8, Wd / 2 - 4); ctx.lineTo(L / 2 - 8, Wd / 2 - 4); ctx.stroke();
    // 펜이 닿을 가장자리
    if (edgeHot) {
      ctx.strokeStyle = S.color; ctx.globalAlpha = .45; ctx.lineWidth = px(5);
      ctx.beginPath(); ctx.moveTo(-L / 2, edgeHot * Wd / 2); ctx.lineTo(L / 2, edgeHot * Wd / 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = "rgba(3,105,161,.32)";
    ctx.font = "600 13px -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("눈금 없는 자", -40, 0);
    var kx = L / 2 - 30;
    if (!R.fixed) {
      ctx.fillStyle = "rgba(255,255,255,.95)"; ctx.strokeStyle = "rgba(3,105,161,.8)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(kx, 0, 15, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "#0369a1"; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(kx, 0, 8, -2.6, 1.9); ctx.stroke();
      var ax = kx + 8 * Math.cos(1.9), ay = 8 * Math.sin(1.9);
      ctx.fillStyle = "#0369a1"; ctx.beginPath(); ctx.moveTo(ax - 5, ay - 1); ctx.lineTo(ax + 3, ay + 4); ctx.lineTo(ax + 2, ay - 5); ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = "#f59e0b"; roundRect(kx - 9, -3, 18, 14, 3); ctx.fill();
      ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.arc(kx, -3, 6, Math.PI, 0); ctx.stroke();
    }
    ctx.restore();
  }

  function taper(a, b, wa, wb, fill, stroke) {
    var dx = b.x - a.x, dy = b.y - a.y, L = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / L, ny = dx / L;
    ctx.beginPath();
    ctx.moveTo(a.x + nx * wa, a.y + ny * wa); ctx.lineTo(b.x + nx * wb, b.y + ny * wb);
    ctx.lineTo(b.x - nx * wb, b.y - ny * wb); ctx.lineTo(a.x - nx * wa, a.y - ny * wa); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.2; ctx.stroke(); }
  }
  function along(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
  function toward(a, b, len) { var L = d2(a, b) || 1; return { x: a.x + (b.x - a.x) * len / L, y: a.y + (b.y - a.y) * len / L }; }

  // 컴퍼스 — 침 다리, 연필 다리, 경첩, 손잡이
  function drawCompass() {
    var N = { x: C.nx, y: C.ny }, P = cPen(), Hh = cHinge(), K = cKnob();
    ctx.save();
    ctx.shadowColor = "rgba(15,23,42,.22)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
    // 손잡이
    taper(Hh, K, 5, 5, "#64748b", "#334155");
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#475569"; ctx.beginPath(); ctx.arc(K.x, K.y, 10, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 1;
    for (var i = 1; i <= 3; i++) { var q = along(Hh, K, 0.25 * i), r = toward(q, { x: q.x + (K.y - Hh.y), y: q.y - (K.x - Hh.x) }, 4.5); ctx.beginPath(); ctx.moveTo(2 * q.x - r.x, 2 * q.y - r.y); ctx.lineTo(r.x, r.y); ctx.stroke(); }
    // 침 다리
    var Nn = toward(N, Hh, 22);
    taper(Hh, Nn, 7.5, 3.6, "#94a3b8", "#475569");
    ctx.strokeStyle = "#1f2937"; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(Nn.x, Nn.y); ctx.lineTo(N.x, N.y); ctx.stroke();
    // 연필 다리: 금속 → 고정 고리 → 연필 몸통 → 나무 → 심
    var A1 = along(Hh, P, 0.5), B1 = toward(P, Hh, 30), T1 = toward(P, Hh, 8);
    taper(Hh, A1, 7.5, 5.5, "#94a3b8", "#475569");
    taper(toward(A1, Hh, 4), toward(A1, P, 8), 7.5, 7.5, "#334155");
    taper(toward(A1, P, 8), B1, 5.5, 5.5, "#fbbf24", "#b45309");
    taper(B1, T1, 5.5, 2, "#f1d5a8", "#b45309");
    taper(T1, P, 2, 0.3, C.pinned ? S.color : "#1f2937");
    // 경첩
    var g = ctx.createRadialGradient(Hh.x - 4, Hh.y - 4, 2, Hh.x, Hh.y, 14);
    g.addColorStop(0, "#f8fafc"); g.addColorStop(.6, "#94a3b8"); g.addColorStop(1, "#475569");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(Hh.x, Hh.y, 13, 0, TAU); ctx.fill();
    ctx.fillStyle = "#334155"; ctx.beginPath(); ctx.arc(Hh.x, Hh.y, 3, 0, TAU); ctx.fill();
    ctx.restore();
    // 침 고정 표시 · 끌 수 있는 곳 표시 (화면 크기 고정)
    if (C.pinned) {
      ctx.strokeStyle = "#dc2626"; ctx.lineWidth = px(2.2);
      ctx.beginPath(); ctx.arc(N.x, N.y, px(7), 0, TAU); ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(37,99,235,.18)"; ctx.beginPath(); ctx.arc(N.x, N.y, px(9), 0, TAU); ctx.fill();
    }
    ctx.fillStyle = C.pinned ? "rgba(220,38,38,.16)" : "rgba(245,158,11,.22)";
    ctx.beginPath(); ctx.arc(P.x, P.y, px(11), 0, TAU); ctx.fill();
  }

  // ── 보기 조작 ─────────────────────────────────────────────────
  function zoomAt(sx, sy, f) {
    var z = clamp(V.z * f, ZMIN, ZMAX), w = toWorld(sx, sy);
    V.z = z; V.ox = w.x - sx / z; V.oy = w.y - sy / z; draw();
  }
  // 처음 보기: 큰 화면은 100%, 좁은 화면(휴대폰·작은 창)은 자와 컴퍼스가 다 보이게 줄인다
  function fitZoom(w, h) { return clamp(Math.min(w / 760, h / 600), 0.35, 1); }
  function home() { V.z = fitZoom(W, H); V.ox = -W / 2 / V.z; V.oy = -H / 2 / V.z + 20; draw(); }

  function resize() {
    var r = stage.getBoundingClientRect(), nw = Math.max(r.width, 10), nh = Math.max(r.height, 10);
    if (!W) { V.z = fitZoom(nw, nh); V.ox = -nw / 2 / V.z; V.oy = -nh / 2 / V.z + 20; }
    else { var cx = V.ox + W / 2 / V.z, cy = V.oy + H / 2 / V.z; V.ox = cx - nw / 2 / V.z; V.oy = cy - nh / 2 / V.z; }
    W = nw; H = nh; DPR = window.devicePixelRatio || 1;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    cv.style.width = W + "px"; cv.style.height = H + "px";
    draw();
  }

  // ── 입력 ──────────────────────────────────────────────────────
  function local(e) { var r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  function begin(e, s) {
    var p = toWorld(s.x, s.y), tol = px(16);
    if (e.button === 1 || spaceDown) { op = { k: "pan", sx: s.x, sy: s.y, ox: V.ox, oy: V.oy }; return; }

    // 컴퍼스가 위에 있으니 먼저 본다
    if (C.on) {
      var P = cPen(), N = { x: C.nx, y: C.ny }, Hh = cHinge(), K = cKnob();
      var aNow = Math.atan2(p.y - C.ny, p.x - C.nx);
      if (d2(p, P) < Math.max(tol, 12)) {
        S.focus = "compass";
        if (C.pinned) { op = { k: "cdraw", a0: C.a, last: aNow, acc: 0 }; preview = { t: "arc", cx: C.nx, cy: C.ny, r: C.r, a0: C.a, a1: C.a, c: S.color }; }
        else op = { k: "copen" };
        return;
      }
      // 침이 고정돼 있으면 침 끝은 잡지 않는다 — 그 점에서 자로 선을 시작할 수 있게
      if (!C.pinned && d2(p, N) < Math.max(tol, 10)) { S.focus = "compass"; op = { k: "cmove", p0: p, n0: N }; return; }
      var nearPinned = C.pinned && d2(p, N) < Math.max(tol, 12);
      var onBody = !nearPinned && (d2(p, K) < Math.max(tol, 14) || segDist(p, Hh, K) < Math.max(px(9), 6) || d2(p, Hh) < Math.max(tol, 15) ||
        segDist(p, Hh, N) < Math.max(px(9), 8) || segDist(p, Hh, P) < Math.max(px(9), 8));
      if (onBody) {
        S.focus = "compass";
        op = C.pinned ? { k: "crot", off: wrap(aNow - C.a) } : { k: "cmove", p0: p, n0: N };
        return;
      }
    }
    if (R.on) {
      if (R.fixed && S.mode === "pen") {
        var ne = rNearEdge(p, px(18));
        if (ne) {
          S.focus = "ruler";
          var u0 = snapU(ne.sign, ne.u);
          op = { k: "rline", sign: ne.sign, u0: u0 };
          var a = rWorld(u0, ne.sign * R.wid / 2);
          preview = { t: "seg", x1: a.x, y1: a.y, x2: a.x, y2: a.y, c: S.color };
          return;
        }
      }
      if (!R.fixed) {
        if (d2(p, rKnob()) < Math.max(px(18), 16)) { S.focus = "ruler"; op = rotStart(p); return; }
        if (rHit(p)) { S.focus = "ruler"; op = { k: "rmove", p0: p, c0: { x: R.x, y: R.y } }; return; }
      }
    }
    if (S.mode === "hand" || (e.pointerType === "mouse" && e.button === 2)) { op = { k: "pan", sx: s.x, sy: s.y, ox: V.ox, oy: V.oy }; return; }
    if (S.mode === "pen") { op = { k: "free", last: s }; preview = { t: "free", pts: [[p.x, p.y]], c: S.color }; return; }
    if (S.mode === "point") { op = { k: "point", s0: s }; return; }
    if (S.mode === "erase") { op = { k: "erase", before: S.objs, changed: false, last: p }; eraseAt(p); }
  }

  // 자 가장자리 위의 위치 u — 가장자리 위(또는 아주 가까이)에 있는 점에 붙는다
  function snapU(sign, u) {
    var q = rWorld(u, sign * R.wid / 2), sp = findSnap(q, 12);
    if (sp) { var L = rLocal(sp); if (Math.abs(L.v - sign * R.wid / 2) < px(3)) { snapMark = sp; return clamp(L.u, -R.len / 2, R.len / 2); } }
    snapMark = null;
    return u;
  }

  // 자 돌리기: 가장자리가 어떤 점 위에 있으면 그 점을 축으로, 아니면 가운데를 축으로 돈다
  function rotStart(p) {
    var pivot = null, sign = 0;
    snapPoints().some(function (q) {
      var L = rLocal(q);
      if (Math.abs(L.u) > R.len / 2) return false;
      if (Math.abs(L.v - R.wid / 2) < px(2)) { pivot = q; sign = 1; return true; }
      if (Math.abs(L.v + R.wid / 2) < px(2)) { pivot = q; sign = -1; return true; }
      return false;
    });
    var c = pivot || { x: R.x, y: R.y };
    var o = { k: "rrot", pivot: c, sign: sign, off: wrap(Math.atan2(p.y - c.y, p.x - c.x) - R.a) };
    if (pivot) { var L = rLocal(pivot); o.pu = L.u; }
    return o;
  }

  function move(e, s) {
    var p = toWorld(s.x, s.y);
    if (!op) { hover(p); return; }
    switch (op.k) {
      case "pan":
        V.ox = op.ox - (s.x - op.sx) / V.z; V.oy = op.oy - (s.y - op.sy) / V.z; break;
      case "free": {
        if (Math.abs(s.x - op.last.x) + Math.abs(s.y - op.last.y) < 1.5) return;
        op.last = s; preview.pts.push([p.x, p.y]); break;
      }
      case "rline": {
        var L = rLocal(p), u1 = snapU(op.sign, clamp(L.u, -R.len / 2, R.len / 2));
        var a = rWorld(op.u0, op.sign * R.wid / 2), b = rWorld(u1, op.sign * R.wid / 2);
        preview.x1 = a.x; preview.y1 = a.y; preview.x2 = b.x; preview.y2 = b.y; edgeHot = op.sign; break;
      }
      case "rmove": {
        R.x = op.c0.x + p.x - op.p0.x; R.y = op.c0.y + p.y - op.p0.y;
        // 가장자리가 점 가까이 가면 점에 딱 붙인다
        snapMark = null;
        var best = null, A = rAxes();
        snapPoints().forEach(function (q) {
          var Lq = rLocal(q);
          if (Math.abs(Lq.u) > R.len / 2) return;
          [1, -1].forEach(function (sg) {
            var d = Lq.v - sg * R.wid / 2;
            if (Math.abs(d) < px(9) && (!best || Math.abs(d) < Math.abs(best.d))) best = { d: d, q: q };
          });
        });
        if (best) { R.x += A.vx * best.d; R.y += A.vy * best.d; snapMark = best.q; }
        break;
      }
      case "rrot": {
        var ang = wrap(Math.atan2(p.y - op.pivot.y, p.x - op.pivot.x) - op.off);
        snapMark = op.sign ? op.pivot : null;
        if (op.sign) {
          // 축(점)에서 다른 점을 향하는 각에 가까우면 그 각으로 맞춘다
          var pv = op.pivot;
          snapPoints().forEach(function (q) {
            if (d2(q, pv) < px(4)) return;
            var aq = Math.atan2(q.y - pv.y, q.x - pv.x);
            [aq, wrap(aq + Math.PI)].forEach(function (cand) {
              var diff = Math.abs(wrap(cand - ang)), dist = d2(q, pv) * Math.sin(diff);
              if (diff < Math.PI / 2 && dist < px(8)) { ang = cand; snapMark = q; }
            });
          });
          R.a = ang;
          var A2 = rAxes();
          R.x = op.pivot.x - A2.ux * op.pu - A2.vx * op.sign * R.wid / 2;
          R.y = op.pivot.y - A2.uy * op.pu - A2.vy * op.sign * R.wid / 2;
        } else R.a = ang;
        break;
      }
      case "cmove": {
        var n = { x: op.n0.x + p.x - op.p0.x, y: op.n0.y + p.y - op.p0.y }, sp = findSnap(n, 12);
        snapMark = sp; if (sp) n = sp;
        C.nx = n.x; C.ny = n.y; break;
      }
      case "copen": {
        var t = p, sp2 = findSnap(p, 12, { x: C.nx, y: C.ny });
        snapMark = sp2; if (sp2) t = sp2;
        C.r = clamp(d2(t, { x: C.nx, y: C.ny }), MINR, MAXR);
        C.a = Math.atan2(t.y - C.ny, t.x - C.nx); cUpright(); break;
      }
      case "cdraw": {
        var th = Math.atan2(p.y - C.ny, p.x - C.nx);
        op.acc = clamp(op.acc + wrap(th - op.last), -TAU, TAU); op.last = th;
        C.a = op.a0 + op.acc; preview.a1 = C.a; break;
      }
      case "crot":
        C.a = Math.atan2(p.y - C.ny, p.x - C.nx) - op.off; break;
      case "erase": eraseAlong(op.last, p); op.last = p; break;
    }
    draw(); hint();
  }

  function end(s) {
    if (!op) return;
    var p = toWorld(s.x, s.y);
    switch (op.k) {
      case "free": if (preview.pts.length > 1) addObj(preview); break;
      case "rline": if (d2({ x: preview.x1, y: preview.y1 }, { x: preview.x2, y: preview.y2 }) > px(3)) addObj(preview); break;
      case "cdraw": if (Math.abs(op.acc) > 0.015) addObj({ t: "arc", cx: C.nx, cy: C.ny, r: C.r, a0: op.a0, a1: op.a0 + op.acc, c: S.color }); break;
      case "point": {
        if (Math.abs(s.x - op.s0.x) + Math.abs(s.y - op.s0.y) > 8) break;
        var sp = findSnap(p, 12) || p;
        addObj({ t: "pt", x: sp.x, y: sp.y, label: nextLabel(), c: S.color }); break;
      }
      case "erase": if (op.changed) { S.hist.push(op.before); S.fut = []; syncButtons(); } break;
    }
    op = null; preview = null; snapMark = null; edgeHot = null;
    draw(); hint();
  }

  // 아무것도 누르지 않을 때: 붙을 점·자 가장자리 미리 보여 주기
  function hover(p) {
    var cursor = S.mode === "hand" ? "grab" : S.mode === "erase" ? "cell" : "crosshair";
    snapMark = null; edgeHot = null;
    if (C.on) {
      var P = cPen(), N = { x: C.nx, y: C.ny }, Hh = cHinge(), K = cKnob();
      if (d2(p, P) < px(16) || d2(p, N) < px(16) || d2(p, K) < Math.max(px(16), 14) || d2(p, Hh) < 15 ||
          segDist(p, Hh, N) < Math.max(px(9), 8) || segDist(p, Hh, P) < Math.max(px(9), 8)) cursor = "grab";
    }
    if (cursor !== "grab" && R.on) {
      if (R.fixed && S.mode === "pen") { var ne = rNearEdge(p, px(18)); if (ne) { edgeHot = ne.sign; cursor = "crosshair"; } }
      else if (!R.fixed && (rHit(p) || d2(p, rKnob()) < 16)) cursor = d2(p, rKnob()) < 16 ? "alias" : "grab";
    }
    if (S.mode === "point" && cursor === "crosshair") snapMark = findSnap(p, 12);
    stage.style.cursor = cursor;
    draw();
  }

  stage.addEventListener("pointerdown", function (e) {
    if (e.target !== cv) return;
    stage.setPointerCapture(e.pointerId);
    var s = local(e);
    pointers.set(e.pointerId, s);
    if (pointers.size === 2) {
      // 두 손가락: 그리던 것을 취소하고 확대·이동
      if (op && op.k === "erase" && op.changed) S.objs = op.before, S.ver++;
      op = null; preview = null; snapMark = null;
      var it = pointers.values(), a = it.next().value, b = it.next().value;
      pinch = { d: d2(a, b) || 1, m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, z: V.z, ox: V.ox, oy: V.oy };
      draw(); return;
    }
    if (pointers.size > 2) return;
    if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 1) return;
    begin(e, s); draw(); hint();
  });
  stage.addEventListener("pointermove", function (e) {
    var s = local(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, s);
    if (pinch && pointers.size >= 2) {
      var it = pointers.values(), a = it.next().value, b = it.next().value;
      var z = clamp(pinch.z * (d2(a, b) / pinch.d), ZMIN, ZMAX), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      var w = { x: pinch.m.x / pinch.z + pinch.ox, y: pinch.m.y / pinch.z + pinch.oy };
      V.z = z; V.ox = w.x - m.x / z; V.oy = w.y - m.y / z; draw(); return;
    }
    move(e, s);
  });
  function up(e) {
    var s = local(e);
    var had = pointers.has(e.pointerId);
    pointers.delete(e.pointerId);
    if (pinch) { if (pointers.size < 2) pinch = null; return; }
    if (had) end(s);
  }
  stage.addEventListener("pointerup", up);
  stage.addEventListener("pointercancel", up);
  stage.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  stage.addEventListener("wheel", function (e) {
    e.preventDefault();
    var s = local(e);
    zoomAt(s.x, s.y, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)));
  }, { passive: false });
  stage.addEventListener("dblclick", function (e) {
    if (!C.on) return;
    var p = toWorld(local(e).x, local(e).y);
    if (d2(p, { x: C.nx, y: C.ny }) < px(18) || d2(p, cHinge()) < 18) togglePin();
  });
  window.addEventListener("keydown", function (e) {
    if (e.code === "Space") { spaceDown = true; stage.style.cursor = "grab"; e.preventDefault(); }
    var mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === "z" || e.key === "Z")) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    if (mod && (e.key === "y" || e.key === "Y")) { e.preventDefault(); redo(); }
    if (e.key === "Escape" && op) { op = null; preview = null; snapMark = null; draw(); }
  });
  window.addEventListener("keyup", function (e) { if (e.code === "Space") spaceDown = false; });

  // ── 버튼 ──────────────────────────────────────────────────────
  var $ = function (id) { return document.getElementById(id); };
  document.querySelectorAll("[data-mode]").forEach(function (b) {
    b.addEventListener("click", function () { S.mode = b.getAttribute("data-mode"); syncButtons(); hint(); });
  });
  var colorsEl = $("colors");
  COLORS.forEach(function (c) {
    var b = document.createElement("button");
    b.className = "dot"; b.title = c[1] + " 펜"; b.style.background = c[0]; b.setAttribute("data-color", c[0]);
    b.addEventListener("click", function () { S.color = c[0]; syncButtons(); draw(); });
    colorsEl.appendChild(b);
  });
  function centerWorld() { return toWorld(W / 2, H / 2); }
  $("bRuler").addEventListener("click", function () {
    R.on = !R.on;
    if (R.on) { var c = centerWorld(); R.x = c.x; R.y = c.y + px(110); R.a = 0; R.fixed = false; S.focus = "ruler"; }
    syncButtons(); draw(); hint();
  });
  $("bRulerLock").addEventListener("click", function () { if (!R.on) return; R.fixed = !R.fixed; S.focus = "ruler"; if (R.fixed) S.mode = "pen"; syncButtons(); draw(); hint(); });
  $("bComp").addEventListener("click", function () {
    C.on = !C.on;
    if (C.on) { var c = centerWorld(); C.nx = c.x - 80; C.ny = c.y - px(20); C.r = 150; C.a = 0; C.pinned = false; cUpright(); S.focus = "compass"; }
    syncButtons(); draw(); hint();
  });
  function togglePin() { if (!C.on) return; C.pinned = !C.pinned; if (!C.pinned) cUpright(); S.focus = "compass"; syncButtons(); draw(); hint(); }
  $("bPin").addEventListener("click", togglePin);
  $("bUndo").addEventListener("click", undo);
  $("bRedo").addEventListener("click", redo);
  $("bGrid").addEventListener("click", function () { S.grid = !S.grid; syncButtons(); draw(); });
  // 확인 창을 띄울 수 없는 곳(iframe)이라 두 번 눌러 지운다
  var clearArm = 0;
  $("bClear").addEventListener("click", function () {
    var b = $("bClear");
    if (!S.objs.length) return;
    if (Date.now() - clearArm < 2500) { commit([]); clearArm = 0; b.textContent = "모두 지우기"; draw(); return; }
    clearArm = Date.now(); b.textContent = "한 번 더 누르면 지웁니다";
    setTimeout(function () { if (Date.now() - clearArm >= 2400) b.textContent = "모두 지우기"; }, 2500);
  });
  $("zIn").addEventListener("click", function () { zoomAt(W / 2, H / 2, 1.25); });
  $("zOut").addEventListener("click", function () { zoomAt(W / 2, H / 2, 0.8); });
  $("zHome").addEventListener("click", home);
  ["zoom"].forEach(function (id) { $(id).addEventListener("pointerdown", function (e) { e.stopPropagation(); }); });

  function syncButtons() {
    document.querySelectorAll("[data-mode]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-mode") === S.mode); });
    document.querySelectorAll("[data-color]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-color") === S.color); });
    $("bRuler").classList.toggle("on", R.on);
    $("bRulerLock").classList.toggle("on", R.on && R.fixed);
    $("bRulerLock").disabled = !R.on;
    $("bRulerLock").textContent = R.fixed ? "🔓 자 풀기" : "🔒 자 고정";
    $("bComp").classList.toggle("on", C.on);
    $("bPin").classList.toggle("on", C.on && C.pinned);
    $("bPin").disabled = !C.on;
    $("bPin").textContent = C.pinned ? "📍 침 풀기" : "📌 침 고정";
    $("bGrid").classList.toggle("on", S.grid);
    $("bUndo").disabled = !S.hist.length;
    $("bRedo").disabled = !S.fut.length;
  }

  // 지금 할 수 있는 일을 한 줄로 알려 준다
  function hint() {
    var t;
    if (op && op.k === "cdraw") t = "🧭 원하는 만큼 돌린 뒤 손을 떼세요. 한 바퀴를 넘기면 원이 닫힙니다.";
    else if (op && op.k === "rline") t = "📏 자의 가장자리를 따라 곧은 선이 그어집니다. 점 가까이에서 멈추면 그 점에 붙습니다.";
    else if (S.mode === "erase") t = "🧽 지울 선이나 점을 누르거나 문지르세요. 실수했다면 ↶ 로 되돌립니다.";
    else if (S.mode === "point") t = "• 점을 찍을 곳을 누르세요. 교점·끝점·원의 중심 가까이 누르면 그 위치에 정확히 찍힙니다.";
    else if (S.mode === "hand") t = "✋ 빈 곳을 끌어 화면을 옮깁니다. 휠(또는 두 손가락)로 확대·축소합니다.";
    else if (S.focus === "compass" && C.on) {
      t = C.pinned
        ? "📌 침 고정됨 — <b>연필 끝</b>을 끌어 돌리면 원(호)이 그려집니다. <b>손잡이</b>를 끌면 그리지 않고 돌아갑니다. 벌린 거리를 바꾸려면 '침 풀기'."
        : "🧭 <b>침 끝</b>을 끌어 중심에 놓고, <b>연필 끝</b>을 끌어 원하는 만큼 벌리세요(점 가까이 가면 붙습니다). 그다음 <b>침 고정</b>. (침을 두 번 눌러도 고정)";
    } else if (S.focus === "ruler" && R.on) {
      t = R.fixed
        ? "🔒 자 고정됨 — 펜으로 <b>자의 가장자리</b>를 따라 그으면 곧은 선이 됩니다. 옮기려면 '자 풀기'."
        : "📏 <b>몸통</b>을 끌어 옮기고 <b>↻ 손잡이</b>로 돌리세요. 가장자리가 점에 닿으면 붙고, 그 점을 축으로 돌아 다른 점에도 맞춰집니다. 맞췄으면 <b>자 고정</b>.";
    } else t = "✏️ 펜: 자유롭게 그립니다. 📏 자를 고정하면 가장자리를 따라 곧은 선, 🧭 컴퍼스 침을 고정하면 원을 그릴 수 있습니다.";
    hintEl.innerHTML = t;
  }

  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  window.addEventListener("resize", resize);
  cUpright();
  resize(); syncButtons(); hint();
})();
</script>
</body>
</html>
$hands_on$::text),
  true, null
)
on conflict (slug) do update
  set type = excluded.type, config = excluded.config, updated_at = now();
