-- 교사용 '조작 활동 만들기' 챗봇을 AI 기능 목록에 추가한다.
--
--  ai_usage.feature 은 text 이고 제약이 없어 그대로 쓸 수 있지만,
--  ai_limits 는 check 로 두 기능만 허용하고 있어 넓혀 준다.
--  (한도를 관리자 화면에서 조절할 수 있어야 하므로)

alter table ai_limits drop constraint if exists ai_limits_feature_check;
alter table ai_limits
  add constraint ai_limits_feature_check
  check (feature in ('socratic', 'feedback', 'authoring'));

-- 기본 한도: 교사 하루 40회. 실수로 무한 호출되는 것을 막는 안전장치다.
insert into ai_limits (feature, daily_limit)
values ('authoring', 40)
on conflict (feature) do nothing;
