import "server-only";
import { callChatJson, callChatJsonWithImages } from "@/lib/ai/provider";
import { getSystemPrompt } from "@/lib/ai/prompts";
import type { Provider } from "@/lib/ai/models";

type Call = { provider: Provider; model: string };

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

// 모드별 시스템 프롬프트(DB override or 기본값) + JSON 스키마
async function config(mode: FeedbackMode) {
  return mode === "socratic"
    ? { system: await getSystemPrompt("feedback_socratic"), schema: SOCRATIC_SCHEMA }
    : { system: await getSystemPrompt("feedback_correction"), schema: CORRECTION_SCHEMA };
}

// 텍스트 풀이 첨삭
export async function reviewSolutionText(params: {
  call: Call;
  mode: FeedbackMode;
  question: string;
  solution: string;
}): Promise<CorrectionResult | SocraticResult> {
  const { system, schema } = await config(params.mode);
  return callChatJson(params.call, {
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
  call: Call;
  mode: FeedbackMode;
  question: string;
  images: string[];
}): Promise<CorrectionResult | SocraticResult> {
  const { system, schema } = await config(params.mode);
  return callChatJsonWithImages(params.call, {
    system,
    text: `[문제]\n${params.question}\n\n[학생 풀이] — 아래 이미지는 학생이 손으로 쓴 풀이입니다. 순서대로 읽어 분석하세요.`,
    images: params.images,
    schema: schema as unknown as Record<string, unknown>,
  });
}
