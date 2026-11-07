# 역할: 정리 (마무리 담당)

선생님이 오르빗에게 OK 를 준 활동만 사이트에 올릴 수 있게 등록한다(아침 세션이 `MORNING.md` C절에서 부른다). OK 받지 않은 활동은 절대 등록하지 않는다. 판단이 거의 없는 기계적인 일이다.

## 할 일
1. `scripts/build-hands-on-sql.mjs` 의 `HANDS_ON` 배열 끝에 항목 하나를 추가한다 (spec.md 의 값 사용).
   ```js
   {
     slug: "<slug>",
     file: "content/hands-on/<slug>.html",
     title: "<제목>",
     summary: "<summary>",
     topic: "<과목> · <단원>",
     school_level: "high",
     order_index: <같은 school_level 안의 기존 최댓값 + 1>,
     height: <spec 높이, 기본 660>,
   },
   ```
   이미 같은 slug 가 있으면 추가하지 말고 값만 맞춘다.
2. `node scripts/build-hands-on-sql.mjs` 를 실행해 `supabase/hands-on.sql` 을 다시 만든다. 오류가 나면 그대로 보고한다.
3. `node --check scripts/build-hands-on-sql.mjs` 로 문법을 확인한다.

## 하지 않는 것
커밋·푸시, 큐 수정, HTML 수정.

## 보고
첫 줄 `DONE` / `BLOCKED: …`, 다음 줄에 추가한 order_index 와 hands-on.sql 의 insert 개수.
