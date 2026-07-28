# 공통수학2 콘텐츠 · 구조 문서

교과서: **전인태 「공통수학2」 지도서** (2022 개정, 64차시) 기준으로 목차 순서·용어를 맞춤.
원 소재: Amplify 컬렉션 `2025 공통수학2` (현서 정, 17개) → 플랫폼 네이티브 html 활동으로 재구현 + 교과서 대조 보완.

## 구조 (교과 → 단원 → 활동)

```
교과(subject)  공통수학2  ─ grade 1
 ├ 단원(unit)  Ⅰ. 도형의 방정식   활동 10개
 ├ 단원(unit)  Ⅱ. 집합과 명제     활동 7개
 └ 단원(unit)  Ⅲ. 함수와 그래프   활동 5개
```

학생 화면: **내 교과 → 공통수학2 → (단원별로 묶인) 각 활동**
- `/dashboard` 내 교과 · `/subject/[id]` 교과 상세 · `/activity/[id]` 활동
- 사이드메뉴도 같은 트리(교과 ▸ 단원 ▸ 활동)로 펼쳐진다.

DB: `subjects` 테이블 + `units.subject_id` (마이그레이션 `supabase/migrations/0010_subjects.sql`).
교과 미지정(`subject_id = null`) 단원은 예전처럼 `/unit/[id]` 로 계속 동작한다.

## 빌드 / 배포

```bash
# 1) 최초 1회: Supabase SQL Editor 에서 0010_subjects.sql 실행
# 2) 콘텐츠 반영 (교과·단원 자동 생성 + 활동 22개 upsert)
node --env-file=.env.local scripts/build-gongtong2.mjs --publish
```

- `scripts/build-gongtong2.mjs` — 교과/단원/활동을 멱등 upsert. `--publish` 로 전부 공개.
- `scripts/add-extension-screens.mjs` — 각 활동 끝에 "🔭 확장 탐구" 화면 주입(멱등, `EXT:START/END` 마커).

## 활동 목록 (22개)

| 단원 | # | 제목 | 파일 |
|---|---|---|---|
| Ⅰ | 1 | 두 점 사이의 거리 | gongtong2-00-distance-two-points.html |
| Ⅰ | 2 | 선분의 내분 | gongtong2-01-segment-division.html |
| Ⅰ | 3 | 직선의 방정식 | gongtong2-02b-line-equation.html |
| Ⅰ | 4 | 두 직선의 평행과 수직 | gongtong2-02-parallel-perpendicular.html |
| Ⅰ | 5 | 점과 직선 사이의 거리 | gongtong2-03-point-line-distance.html |
| Ⅰ | 6 | 원의 방정식 | gongtong2-04-circle-equation.html |
| Ⅰ | 7 | 원과 직선의 위치 관계 | gongtong2-05-circle-line.html |
| Ⅰ | 8 | 원의 접선의 방정식 | gongtong2-05b-circle-tangent.html |
| Ⅰ | 9 | 평행이동 | gongtong2-06-translation.html |
| Ⅰ | 10 | 대칭이동 | gongtong2-07-reflection.html |
| Ⅱ | 1 | 집합의 뜻과 포함관계 | gongtong2-08-sets-subset.html |
| Ⅱ | 2 | 교집합과 합집합 | gongtong2-09-intersection-union.html |
| Ⅱ | 3 | 여집합과 차집합 | gongtong2-10-complement-difference.html |
| Ⅱ | 4 | 명제와 조건 | gongtong2-11-proposition-condition.html |
| Ⅱ | 5 | 명제 사이의 관계 | gongtong2-12-proposition-relations.html |
| Ⅱ | 6 | 명제의 증명 | gongtong2-13-proof.html |
| Ⅱ | 7 | 범인을 찾아라 (논리 추론) | gongtong2-16b-logic-detective.html |
| Ⅲ | 1 | 함수 | gongtong2-14-function.html |
| Ⅲ | 2 | 합성함수 | gongtong2-15-composite.html |
| Ⅲ | 3 | 역함수 | gongtong2-16-inverse.html |
| Ⅲ | 4 | 유리함수 | gongtong2-20-rational-function.html |
| Ⅲ | 5 | 무리함수 | gongtong2-21-irrational-function.html |

모든 활동은 마지막에 **🔭 확장 탐구** 화면을 가진다(수평 확장 = 타 분야 연결, 수직 확장 = 일반화·근본 원리, 도전 질문).

## 교과서 대조로 발견한 것 (2026-07-28)

1. **선분의 외분은 2022 개정에서 삭제** (신·구 대조표 "삭제: 선분의 외분").
   → 활동 2의 외분 화면은 **"교육과정 외 · 심화"** 배지로 표시(삭제하지 않음).
2. **성취기준 해설**: "내분 도입 전에 **두 점 사이의 거리**를 다루고, 수직선 → 좌표평면으로 확장"
   → 활동 1 신설, 활동 2는 이미 1D→2D 구조라 부합.
3. **[10공수2-02-03] 해설**: 연산 법칙·드모르간은 "**벤 다이어그램으로 확인**하는 정도로"
   → 활동 Ⅱ-2 에 분배법칙 벤 확인 화면 추가.
4. **[10공수2-03-04]**: 유리함수는 **y=(ax+b)/(cx+d)** → k/(x−p)+q 변형이 핵심(교과서 예제 y=(2x−1)/(x+1)).
5. **[10공수2-03-05]**: 무리함수는 **y=√(ax+b)+c** — a<0(왼쪽), −√(아래) 4방향 + y=x²(x≥0)의 역함수.
6. 직선의 방정식은 성취기준에서 빠졌으나 교과서가 중학교 연계로 5차시에 다룸 → 활동 Ⅰ-3 신설.
7. 교과서 실생활 코너 "범인을 찾아라!"(97쪽) → 활동 Ⅱ-7. 정답(2명={A,C}, 1명={C}) 교과서와 일치 검증.

## 렌더링 메모

- 활동은 `sandbox="allow-scripts"` iframe 에 srcDoc 으로 들어간다(앱 세션/쿠키 접근 불가).
- 높이는 고정이 아니라 **iframe 안에서 콘텐츠 높이를 재어 postMessage** 로 알려 준다
  (`components/student/html-activity-frame.tsx`). 화면을 넘길 때마다 높이가 따라와 답변칸이 바로 밑에 붙는다.
- 측정 시 `documentElement.scrollHeight` 는 뷰포트 높이만큼 부풀어 되먹임이 생기므로 쓰지 않는다.
  또 폭이 0인 상태(레이아웃 전/숨김)에서는 보고하지 않는다.
