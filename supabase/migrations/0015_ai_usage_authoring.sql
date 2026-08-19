-- 0014 에서 ai_limits 만 넓히고 ai_usage 를 빠뜨렸다.
--
-- ai_usage.feature 에도 같은 check 가 걸려 있어(0003 에서 컬럼과 함께 추가),
-- 제작 챗봇을 쓰면 사용량을 기록하다가
--   new row for relation "ai_usage" violates check constraint "ai_usage_feature_check"
-- 로 터진다. 실제로 500 이 났다.

alter table public.ai_usage drop constraint if exists ai_usage_feature_check;
alter table public.ai_usage
  add constraint ai_usage_feature_check
  check (feature in ('socratic', 'feedback', 'authoring'));
