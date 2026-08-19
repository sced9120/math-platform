# 화면 중심 구조 (설계) — 활동을 화면 단위로 쪼개기

지금은 활동 하나가 **HTML 한 덩어리**다. 이 문서는 그것을 **화면 단위**로 바꾸는 설계다.
아직 구현 전이며, 이 문서가 작업 지시서다.

## 1. 왜 바꾸나

실제로 겪은 문제 세 가지.

1. **한 화면만 고치려면 통짜 코드를 건드려야 한다.** 활동 하나에 스크립트가 하나뿐이다.
2. **한 화면이 깨지면 나머지 화면의 조작까지 멈춘다.** 전부 하나의 IIFE 안에서 돈다.
3. **화면을 다른 활동으로 옮기면 코드가 따라오지 않는다.**
   Ⅰ-1 을 합칠 때(2026-08-19) id 충돌·스테퍼 중복을 스크립트로 일일이 풀어야 했다
   (`scripts/merge-activities.mjs` 참고).

## 2. 큰 그림 — 화면 넘김을 HTML 에서 빼서 플랫폼으로

지금은 스테퍼(◀ ▶ 화면 번호)가 **활동 HTML 안**에 있다. 이것을 플랫폼(React)이 맡는다.
그래야 화면 하나가 독립된 조각이 되고, 화면마다 유형을 다르게 줄 수 있다.

```
활동 = 화면[]                      ← 순서·소속만 관리
화면 = 유형 + 설정 + 질문[]         ← 편집 단위
```

### 화면 유형

| 유형 | 화면칸에 넣는 것 | 코드 |
| --- | --- | --- |
| `text` | 제목 + 본문(설명·정리표) | 없음 |
| `plane` | 좌표평면: 범위·격자·점/직선/원·드래그 여부를 **설정으로** | 없음 |
| `geogebra` | geogebra.org 자료 ID | 없음 |
| `image` | 사진(activity-files 버킷) | 없음 |
| `html` | 이 화면만의 HTML+JS | 있음 (**화면 단위**) |
| `legacy` | 기존 활동 HTML 통째 | 기존 그대로 |

`plane` 이 이득이 가장 크다. 지금 활동 상당수가 *평면 + 점 몇 개 드래그 + 수치 표시* 구조이고,
**모든 활동 파일에 똑같은 `Plane` 헬퍼가 복사돼 있다**. 이것을 플랫폼 라이브러리로 한 번 빼면
그런 화면은 코드 없이 설정만으로 만들 수 있다.

## 3. 데이터

### 3.1 화면 테이블

활동 content 안에 배열로 넣지 않고 **행으로 둔다**. 화면을 다른 활동으로 옮기는 것이
`update` 한 줄이 되기 때문이다(이번에 손으로 한 "뭉치기"가 클릭 두 번이 된다).

```sql
create table public.activity_screens (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  screen_key  text not null,            -- 활동 안에서 고유. 학생 기록이 이 값으로 저장된다
  order_index int  not null default 0,
  type        text not null check (type in ('text','plane','geogebra','image','html','legacy')),
  title       text not null default '', -- 화면 제목(h1)
  config      jsonb not null default '{}'::jsonb,   -- 유형별 설정
  questions   jsonb not null default '[]'::jsonb,   -- 아래 3.2
  sheet       text not null default '', -- 학습지 배지 (예: 학습지 1-01 [생각 틔우기] Q1)
  teach       jsonb not null default '{}'::jsonb,   -- 수업 진행 칩(보여주며 조작/교과서 펴기 등)
  unique (activity_id, screen_key)
);
```

**`screen_key` 는 한번 정하면 바꾸지 않는다.** 학생 기록이 이 값으로 붙어 있다.

### 3.2 질문

화면당 여러 개. 버튼으로 추가한다.

```ts
type Question =
  | { id: string; type: "text";   prompt: string; photo?: boolean }  // 서술형(+사진 첨부 허용)
  | { id: string; type: "short";  prompt: string; answer: string; tolerance?: number } // 단답 자동채점
  | { id: string; type: "choice"; prompt: string; choices: string[]; answer: number }; // 선택형
```

**정답은 학생에게 내려보내지 않는다.** `student_activities()` 가 problem 유형의 answer 를
걷어내듯, 화면 조회 RPC 도 `short`/`choice` 의 `answer`·`tolerance` 를 제거한 뒤 내려준다.
채점은 DB 함수에서만 한다(기존 `submit_answer` 와 같은 원칙).

### 3.3 학생 기록

`screen_responses` 를 그대로 쓰되 질문 단위로 넓힌다(마이그레이션 0013).

```sql
alter table public.screen_responses add column question_key text not null default '';
-- 기본키를 (student_id, activity_id, screen_key, question_key) 로 교체
```

기존 행은 `question_key = ''` 로 남아 그대로 읽힌다.

## 4. 렌더링

화면 유형에 따라 **플랫폼이 컴포넌트를 고른다.** iframe 은 `html`·`legacy` 에서만 쓴다.

```
<ScreenStepper>            ← 화면 넘김 (React)
  <ScreenView screen>      ← 유형별 렌더러
    text     → 본문 렌더
    plane    → <PlaneCanvas config>   (공용 Plane 라이브러리)
    geogebra → <GeoGebraEmbed materialId>   (이미 있음)
    image    → <img>
    html     → <HtmlActivityFrame html={그 화면만}>
    legacy   → <HtmlActivityFrame html={활동 통째}>
  <QuestionList questions>  ← 서술/사진/단답/선택 (기존 ScreenResponse 확장)
```

`html` 화면의 코드는 각자 iframe 이라 **한 화면이 깨져도 다른 화면은 멀쩡하다.**

## 5. 기존 32개 활동은 어떻게

**자동으로 화면별 코드로 쪼개는 것은 불가능하다고 판단했다.** 확인 결과 `// 화면N` 주석이
화면 수와 맞지 않고(9화면인데 주석 0개인 파일도 있다) 여러 화면이 공유하는 블록도 있다.
잘못 쪼개면 조용히 망가진다.

그래서 **기존 활동 = `legacy` 화면 하나**로 감싼다. 동작은 지금과 완전히 같다.
손볼 일이 생긴 화면부터 하나씩 새 유형으로 옮긴다.
오늘 만든 화면 관리(순서·질문·글 편집, `lib/activity-html.ts`)는 legacy 활동에서 계속 쓴다.

## 6. 단계

| 단계 | 내용 | 눈에 보이는 변화 |
| --- | --- | --- |
| 1 | 스키마 + 유형별 렌더러 + 플랫폼 스테퍼. 기존 활동은 legacy 화면 하나 | 없음(동작 동일) |
| 2 | 화면 편집기 — 유형 고르기, 질문 버튼식 추가, 화면을 다른 활동으로 옮기기 | 큼 |
| 3 | `plane` 유형 + `Plane` 라이브러리 추출 | 새 화면을 코드 없이 제작 |
| 4 | (선택) 기존 활동에서 화면 하나씩 떼어내는 도우미 | — |

1단계만으로는 보이는 변화가 없으므로 **1+2 를 한 묶음**으로 진행한다.

## 7. 작업 시 주의

- 새 스키마·렌더러·편집기라 학생 화면이 흔들릴 수 있다. **브랜치에서 진행하고 확인 후 합친다.**
- 수업이 있는 날 배포하지 않는다.
- 정답(`answer`)이 클라이언트로 새지 않는지 매 단계 확인한다.
- 화면키를 바꾸거나 재사용하지 않는다(학생 기록이 끊긴다).
