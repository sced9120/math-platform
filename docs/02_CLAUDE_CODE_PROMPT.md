# Claude Code 실행 프롬프트

> 아래 블록을 그대로 Claude Code에 붙여넣어 MVP를 구현시킨다.
> **권장 모델: Opus 4.8** (인증·DB·RLS가 얽히므로). 브레인스토밍은 Sonnet, 구현은 Opus.
> 큰 덩어리를 한 번에 시키지 말고, 아래 STEP을 순서대로 하나씩 지시하는 것을 권장.

---

## 붙여넣기용 마스터 프롬프트

```
너는 이 프로젝트의 리드 개발자다. 고등학교 수학 교사가 단독 운영할
학습 플랫폼을 만든다. docs/01_ARCHITECTURE.md 를 먼저 읽고 그 설계를 따른다.

[스택]
- Next.js (App Router, TypeScript) + Tailwind CSS
- Supabase (Postgres + Auth + RLS)
- 배포는 Vercel 전제

[대전제]
- 교사 1인이 유지보수한다. 과도한 추상화·마이크로서비스 금지. 단순하게.
- 이번 단계는 MVP: "인증 + 역할 + 단원/활동 CRUD + GeoGebra 임베드 +
  문제풀이 + 진행기록"까지. AI 기능은 만들지 말고, 나중에 붙일 자리(빈
  라우트/컴포넌트 stub)만 남겨라.
- 로그인은 "학번 + 초기비밀번호(교사 배포)" 방식. 이메일은 학번 기반
  가상 이메일({학번}@school.local)로 내부 생성. 학생에겐 학번만 노출.
- 학생 최초 로그인 시 비밀번호 변경 강제.

작업을 아래 STEP 순서로 진행하고, 각 STEP이 끝나면 멈춰서 무엇을
했는지 요약하고 내 확인을 받은 뒤 다음 STEP으로 간다.
```

---

## STEP 1 — 프로젝트 뼈대 + Supabase 스키마

```
STEP 1을 진행한다.
1) Next.js(App Router, TS) + Tailwind 프로젝트를 초기화한다.
2) Supabase 클라이언트(@supabase/supabase-js, @supabase/ssr)를 설정한다.
   환경변수는 .env.local.example 에 채워넣을 자리로 문서화한다.
3) supabase/migrations 에 다음 테이블의 SQL 마이그레이션을 작성한다:
   - profiles(id[auth.users FK], grade, class_no, student_no, name, role,
     must_change_password, created_at)
   - units(id, title, grade, order_index, is_published, created_at)
   - activities(id, unit_id FK, type, title, content jsonb, order_index,
     is_published, created_at)
     * type: 'geogebra' | 'content' | 'problem' (이번 단계 한정)
   - progress(id, student_id FK, activity_id FK, completed, score,
     submission jsonb, updated_at, unique(student_id, activity_id))
   - ai_usage(student_id, date, count) — 지금은 테이블만 만들어 둔다(2단계용)
4) RLS 정책을 작성한다:
   - student: 자기 profile 읽기/수정(제한적), 공개된 units/activities 읽기,
     자기 progress만 read/write
   - teacher: 전부 read/write
   완료되면 마이그레이션 SQL과 RLS 정책을 요약해서 보여주고 멈춘다.
```

## STEP 2 — 인증 + 최초 비번변경

```
STEP 2를 진행한다.
1) 로그인 페이지: 학번 + 비밀번호 입력. 내부적으로 {학번}@school.local
   로 Supabase Auth 로그인.
2) 로그인 후 profiles.must_change_password === true 이면 비밀번호
   변경 페이지로 강제 리다이렉트. 변경 성공 시 플래그 해제.
3) 역할 기반 라우팅: student → /dashboard, teacher → /teacher.
4) 미들웨어로 비로그인 접근 차단.
요약 후 멈춘다.
```

## STEP 3 — 교사: 학생 일괄 생성 + 단원/활동 관리

```
STEP 3을 진행한다.
1) 교사 대시보드(/teacher).
2) 학생 계정 일괄 생성: CSV(학년,반,번호,이름) 업로드 →
   서버측(API Route + Supabase service role key)에서 각 학생을
   가상 이메일로 생성, 초기비밀번호 지정, profiles insert,
   must_change_password=true. 생성 결과(학번·초기비번) 목록을
   교사가 다운로드/인쇄할 수 있게 표로 출력.
   * service role key는 서버에서만 사용, 절대 클라이언트 노출 금지.
3) 단원 CRUD, 활동 CRUD(유형 선택: geogebra/content/problem,
   유형별 입력폼: geogebra→materialId/height, content→본문,
   problem→문제·정답·허용오차).
요약 후 멈춘다.
```

## STEP 4 — 학생: 단원/활동 실행 + 진행기록

```
STEP 4를 진행한다.
1) 학생 대시보드(/dashboard): 자기 학년/반의 공개 단원 목록.
2) 단원 → 활동 목록 → 활동 실행 화면:
   - geogebra: GeoGebra deployggb.js 로 materialId 임베드
   - content: 본문 렌더
   - problem: 정답 제출·채점(허용오차 반영), 결과 표시
3) 활동 완료/제출 시 progress upsert.
4) AI 기능 자리: /activity/[id] 안에 'socratic', 'feedback' 탭을
   비활성(stub)으로 만들어 두되 이번엔 구현하지 않는다.
요약 후 멈춘다.
```

## STEP 5 — 마감

```
STEP 5를 진행한다.
1) README에 로컬 실행법, Supabase 세팅법, Vercel 배포법, 환경변수
   목록을 정리한다.
2) 시드 데이터(예시 단원 1개 + geogebra/content/problem 활동 각 1개)를
   넣는 스크립트를 만든다.
3) 교사 최초 계정 생성 방법을 문서화한다.
요약 후 멈춘다.
```

---

## 2단계(AI) 착수 시 별도 프롬프트 (지금은 실행하지 말 것)

```
2단계를 시작한다. docs/03_AI_FEATURES.md 를 읽고 그 설계를 따른다.
소크라테스 챗봇과 단계별 첨삭을 구현하되, 모든 AI 호출은 서버측
API Route에서만 하고, ai_usage 기반 학생별 일일 한도와 응답 캐싱을
반드시 적용한다.
```
