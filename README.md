# 수학 학습 플랫폼

고등학교 수학 교사가 단독 운영하는 학습 플랫폼 (MVP).
학생은 학번으로 로그인해 단원별 활동(GeoGebra 조작 · 자료 열람 · 문제 풀이)을 수행하고,
교사는 학생 계정 일괄 생성과 단원/활동 관리, 진행현황을 담당합니다.

> 전체 설계: [docs/01_ARCHITECTURE.md](docs/01_ARCHITECTURE.md) ·
> 2단계 AI 기능 설계: [docs/03_AI_FEATURES.md](docs/03_AI_FEATURES.md)

## 기술 스택

Next.js (App Router, TypeScript) · Tailwind CSS · Supabase (Postgres + Auth + RLS) · Vercel 배포 · GeoGebra 임베드

---

## 1. 처음 설정하기

### 1-1. Supabase 프로젝트 만들기

1. [supabase.com](https://supabase.com) → **New project** (Region: Northeast Asia — Seoul 권장)
2. **Project Settings → API Keys** 에서 세 값을 확인:
   - Project URL
   - anon(public) key
   - service_role(secret) key

### 1-2. 환경변수

```bash
cp .env.local.example .env.local
```

| 변수 | 용도 | 노출 범위 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | 클라이언트 공개 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 공개 키 (RLS로 보호됨) | 클라이언트 공개 |
| `SUPABASE_SERVICE_ROLE_KEY` | 관리자 키 — **RLS 우회** | **서버 전용. 절대 클라이언트/저장소에 노출 금지** |

### 1-3. 데이터베이스 마이그레이션

Supabase 대시보드 **SQL Editor**에서 아래 파일 내용을 **순서대로** 붙여넣어 실행:

1. `supabase/migrations/0001_init.sql` — 테이블 + RLS 정책
2. `supabase/migrations/0002_step4_answer_security.sql` — 정답 은닉 · 채점 함수 · 치팅 방지

(supabase CLI를 쓴다면 `supabase db push`)

### 1-4. 교사 계정 만들기 (최초 1회)

```bash
npm install
npm run create-teacher -- <아이디> <이름>
# 예: npm run create-teacher -- teacher 김수학
```

- 출력된 초기비밀번호로 로그인하면 **비밀번호 변경이 강제**됩니다.
- 교사 계정은 강력한 비밀번호를 사용하세요 (전체 학생 데이터에 접근 가능).
- 스크립트를 못 쓰는 상황이면 수동으로도 가능:
  대시보드 **Authentication → Add user**로 `아이디@school.local` 생성(Auto confirm 체크) 후,
  SQL Editor에서 `insert into profiles (id, name, role) values ('<user id>', '이름', 'teacher');`

### 1-5. (선택) 예시 데이터 넣기

```bash
npm run seed
```

"예시 단원 — 이차함수"(1학년, 공개)와 GeoGebra/자료/문제 활동 각 1개가 생성됩니다.
교사 화면(단원/활동 관리)에서 수정·삭제할 수 있습니다.

---

## 2. 로컬 실행

```bash
npm install
npm run dev
```

http://localhost:3000 접속. (포트가 사용 중이면 `PORT=3001 npm run dev`)

## 3. 운영 흐름

1. **교사 로그인** → 학생 관리에서 명단(학년,반,번호,이름) 붙여넣기 → 계정 일괄 생성
2. 생성 결과 화면의 **학번·초기비밀번호 표를 CSV 다운로드 또는 인쇄**해서 배포
   (초기비밀번호는 그 화면에서만 볼 수 있습니다)
3. 단원/활동 관리에서 콘텐츠 구성 → **공개** 토글을 켜야 학생에게 보입니다
4. 학생은 학번+초기비밀번호로 로그인 → 비밀번호 변경 → 활동 수행

**학번 규칙**: 학년(1자리) + 반(2자리) + 번호(2자리). 예: 1학년 3반 15번 → `10315`
내부적으로는 `10315@school.local` 가상 이메일로 처리되며 실제 이메일은 수집하지 않습니다.

## 4. Vercel 배포

1. 이 폴더를 GitHub 저장소에 push (`.env.local`은 자동으로 제외됨)
2. [vercel.com](https://vercel.com) → **Add New Project** → 저장소 import (Next.js 자동 인식)
3. **Environment Variables**에 위 3개 변수 입력 → Deploy
4. 배포 후 발급된 도메인으로 접속 확인

## 5. 프로젝트 구조

```
app/
├─ login/, change-password/     인증
├─ (student)/                   학생: dashboard, unit/[id], activity/[id]
├─ teacher/                     교사: students(일괄 생성), units(단원/활동 CRUD)
└─ api/teacher/students/        학생 계정 생성/삭제 (service role, 서버 전용)
components/                     student/, teacher/ UI 컴포넌트
lib/supabase/                   client(브라우저) / server(서버) / admin(service role) / proxy(세션)
supabase/migrations/            SQL 마이그레이션 (SQL Editor에 순서대로 실행)
scripts/                        seed.mjs, create-teacher.mjs
proxy.ts                        비로그인 차단 + 세션 갱신 (Next.js 16의 middleware)
docs/                           설계 문서
```

## 6. 보안 메모

- 모든 데이터 접근은 **RLS로 DB에서 강제** — 학생은 자기 학년의 공개 콘텐츠와 자기 기록만.
- 문제 정답은 학생에게 **어떤 API로도 내려가지 않습니다** (채점은 DB 함수 `submit_answer`).
- `service_role` 키가 노출됐다면 대시보드에서 즉시 rotate 하세요.

## 7. 다음 단계 (2단계 — AI)

소크라테스 챗봇 · 단계별 첨삭. 착수 시 [docs/03_AI_FEATURES.md](docs/03_AI_FEATURES.md)와
[docs/02_CLAUDE_CODE_PROMPT.md](docs/02_CLAUDE_CODE_PROMPT.md) 하단의 2단계 프롬프트를 사용하세요.
`ai_usage` 테이블(일일 한도)은 이미 준비되어 있습니다.
