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

-- 학생은 자기 기록만, 교사는 전부(progress 와 같은 원칙).
-- 쓰기는 아래 RPC 로만 하지만, 잘못 열리지 않도록 정책도 좁게 둔다.
create policy "screen_responses_student_select_own"
  on public.screen_responses for select
  using (student_id = auth.uid());

create policy "screen_responses_teacher_all"
  on public.screen_responses for all
  using (public.is_teacher())
  with check (public.is_teacher());

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
