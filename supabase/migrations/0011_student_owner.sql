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
