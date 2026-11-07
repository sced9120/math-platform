# 만져보는 수학 전담팀 — 실행 절차 (오케스트레이터용)

예약 작업이 매일 20:00 · 24:00 · 04:00(서울)에 이 문서를 따라 **활동 하나**를 만든다.
오케스트레이터(이 문서를 읽는 세션)는 직접 만들지 않고 팀원에게 맡기고, 결과를 판정·기록·커밋·보고한다.

## 0. 준비
1. 저장소 루트에서 `git pull --rebase origin main`.
2. 팀원 확인: 사용 가능한 에이전트 목록에 `hands-on-sonnet-low` … `hands-on-opus-max` 가 있으면 그 이름으로 부른다.
   없으면(저장소를 세션 중간에 붙여 아직 안 읽힌 경우) `general-purpose` 에이전트를 부르되 `model` 을 sonnet/opus 로 지정하고,
   지시 첫머리에 `.claude/agents/hands-on-<모델>-<수준>.md` 본문을 그대로 붙인다. 이 경우 effort 는 지정되지 않으므로
   보고의 '투입 수준'에 "(수준 지정 불가 — 모델만 적용)"이라고 적는다.
3. `python3 -c "import playwright"` 가 실패하면 `pip install --break-system-packages playwright` 후 다시 확인한다.

## 1. 오늘 만들 항목 고르기 — `hands-on-team/queue.json`
- `status` 가 `in_progress` 이고 `started_at` 이 3시간 넘게 지났으면 그 항목을 이어서 한다(지난 실행이 중간에 끊긴 것).
- 아니면 `todo` 인 첫 항목. 고른 항목을 `in_progress`, `started_at`(ISO, +09:00) 으로 바꾼다.
- `todo` 가 하나도 없으면 → 6번(큐 채우기).

## 2. 수준 사다리 (선생님 지시: 가장 낮은 수준에서 시작, 막힐 때마다 한 칸씩)
| 역할 | 파일 | 사다리 (왼쪽부터 시작) |
|---|---|---|
| 설계 | roles/designer.md | opus-low → opus-medium → opus-high → opus-max |
| 제작 | roles/builder.md | sonnet-low → sonnet-medium → sonnet-high → opus-medium → opus-high → opus-max |
| 정리 | roles/finisher.md | sonnet-low → sonnet-medium |
| 오르빗 | roles/orbit.md | opus-low → opus-medium → opus-high |

- 활동마다 모든 역할은 **첫 칸에서 시작**한다.
- **한 칸 올리는 경우**: ① 팀원이 `BLOCKED` 로 보고 ② 제작 결과가 자동 점검(`check_activity.py`)에 실패 ③ 오르빗이 `FIX` 판정 → 지적받은 역할(설계/제작)만 ④ 오르빗 보고가 근거 없이 모호하거나 점검을 실행하지 않음 → 오르빗.
- 올릴 때는 이전 결과물·오류·지적 사항을 함께 넘기고 "지적된 것만 고쳐라"라고 지시한다.
- 올린 때마다 `hands-on-team/log/<id>.md` 에 `역할: 이전 → 다음 (이유)` 한 줄을 남긴다.
- 사다리 끝에서도 실패하면 그 항목은 `needs_teacher` 로 두고, 결과물은 그대로 두며 커밋, 보고 후 종료한다.

## 3. 한 활동 만들기
1. **설계** — 큐 항목을 주고 `hands-on-team/drafts/<id>/spec.md` 작성. 지시 첫 줄: `역할 파일: hands-on-team/roles/designer.md`.
2. **제작** — spec 을 주고 `content/hands-on/<slug>.html` 작성. 지시 첫 줄: `역할 파일: hands-on-team/roles/builder.md`.
3. **자동 점검(오케스트레이터가 직접)** — `python3 hands-on-team/tools/check_activity.py content/hands-on/<slug>.html`. 실패면 제작 한 칸 올려 다시(2번).
4. **오르빗 검수** — 지시 첫 줄: `역할 파일: hands-on-team/roles/orbit.md`. 이번까지의 수준 기록을 함께 준다.
   - `FIX` → 해당 역할 한 칸 올려 수정 → 3번부터 다시. **오르빗 검수는 활동당 최대 3회.** 3회째도 FIX 면 `needs_teacher`.
   - `NEEDS_TEACHER` → 결과물 보존, 큐 `needs_teacher`, 5번으로.
   - `PASS` → 정리로.
5. **정리** — 지시 첫 줄: `역할 파일: hands-on-team/roles/finisher.md`. (PASS 일 때만)
6. **기록·커밋**
   - 큐 항목 갱신: `status`(done/needs_teacher), `slug`, `levels_used`(예: `{"설계":"opus-low","제작":"sonnet-low→sonnet-medium","오르빗":"opus-low"}`), `notes`(한 줄), `finished_at`.
   - 오르빗 보고 전문을 `hands-on-team/log/<id>.md` 끝에 붙인다.
   - 스크린샷은 커밋하지 않는다(`hands-on-team/drafts/**/*.png` 는 .gitignore).
   - `git add -A hands-on-team content/hands-on scripts/build-hands-on-sql.mjs supabase/hands-on.sql`
   - 커밋 메시지: `만져보는 수학: <제목> (<성취기준 코드>)` + 빈 줄 + 오르빗 판정 한 줄 + 빈 줄 + `Co-Authored-By: Claude <noreply@anthropic.com>`
   - `git fetch origin main && git rebase origin/main && git push origin HEAD:main`. 충돌이면 rebase 를 풀고 한 번만 다시 시도, 그래도 안 되면 `hands-on-team/<id>` 브랜치로 푸시하고 보고에 적는다.

## 4. 선생님께 보고 (매 실행 반드시)
1. 미리보기: Artifact 도구가 있으면 `hands-on-team/state.json` 의 `preview_artifact_url` 을 확인한다.
   값이 있으면 그 artifact 를 read 한 뒤 같은 url 로 새 활동 HTML 을 publish(제목 "만져보는 수학 미리보기"), 없으면 새로 publish 하고 url 을 state.json 에 적어 다음 커밋에 넣는다.
   Artifact 도구가 없으면 건너뛴다.
2. `SendUserMessage` 로 오르빗 보고를 보낸다. 끝에 다음을 덧붙인다:
   - PASS 이면: `사이트 반영: Supabase SQL Editor 에서 supabase/hands-on.sql 실행 (여러 번 실행해도 안전)`
   - 진행 현황: `미적분Ⅱ 7/23 · 다음: [코드] 문장`
3. `SendUserFile` 로 `drafts/<slug>/mobile-after.png`, `pc-after.png` 를 보낸다(caption 한 줄).
4. 실패·중단·needs_teacher 도 같은 방식으로 이유와 함께 보낸다. 조용히 끝내지 않는다.

## 5. 금지
- 기존 활동(`compass-straightedge` 등)과 앱 코드(`app/`, `components/`, `lib/`, `supabase/migrations/`)는 건드리지 않는다.
- Supabase 에 직접 접속하거나 키를 찾지 않는다. 사이트 반영은 선생님이 SQL 을 실행해야 일어난다.
- 한 실행에서 활동 두 개 이상 만들지 않는다.

## 6. 큐 채우기 (todo 가 없을 때)
- `queue.json` 의 `next_subjects_when_empty` 첫 과목의 2022 개정 성취기준을 `hands-on-opus-high` 에게 조사시킨다(공식 원문 우선, 출처 기록).
- 같은 형식으로 `items` 끝에 추가하고 그 과목을 목록에서 뺀다. 커밋 후 "새 과목 큐 추가: <과목> <n>개" 를 보고하고, 이번 실행은 그 첫 항목을 만든다.
