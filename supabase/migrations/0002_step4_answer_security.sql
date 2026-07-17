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
