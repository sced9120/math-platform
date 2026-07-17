---
name: math-platform-builder
description: Use this skill whenever working on the high-school math learning platform in this repo — building or editing authentication, student/teacher roles, units and activities, GeoGebra embeds, problem-solving, progress tracking, or the AI features (Socratic chatbot, step-by-step solution feedback). Trigger this for ANY feature work, schema change, or AI integration on this platform, even if the user just says "add a page" or "fix login" without restating the full context. The skill enforces the single-teacher-operator constraints, the cost-control rules for AI calls, and the security/RLS requirements that must never be skipped.
---

# 수학 학습 플랫폼 빌더

이 저장소는 **고등학교 수학 교사가 단독 운영하는 학습 플랫폼**이다. 모든 작업은 아래 제약을 지킨다. 상세 설계는 `docs/01_ARCHITECTURE.md`, `docs/03_AI_FEATURES.md`를 읽고 따른다.

## 절대 제약 (위반 금지)

1. **교사 1인 유지보수.** 과도한 추상화·마이크로서비스·불필요한 의존성 금지. 단순·명료하게.
2. **AI 호출은 서버측 API Route에서만.** API 키를 클라이언트에 노출하지 않는다. Supabase service role key도 서버 전용.
3. **비용 통제 필수.** AI 기능을 건드리면 반드시: 학생별 일일 한도(`ai_usage`) 체크 + 응답 캐싱 + 저가/상위 모델 라우팅을 적용한다. 무제한 호출 코드는 작성하지 않는다.
4. **RLS는 DB에서 강제.** 학생은 자기 데이터만. 프론트 검증만 믿지 않고 Supabase RLS 정책을 함께 작성한다.
5. **개인정보 최소화.** 이메일 미수집. 학번 기반 가상 이메일(`{학번}@school.local`) 사용. 학생에겐 학번만 노출.

## 스택 (고정)

Next.js(App Router, TypeScript) + Tailwind + Supabase(Postgres/Auth/RLS) + Vercel 배포. 조작 SW는 GeoGebra 임베드. 새 프레임워크·DB를 도입하지 않는다.

## 역할 & 인증

- 역할 2종: `student`(자기 학반 공개 활동만) / `teacher`(전체 관리).
- 로그인: 학번+비밀번호 → 내부 가상 이메일로 Supabase Auth.
- 학생 최초 로그인 시 `must_change_password`면 비번변경 강제.

## 데이터 모델 요약

`profiles`(역할/학반/번호/비번변경플래그), `units`(단원), `activities`(type: geogebra|content|problem|socratic|feedback, content jsonb), `progress`(학생×활동, unique), `ai_usage`(일일 카운트). 스키마 변경 시 마이그레이션 SQL + RLS 정책을 함께 작성한다.

## 활동 유형별 처리

- `geogebra`: deployggb.js로 materialId 임베드.
- `content`: 본문 렌더.
- `problem`: 정답 제출·채점(허용오차 반영) → progress upsert.
- `socratic`/`feedback`: AI 기능(2단계). `docs/03_AI_FEATURES.md`의 프롬프트·비용통제 규칙을 그대로 따른다.

## AI 기능 작업 시 체크리스트

- [ ] 호출이 서버측 API Route에 있는가
- [ ] `ai_usage` 일일 한도 체크가 있는가
- [ ] 응답 캐싱(입력 해시)이 있는가
- [ ] provider 스위치(claude/gpt/gemini/local)로 추상화했는가
- [ ] 소크라테스 봇은 절대 최종답을 주지 않는가 / 첨삭은 지정 JSON 스키마로만 응답하는가
- [ ] 학생 데이터 외부 전송 고지·동의 흐름이 있는가

## 작업 방식

큰 기능은 한 번에 쏟지 말고 STEP으로 쪼개 진행하고, 각 STEP 종료 시 요약·확인 후 다음으로 넘어간다. 확신이 안 서는 설계 결정은 임의로 정하지 말고 사용자에게 묻는다.
