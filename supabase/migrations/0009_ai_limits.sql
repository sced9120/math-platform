-- 학생별 AI 일일 사용 한도를 관리자가 웹에서 조정할 수 있게 저장.
-- 행이 없으면 코드 기본값(socratic 20, feedback 10)이 사용된다.
create table if not exists ai_limits (
  feature text primary key check (feature in ('socratic', 'feedback')),
  daily_limit int not null check (daily_limit between 1 and 500),
  updated_at timestamptz not null default now()
);

-- RLS: 정책을 만들지 않음 = service role(서버)만 접근 가능.
-- 한도 값 자체는 비밀이 아니지만, 조작은 서버 API(관리자 가드)로만 한다.
alter table ai_limits enable row level security;
