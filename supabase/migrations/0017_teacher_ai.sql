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
