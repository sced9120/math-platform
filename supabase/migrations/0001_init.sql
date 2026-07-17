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
