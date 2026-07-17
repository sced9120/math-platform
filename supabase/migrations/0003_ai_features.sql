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
