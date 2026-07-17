# 여기서 시작하세요 — 수학 학습 플랫폼 킷

브레인스토밍 결과물입니다. Claude Code로 바로 넘길 수 있게 구성했습니다.

## 폴더 구성
```
math-platform/
├─ README_START_HERE.md          ← 지금 이 파일
├─ docs/
│  ├─ 01_ARCHITECTURE.md         ← 전체 설계(스택·데이터모델·로드맵·비용통제)
│  ├─ 02_CLAUDE_CODE_PROMPT.md   ← Claude Code에 붙여넣을 STEP별 프롬프트
│  └─ 03_AI_FEATURES.md          ← 2단계 AI 기능(챗봇·첨삭) 설계+프롬프트
└─ .claude/skills/math-platform-builder/SKILL.md
                                  ← Claude Code가 자동 참조할 재사용 스킬
```

## 사용 순서
1. 이 `math-platform/` 폴더 전체를 새 프로젝트 폴더로 둡니다.
2. 그 폴더에서 **Claude Code**를 엽니다. (`.claude/skills/`가 자동 인식됩니다.)
3. **모델을 Opus 4.8로 올립니다.** 인증·DB·RLS 구현은 Opus 권장.
4. `docs/02_CLAUDE_CODE_PROMPT.md`의 "마스터 프롬프트"를 붙여넣고,
   이어서 STEP 1부터 하나씩 지시합니다.
5. 각 STEP이 끝나면 결과를 확인하고 다음 STEP으로.

## 사전 준비물
- Supabase 프로젝트 1개(무료 티어로 시작 가능) → URL·anon key·service role key
- Vercel 계정(배포용)
- (2단계) Claude/GPT/Gemini API 키 중 하나 이상

## 모델 가이드
- **브레인스토밍/설계 수정**: Sonnet 5 (지금 쓰는 모델) — 충분
- **실제 구현(STEP 1~5)**: Opus 4.8 — 실수 최소화

## 기억할 대전제
- 교사 1인 유지보수 → 단순하게
- AI 비용 개인 부담 → 무제한 호출 금지, 일일 한도+캐싱 필수
- MVP는 "로그인+단원별 활동"만. AI는 2단계.
