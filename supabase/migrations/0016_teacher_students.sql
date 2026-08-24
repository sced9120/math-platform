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
