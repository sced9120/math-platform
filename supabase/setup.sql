-- ============================================================
-- 수학 학습 플랫폼 — 전체 DB 설정 (한 번에 실행)
-- 새 Supabase 프로젝트의 SQL Editor에 통째로 붙여넣고 Run 하세요.
-- (개별 마이그레이션 0001~0017을 순서대로 합친 파일입니다)
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


-- ---------- 0016_open_platform ----------

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


-- ---------- 0017_teacher_ai ----------

-- ============================================================
-- 0017: AI 를 교사별로 + 관리자는 교사 관리 전용으로
--
-- 지금까지 AI 키·모델·한도·프롬프트는 사이트에 하나였다(관리자가 관리).
-- 누구나 교사로 가입하는 구조에서는 모르는 교사의 학생이 운영자의 키를 쓰게 되므로,
--  1) 키·모델·한도·프롬프트를 교사마다 따로 둔다.
--     - 학생의 AI(문답·첨삭)는 "담당 교사"의 것을 쓴다
--     - 교사의 조작 활동 만들기는 교사 "본인"의 것을 쓴다
--  2) 관리자가 지금 가진 학생·자료·AI 설정을 교사 계정으로 넘기는 함수를 둔다.
--     넘긴 뒤 관리자는 교사 계정만 관리한다.
--
-- 기존 설정(키·모델·한도·프롬프트)은 가장 먼저 만들어진 관리자에게 붙인다.
-- → 실행 직후에도 관리자 학생의 AI 는 지금처럼 동작한다.
--
-- 0016 다음에 실행. 여러 번 실행해도 된다(멱등).
-- ============================================================


-- 0. 기존 설정의 주인 ----------------------------------------------------------
-- 각 표에 owner_id 를 붙이고, 비어 있는 행은 가장 먼저 만든 관리자에게 준다.
alter table public.ai_secrets add column if not exists owner_id uuid references public.profiles (id) on delete cascade;
alter table public.ai_models  add column if not exists owner_id uuid references public.profiles (id) on delete cascade;
alter table public.ai_limits  add column if not exists owner_id uuid references public.profiles (id) on delete cascade;
alter table public.ai_prompts add column if not exists owner_id uuid references public.profiles (id) on delete cascade;

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


-- 1. 기본키를 "교사 + 항목"으로 -----------------------------------------------
-- (provider) → (owner_id, provider) 처럼 바꾼다. 이미 바뀌었으면 건너뛴다.
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


-- 2. 정책 ----------------------------------------------------------------------
-- ai_secrets·ai_limits·ai_prompts: 정책 없음 그대로 = 서버(service role)만.
--   키는 절대 브라우저로 내려가지 않는다. 교사 화면은 서버 API 가 "자기 것"만 다룬다.
-- ai_models: 모델 이름은 비밀이 아니다. 내 것 + 내 담당 교사 것만 읽는다(학생 선택지).
drop policy if exists "ai_models_read_authenticated" on public.ai_models;
drop policy if exists "ai_models_read_own_or_teacher" on public.ai_models;
create policy "ai_models_read_own_or_teacher"
  on public.ai_models for select
  to authenticated
  using (owner_id = auth.uid() or owner_id = public.my_teacher_id());


-- 3. 관리자 → 교사로 넘기기 ----------------------------------------------------
-- 관리자가 지금 가진 학생·교과·단원·소단원과 AI 설정을 교사 한 명에게 넘긴다.
--  - 받는 교사에게 같은 항목(같은 제공자의 키, 같은 기능의 한도, 같은 프롬프트)이
--    이미 있으면 그 항목은 받는 교사 것을 그대로 둔다.
--  - 넘겨받은 학생은 지금처럼 "학번만으로" 로그인한다(이메일이 바뀌지 않음).
--    받는 교사가 앞으로 추가할 학생도 같은 방식이 되도록 학급 코드를 '' 로 둔다.
--    ('' = 코드 없는 학급. 유니크 인덱스라 사이트에 한 계정만 가질 수 있다)
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
  v_codeless   boolean := false;
begin
  if v_from is null or not public.is_admin() then
    raise exception 'admin only';
  end if;
  if not exists (select 1 from public.profiles where id = p_to and role = 'teacher') then
    raise exception 'target must be a teacher';
  end if;

  update public.profiles set teacher_id = p_to
  where role = 'student' and teacher_id = v_from;
  get diagnostics v_students = row_count;

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

  if v_students > 0 and not exists (
    select 1 from public.profiles where class_code = '' and id <> p_to
  ) then
    update public.profiles set class_code = '' where id = p_to;
    v_codeless := true;
  end if;

  return jsonb_build_object(
    'students', v_students,
    'subjects', v_subjects,
    'units', v_units,
    'activities', v_activities,
    'codeless', v_codeless
  );
end;
$$;

revoke all on function public.transfer_teaching(uuid) from public;
grant execute on function public.transfer_teaching(uuid) to authenticated;
