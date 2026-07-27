# 수학 학습 플랫폼

고등학교 교사가 운영하는 AI 학습 플랫폼.
학생은 학번으로 로그인해 단원별 활동(GeoGebra·자료·문제·사진·HTML 체험)을 수행하고,
**AI 소크라테스 문답**과 **사진/PDF 풀이 첨삭**을 받습니다.
교사는 학생 계정 일괄 생성·활동 관리·기록 다운로드를, 관리자는 교사 계정까지 관리합니다.

> 수학이 아닌 다른 교과로 바꾸는 법과 처음부터 만드는 법:
> [docs/06_BUILD_FROM_SCRATCH.md](docs/06_BUILD_FROM_SCRATCH.md)

## 🚀 5분 만에 내 것으로 배포하기 (원클릭)

아래 버튼을 누르면 이 코드가 **당신의 Vercel 계정**으로 복사·배포됩니다.
(배포 중 Supabase·AI 키를 입력하는 칸이 나옵니다 — 아래 절차 참고)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/sced9120/math-platform&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,AI_PROVIDER,OPENAI_API_KEY&envDescription=Supabase%20URL/키%203개%20+%20AI_PROVIDER(gpt)%20+%20OpenAI%20키&project-name=math-platform&repository-name=math-platform)

> 다른 분이 이 저장소를 자기 GitHub로 복사(fork)했다면, 버튼 주소의 `sced9120` 을 자기 아이디로 바꾸세요.

**배포 순서 (버튼 누르기 전에 Supabase부터):**

1. **Supabase 프로젝트 생성** ([supabase.com](https://supabase.com), Region: Seoul) → SQL Editor에
   [`supabase/setup.sql`](supabase/setup.sql) 전체를 붙여넣고 Run (표·보안정책·함수가 한 번에 만들어짐)
2. Supabase → Project Settings → API 에서 **URL / anon key / service_role key** 복사
3. 위 **Deploy 버튼** 클릭 → 나오는 입력칸에:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` → 2번 값
   - `AI_PROVIDER` → `gpt` (또는 `claude`)
   - `OPENAI_API_KEY` → [OpenAI 키](https://platform.openai.com/api-keys) (claude면 `ANTHROPIC_API_KEY`)
4. 배포 완료 후, 로컬에서 관리자 계정 1개 생성:
   ```bash
   git clone https://github.com/sced9120/math-platform && cd math-platform
   npm install && cp .env.local.example .env.local   # .env.local 에 위 키들 입력
   npm run create-teacher -- admin 관리자 --admin
   ```
   출력된 아이디/초기비번으로 로그인 → 관리자 화면에서 교사·학생 계정을 만들면 끝.

각 단계를 화면과 함께 자세히: [docs/06_BUILD_FROM_SCRATCH.md](docs/06_BUILD_FROM_SCRATCH.md)

## 기술 스택

Next.js (App Router, TypeScript) · Tailwind CSS · Supabase (Postgres + Auth + RLS) · Vercel 배포 · OpenAI/Anthropic

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

### 1-3. 데이터베이스 설정

Supabase 대시보드 **SQL Editor**에 [`supabase/setup.sql`](supabase/setup.sql)
**전체를 한 번에** 붙여넣고 Run 하세요 (테이블·RLS 정책·함수가 모두 만들어집니다).

> `supabase/setup.sql` 은 개별 마이그레이션(`supabase/migrations/0001~0006`)을 하나로 합친 파일입니다.
> supabase CLI를 쓴다면 `supabase db push`.

### 1-4. 관리자·교사 계정 만들기 (최초 1회)

```bash
npm install
npm run create-teacher -- admin 관리자 --admin   # 관리자 (교사 계정까지 관리)
npm run create-teacher -- teacher 김수학          # 일반 교사
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

1. **교사 로그인** → 학생 관리에서 명단(학년,반,번호,이름,비밀번호) 붙여넣기 → 계정 일괄 생성
   (비밀번호 열을 비우면 **`s`+학번**이 초기비밀번호가 됩니다. 예: 10101 → `s10101`.
   학번이 5자리라 Supabase 최소 길이(6자)를 못 넘겨 접두 `s`를 붙입니다)
2. 생성 결과 화면의 **학번·초기비밀번호 표를 CSV 다운로드 또는 인쇄**해서 배포
   (학생이 비밀번호를 잊으면 학생 관리 목록의 **비밀번호 재설정** 버튼 사용)
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
