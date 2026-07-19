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
