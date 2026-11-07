# 만져보는 수학 전담팀

미적분Ⅱ부터 교육과정 위계를 따라 내려오며 `만져보는 수학` 활동을 하나씩 만들고, 선생님이 OK 한 것만 사이트에 올리는 AI 팀입니다.

**하루 흐름**
1. **밤 20:00 · 24:00 · 04:00** — 활동 하나씩 제작. 설계(Opus) → 제작(Sonnet부터) → 자동 점검 → 오르빗 검수. 알림 없음, 결과는 큐·로그에 쌓임.
2. **아침 브리핑** — 오르빗이 밤사이 결과를 한 번에 요약해 알림. 승인함 페이지에서 활동을 직접 만져 볼 수 있음.
3. **선생님 답장** — 브리핑에 `OK 전부` / `OK calc2-01-01` / `수정 calc2-01-02: 내용` / `건너뛰기 …`
4. **자동 게시** — OK 받은 활동만 등록·push → GitHub Actions 가 Supabase 에 적용 → math.hsorbit.uk/hands-on 에 공개.

**수준 사다리** — 모든 역할이 가장 낮은 수준(low)에서 시작하고, 오류·막힘·수정 요청마다 한 칸씩 올립니다(`RUNBOOK.md` 2절).

**처음 한 번 필요한 설정** — 저장소 Settings → Secrets and variables → Actions 에 `SUPABASE_DB_URL`
(Supabase 대시보드 → Connect → Session pooler 연결 문자열). 없으면 게시 단계만 실패하고, 대신 SQL Editor 에서 `supabase/hands-on.sql` 을 직접 실행하면 됩니다.

| 파일 | 내용 |
|---|---|
| `RUNBOOK.md` | 밤 제작 절차 |
| `MORNING.md` | 아침 브리핑·OK 처리·게시 절차 |
| `queue.json` | 만들 순서(성취기준 61개)와 상태 |
| `roles/*.md` | 역할별 지침(설계·제작·정리·오르빗) |
| `../.claude/agents/hands-on-*.md` | 모델 × 수준 8가지 팀원 |
| `tools/check_activity.py` | 실제 사이트와 같은 샌드박스에서 PC·모바일 작동 점검 |
| `tools/build_inbox.py` | 오르빗 승인함 페이지 생성 |
| `../.github/workflows/apply-hands-on.yml` | OK 받은 활동을 DB 에 적용 |
| `log/` | 실행 기록, 활동별 수준 변화와 오르빗 보고 |

순서·규칙은 `queue.json`·`RUNBOOK.md`·`MORNING.md` 만 고치면 다음 실행부터 반영됩니다.
