# 만져보는 수학 전담팀 — 실행 절차 (오케스트레이터용)

예약 작업이 매일 20:00 · 24:00 · 04:00(서울)에 이 문서를 따라 **활동 하나**를 만든다.
오케스트레이터(이 문서를 읽는 세션)는 직접 만들지 않고 팀원에게 맡기고, 결과를 판정·기록·커밋한다.
**밤 실행은 선생님께 메시지를 보내지 않는다.** 결과는 큐와 로그에 쌓아 두고, 아침 브리핑(`MORNING.md`)이 모아서 보고한다.
**사이트 게시는 선생님이 오르빗에게 OK 를 준 활동만**, 아침 브리핑 세션이 한다. 밤 실행은 게시 등록(정리)을 하지 않는다.

## 0. 준비
0. `hands-on-team/LESSONS.md` 의 '미리 확인' 표를 먼저 점검한다. 이 실행 중 오류(점검 실패·BLOCKED·push 실패 등)가 나면
   그 문서의 '오류가 났을 때 할 일'대로 가이드를 고치고 커밋한다(밤에는 메시지 없이 — 아침 브리핑이 전한다).
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
| 정리 (게시할 때만, MORNING.md) | roles/finisher.md | sonnet-low → sonnet-medium |
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
   - `PASS` → 기록으로. (정리·게시는 선생님 OK 뒤 아침 세션이 한다)
5. **기록·커밋**
   - 큐 항목 갱신: `status`(PASS → `awaiting_ok`, 아니면 `needs_teacher`), `slug`, `title`(spec 제목), `height`(spec 높이),
     `levels_used`(예: `{"설계":"opus-low","제작":"sonnet-low→sonnet-medium","오르빗":"opus-low"}`),
     `orbit_summary`(오르빗 보고 중 '🛰 오르빗 보고' 아래 본문 전체), `notes`(한 줄), `finished_at`.
   - 오르빗 보고 전문을 `hands-on-team/log/<id>.md` 끝에 붙인다.
   - 스크린샷은 커밋하지 않는다(`hands-on-team/drafts/**/*.png` 는 .gitignore).
   - `git add -A hands-on-team content/hands-on` (밤 실행은 `scripts/`·`supabase/` 를 건드리지 않는다 — 그래야 승인 전 활동이 사이트에 올라가지 않는다)
   - 커밋 메시지: `만져보는 수학: <제목> (<성취기준 코드>)` + 빈 줄 + 오르빗 판정 한 줄 + 빈 줄 + `Co-Authored-By: Claude <noreply@anthropic.com>`
   - `git fetch origin main && git rebase origin/main && git push origin HEAD:main`. 충돌이면 rebase 를 풀고 한 번만 다시 시도, 그래도 안 되면 `hands-on-team/<id>` 브랜치로 푸시하고 보고에 적는다.

## 4. 밤 실행의 마무리 (메시지 보내지 않음)
- 실패·중단도 조용히 넘기지 말고 `hands-on-team/log/runs.md` 끝에 한 줄 남겨 커밋한다:
  `- 2026-11-08T00:00+09:00 · <id> · <결과: awaiting_ok | needs_teacher | 실패: 이유>`
- 아침 브리핑이 이 줄과 큐를 읽어 보고한다. 기본적으로 `SendUserMessage`·`SendUserFile` 은 쓰지 않는다.
- **예외 — 아침 6시를 넘겨 끝난 실행**: 마지막 기록·push 까지 끝난 시각(서울)이 그날 06:00 이후이고,
  `state.json` 의 `last_briefing_at` 이 이 실행 시작 이후(= 브리핑이 이 활동을 "진행 중"으로 이미 알림)라면
  `SendUserMessage` 한 통만 보낸다(휴대폰 한 화면, 승인함 링크는 `inbox_artifact_url` 이 있으면 "승인함 카드"라고만):
  ```
  🛰 오르빗 · 새벽 실행 완료
  <id> <제목> — [<성취기준 코드>] 부합 ●●●●○ · 오류 0 · 볼 것: …   (또는 ⚠ 확인 필요 — 이유 한 줄)
  답장: "OK <id>" · "수정 <id>: 내용" · "건너뛰기 <id>"
  ```
  승인 대기면 승인함도 `MORNING.md` A절 4~5번처럼 다시 만들어 publish 한다. 브리핑 전에 끝난 실행은 이 예외에 해당하지 않는다.
- **기출 분석과의 관계 (2026-11-08 선생님 결정)**: 기출 분석 밤 작업은 00시·04시에 이 실행과 **동시에** 스스로 시작한다(저장소가 달라 서로 기다릴 필요 없음).
  예전의 `fire_trigger` 시작 신호는 보내지 않는다.

## 5. 금지
- 기존 활동(`compass-straightedge` 등)과 앱 코드(`app/`, `components/`, `lib/`, `supabase/migrations/`)는 건드리지 않는다.
- Supabase 에 직접 접속하거나 키를 찾지 않는다. 사이트 반영은 선생님 OK → 아침 세션이 `scripts/build-hands-on-sql.mjs` 에 등록·push → GitHub Actions(`apply-hands-on.yml`)가 DB 에 적용하는 길로만 일어난다.
- 밤 실행에서 `scripts/build-hands-on-sql.mjs`·`supabase/hands-on.sql` 을 고치지 않는다.
- 한 실행에서 활동 두 개 이상 만들지 않는다.

## 6. 큐 채우기 (todo 가 없을 때)
- `queue.json` 의 `next_subjects_when_empty` 첫 과목의 2022 개정 성취기준을 `hands-on-opus-high` 에게 조사시킨다(공식 원문 우선, 출처 기록).
- 같은 형식으로 `items` 끝에 추가하고 그 과목을 목록에서 뺀다. 커밋하고 `log/runs.md` 에 "새 과목 큐 추가: <과목> <n>개" 를 남긴 뒤, 이번 실행은 그 첫 항목을 만든다.
