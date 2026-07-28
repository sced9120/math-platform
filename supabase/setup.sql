-- ============================================================
-- 수학 학습 플랫폼 — 전체 DB 설정 (한 번에 실행)
-- 새 Supabase 프로젝트의 SQL Editor에 통째로 붙여넣고 Run 하세요.
-- (개별 마이그레이션 0001~0010을 순서대로 합친 파일입니다)
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
