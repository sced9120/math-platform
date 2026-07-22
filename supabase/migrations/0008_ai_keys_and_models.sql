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
