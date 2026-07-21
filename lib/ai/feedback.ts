import "server-only";
import { aiChatJson, aiChatJsonWithImages } from "@/lib/ai/provider";

// 문제풀이 첨삭 — 두 가지 모드
//  - correction: 단계별 오류 판정 (docs/03_AI_FEATURES.md 골격)
//  - socratic: 정답 대신 사고를 여는 발문(소크라테스식)
// 입력은 텍스트 또는 사진/PDF(이미지 배열).

export type FeedbackMode = "correction" | "socratic";

export const MAX_SOLUTION_LENGTH = 4000;
export const MAX_IMAGES = 5;

// ---------- 모드 A: 오류 첨삭 ----------

export type FeedbackStep = {
  student_step: string;
  verdict: "correct" | "logic_error" | "calc_error" | "unclear";
  comment: string;
};

export type CorrectionResult = {
  steps: FeedbackStep[];
  overall: string;
  next_hint: string;
};

const CORRECTION_SYSTEM = `너는 고등학교 수학 풀이 첨삭 교사다. 학생 풀이를 단계 단위로 나눠 판정한다.
- 각 단계를 correct/logic_error/calc_error/unclear 중 하나로 판정한다.
- 오류는 "무엇이 왜 틀렸는지" + "정답을 직접 주지 않는 교정 힌트"를 준다.
- 계산 오류(calc_error)와 논리·개념 오류(logic_error)를 명확히 구분한다.
- 총평(overall)은 잘한 점을 먼저, 개선점을 그다음. 격려하는 어조.
- next_hint는 정답 대신 다음 시도를 위한 힌트만 준다.
- 수식은 읽기 쉬운 일반 텍스트로 쓴다 (LaTeX 금지).
- 반드시 지정된 JSON 스키마로만 응답한다.`;

const CORRECTION_SCHEMA = {
  type: "object",
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          student_step: { type: "string", description: "학생 풀이에서 발췌한 해당 단계" },
          verdict: {
            type: "string",
            enum: ["correct", "logic_error", "calc_error", "unclear"],
          },
          comment: { type: "string", description: "무엇이 왜 문제인지 + 스스로 고칠 힌트" },
        },
        required: ["student_step", "verdict", "comment"],
        additionalProperties: false,
      },
    },
    overall: { type: "string", description: "총평 — 잘한 점 먼저, 개선점 그다음" },
    next_hint: { type: "string", description: "정답 대신 다음 시도를 위한 힌트" },
  },
  required: ["steps", "overall", "next_hint"],
  additionalProperties: false,
} as const;

// ---------- 모드 B: 소크라테스식 발문 ----------

export type SocraticQuestion = { focus: string; question: string };

export type SocraticResult = {
  read_back: string;
  questions: SocraticQuestion[];
  encouragement: string;
};

const SOCRATIC_SYSTEM = `너는 고등학교 수학의 소크라테스식 튜터다. 학생의 풀이(텍스트 또는 손글씨 사진)를 보고,
정답이나 완성된 풀이를 절대 알려주지 않는다. 대신:
- read_back: 학생이 지금까지 무엇을 시도했는지 한두 문장으로 짚어 준다(사진이면 읽은 내용을 요약).
- questions: 학생이 스스로 다음 한 걸음을 밟도록 여는 발문을 2~3개 만든다.
  각 발문은 정답을 유도하되 답 자체를 담지 않는다. focus에는 어느 부분에 대한 질문인지 적는다.
- encouragement: 짧고 진심 어린 격려.
- 틀린 부분이 있으면 "틀렸다"고 단정하지 말고, 스스로 모순을 발견하게 하는 확인 질문을 던진다.
- 수식은 읽기 쉬운 일반 텍스트로 (LaTeX 금지).
- 반드시 지정된 JSON 스키마로만 응답한다.`;

const SOCRATIC_SCHEMA = {
  type: "object",
  properties: {
    read_back: { type: "string", description: "학생 풀이 요약(사진이면 읽은 내용)" },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          focus: { type: "string", description: "어느 부분/단계에 대한 질문인지" },
          question: { type: "string", description: "정답을 담지 않는 사고 유도 발문" },
        },
        required: ["focus", "question"],
        additionalProperties: false,
      },
    },
    encouragement: { type: "string", description: "짧은 격려" },
  },
  required: ["read_back", "questions", "encouragement"],
  additionalProperties: false,
} as const;

// ---------- 진입점 ----------

function config(mode: FeedbackMode) {
  return mode === "socratic"
    ? { system: SOCRATIC_SYSTEM, schema: SOCRATIC_SCHEMA }
    : { system: CORRECTION_SYSTEM, schema: CORRECTION_SCHEMA };
}

// 텍스트 풀이 첨삭
export async function reviewSolutionText(params: {
  mode: FeedbackMode;
  question: string;
  solution: string;
}): Promise<CorrectionResult | SocraticResult> {
  const { system, schema } = config(params.mode);
  return aiChatJson({
    feature: "feedback",
    system,
    messages: [
      {
        role: "user",
        content: `[문제]\n${params.question}\n\n[학생 풀이]\n${params.solution}`,
      },
    ],
    schema: schema as unknown as Record<string, unknown>,
  });
}

// 사진/PDF 풀이 첨삭
export async function reviewSolutionImages(params: {
  mode: FeedbackMode;
  question: string;
  images: string[];
}): Promise<CorrectionResult | SocraticResult> {
  const { system, schema } = config(params.mode);
  return aiChatJsonWithImages({
    feature: "feedback",
    system,
    text: `[문제]\n${params.question}\n\n[학생 풀이] — 아래 이미지는 학생이 손으로 쓴 풀이입니다. 순서대로 읽어 분석하세요.`,
    images: params.images,
    schema: schema as unknown as Record<string, unknown>,
  });
}
