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
