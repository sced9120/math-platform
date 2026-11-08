# 오르빗 아침 브리핑 · 승인 · 게시 (오케스트레이터용)

매일 아침 예약 작업이 이 문서를 따른다. 밤 실행(20·24·4시)은 메시지를 보내지 않고 결과만 쌓아 둔다.
이 세션이 **하루에 한 번만** 선생님께 알림을 보내고, 선생님이 이 세션에 답장으로 OK 를 주면 그 활동을 사이트에 올린다.

준비는 `RUNBOOK.md` 0절과 같다(`git pull`, 팀원 확인, playwright 확인).

## A. 브리핑 만들기
1. `hands-on-team/state.json` 의 `last_briefing_at` 이후의 `hands-on-team/log/runs.md` 줄을 읽는다(없으면 최근 24시간).
2. 큐에서 `awaiting_ok`·`needs_teacher`·`approved` 항목을 모은다.
3. 승인 대기 항목마다 `python3 hands-on-team/tools/check_activity.py content/hands-on/<slug>.html` 를 다시 돌려
   스크린샷을 새로 만들고(밤 이후 바뀐 게 없는지도 확인), 실패하면 그 항목을 `needs_teacher` 로 바꾸고 이유를 적는다.
4. `python3 hands-on-team/tools/build_inbox.py` → `hands-on-team/inbox/index.html` 생성.
5. 승인함 게시: Artifact 도구로 publish 한다.
   - `state.json` 의 `inbox_artifact_url` 이 있으면 먼저 그 url 을 `action: "read"` 한 뒤, 같은 `url` 로 새 파일을 publish.
   - 없으면 새로 publish(`icon: "inbox"`, description: "밤사이 만든 만져보는 수학 활동을 직접 만져 보고 OK 하는 곳") 하고 url 을 `inbox_artifact_url` 에 적는다.
   - Artifact 도구가 없으면 건너뛰고 스크린샷만 보낸다.
6. `state.json` 의 `last_briefing_at` 을 지금(+09:00)으로 바꾸고 `git add hands-on-team && git commit && git push` (RUNBOOK 5절과 같은 방식).

## B. 선생님께 보내기 (알림은 이것 하나)
`SendUserMessage` 한 통. 짧게, 휴대폰 한 화면 안에.
```
🛰 오르빗 아침 브리핑 · 11월 8일
밤사이: 3회 실행 · 승인 대기 2 · 확인 필요 1

① calc2-01-01 수열 수렴 실험실
   [12미적Ⅱ-01-01] 부합 ●●●●○ · 오류 0 · 볼 것: 없음
② calc2-01-02 극한 성질 저울
   [12미적Ⅱ-01-02] 부합 ●●●○○ · 오류 0 · 볼 것: 질문 2가 어려울 수 있음
⚠ calc2-01-03 확인 필요 — <이유 한 줄>

승인함에서 직접 만져 보세요: <승인함 artifact 링크가 있으면 '위 카드'라고만 쓴다>
답장으로: "OK 전부" · "OK calc2-01-01" · "수정 calc2-01-02: 내용" · "건너뛰기 calc2-01-03"
진행: 미적분Ⅱ 2/23 게시
```
그다음 `SendUserFile` 로 승인 대기 항목의 `mobile-after.png` 를 보낸다(항목당 1장, caption 에 번호).
큐에 `in_progress` 항목이 있으면(4시 실행이 아직 안 끝남) 브리핑에 "⏳ <id> 제작 중 — 끝나는 대로 따로 알려드려요" 한 줄을 넣는다.
그 실행은 끝나면 RUNBOOK 4절 예외에 따라 스스로 완료 알림을 보낸다.
새 결과도 대기 항목도 없으면 한 줄로: "밤사이 새 활동 없음 — <runs.md 의 이유>". 그리고 턴을 끝내고 답장을 기다린다.

**기출 아틀라스 줄 (같은 메시지 맨 아래에 붙인다)**
- 브리핑을 만들기 전에 `sced9120/gichul-atlas` 를 읽기 권한으로 붙이고(add_repo) `/home/claude/gichul-atlas` 에 `--depth 1` 로 한 번 clone 한다.
- `analysis-team/log/runs.md` 에서 `last_briefing_at` 이후 줄, `review/needs_teacher.json` 개수, `analysis-team/queue.json` 진행을 읽어 두 줄로:
  ```
  📚 기출 분석: 밤사이 15문항 추가 · 확인 필요 1 (2022년 고1 9월 학평 16–30번)
     진행: 시험지 3/12 · 남은 원본 9
  ```
- 줄이 없으면 `📚 기출 분석: 밤사이 실행 없음` , runs.md 마지막 줄이 "원본 없음"이면 `📚 기출 분석: inbox 에 시험지 PDF 를 넣어 주세요` .
- 기출 분석은 승인을 기다리지 않는다(오르빗 PASS 문항이 바로 사이트에 반영됨). 확인 필요 문항만 알린다.
- 이 저장소는 읽기만 한다. 고치거나 push 하지 않는다.

## C. 답장 처리 (선생님이 이 세션에 답하면)
답장에서 명령을 읽는다. 번호는 큐의 `id`, 브리핑의 ①②… 순번 모두 받는다. 애매하면 한 번만 되묻는다.

### OK → 게시
대상: `awaiting_ok` 항목(“OK 전부”). 선생님이 `needs_teacher` 항목을 직접 지목해 OK 하면 그것도 대상.
1. **정리** 팀원(`roles/finisher.md`, 사다리 sonnet-low → sonnet-medium)에게 대상 항목들을 `scripts/build-hands-on-sql.mjs` 에 등록하고
   `node scripts/build-hands-on-sql.mjs` 로 `supabase/hands-on.sql` 을 다시 만들게 한다. title·summary·topic·height 는 `drafts/<id>/spec.md` 에서.
2. 오케스트레이터 확인: `node --check scripts/build-hands-on-sql.mjs`, `supabase/hands-on.sql` 에 각 slug 가 있는지, **OK 받지 않은 slug 가 섞이지 않았는지**.
3. 큐: 대상 항목 `status: approved`, `approved_at`. `log/runs.md` 에 `- <시각> · 게시 요청 · <id들>`.
4. 커밋 `만져보는 수학 게시: <제목들>` 후 main 에 push → GitHub Actions `만져보는 수학 게시`(apply-hands-on.yml) 가 Supabase 에 적용한다.
5. 결과 확인(둘 중 되는 것):
   - `gh run list --workflow apply-hands-on.yml --limit 1` 로 상태를 보고, 진행 중이면 끝날 때까지 기다린다.
   - 또는 WebFetch 로 `https://math.hsorbit.uk/hands-on/<slug>` 를 열어 제목이 보이는지 확인.
6. 성공 → `status: published`, `published_at`, 승인함 다시 만들어 publish, 메시지:
   `✅ 게시했어요: <제목> — math.hsorbit.uk/hands-on/<slug>` (여러 개면 줄마다).
   실패 → `approved` 로 둔 채 이유를 보낸다. `SUPABASE_DB_URL` 비밀값이 없다는 오류면:
   "GitHub 저장소 Settings → Secrets and variables → Actions 에 SUPABASE_DB_URL(Supabase → Connect → Session pooler 문자열)을 넣고 Actions 탭에서 다시 실행하면 올라가요. 급하면 Supabase SQL Editor 에서 supabase/hands-on.sql 을 실행해도 됩니다."
   다음 아침 브리핑은 `approved` 항목을 다시 확인해 게시됐으면 `published` 로 바꾼다.
   **선생님 지시(11/8): 아침 이후 선생님이 이 세션에서 활동하면(답장·비밀값 추가·재실행 등) 다음 날 브리핑으로 미루지 않는다.**
   그 자리에서 Actions 상태를 다시 보고, 진행 중이면 끝날 때까지 기다린 뒤 바로 `published`/실패를 기록하고 승인함을 다시 publish 해 결과를 알린다.
   아직 재실행 전이면 무엇이 남았는지 한 줄로 알리고, 선생님이 "다시 해 봐" 등으로 부르면 그때 바로 확인한다.

### 수정 <id>: 내용
1. 내용을 보고 고칠 역할을 정한다(활동 구성·질문·수학 해석 → 설계, 화면·동작 → 제작). 선생님의 수정 요청은 '개선이 필요한 순간'이므로
   그 역할의 사다리를 `levels_used` 에 기록된 마지막 칸에서 **한 칸 올려** 맡긴다. 지시에 선생님 문장을 그대로 넣고 "요청된 것만 고쳐라".
2. RUNBOOK 3절의 자동 점검 → 오르빗 검수를 그대로 거친다(오르빗 최대 2회 추가).
3. 통과하면 `awaiting_ok` 로 두고 승인함을 다시 publish, 바뀐 점 한두 줄과 새 스크린샷을 보내고 다시 OK 를 기다린다. **수정 후 자동 게시하지 않는다.**

### 건너뛰기 <id>
`status: skipped`, `notes` 에 선생님 말 그대로. 한 줄로 확인 답장.

### 그 밖의 말
질문이면 큐·로그·spec 을 근거로 답한다. 순서나 규칙을 바꾸라는 말이면 `queue.json`·`RUNBOOK.md`·이 문서를 고쳐 커밋하고 무엇을 바꿨는지 한 줄로 알린다.

## 금지
- 선생님의 명시적 OK 없이 `scripts/build-hands-on-sql.mjs`·`supabase/hands-on.sql` 에 항목을 넣지 않는다.
- Supabase 키·DB 주소를 찾거나 다루지 않는다. 게시는 GitHub Actions 만 한다.
- 앱 코드(`app/`, `components/`, `lib/`, `supabase/migrations/`)와 기존 활동은 건드리지 않는다.
