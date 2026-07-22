-- ============================================================
-- AI 프롬프트 저장 (관리자가 웹에서 수정)
--  값이 없으면 코드의 기본 프롬프트(lib/ai/prompts.ts)를 사용한다.
--  읽기/쓰기 모두 서버(service role)에서만 — 학생·교사에게 노출 불필요.
-- ============================================================

create table public.ai_prompts (
  key        text primary key,
  content    text not null,
  updated_at timestamptz not null default now()
);

alter table public.ai_prompts enable row level security;
-- 정책 없음 = anon/authenticated 접근 불가. service role만 읽고 쓴다.
