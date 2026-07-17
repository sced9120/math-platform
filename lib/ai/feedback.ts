import "server-only";
import { aiChatJson } from "@/lib/ai/provider";

// 단계별 풀이 첨삭 (docs/03_AI_FEATURES.md 골격)

export type FeedbackStep = {
  student_step: string;
  verdict: "correct" | "logic_error" | "calc_error" | "unclear";
  comment: string;
};

export type FeedbackResult = {
  steps: FeedbackStep[];
  overall: string;
  next_hint: string;
};

const FEEDBACK_SYSTEM = `너는 고등학교 수학 풀이 첨삭 교사다. 학생 풀이를 단계 단위로 나눠 판정한다.
- 각 단계를 correct/logic_error/calc_error/unclear 중 하나로 판정한다.
- 오류는 "무엇이 왜 틀렸는지" + "정답을 직접 주지 않는 교정 힌트"를 준다.
- 계산 오류(calc_error)와 논리·개념 오류(logic_error)를 명확히 구분한다.
- 총평(overall)은 잘한 점을 먼저, 개선점을 그다음. 격려하는 어조.
- next_hint는 정답 대신 다음 시도를 위한 힌트만 준다.
- 수식은 읽기 쉬운 일반 텍스트로 쓴다 (LaTeX 금지).
- 반드시 지정된 JSON 스키마로만 응답한다.`;

const FEEDBACK_SCHEMA = {
  type: "object",
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          student_step: {
            type: "string",
            description: "학생 풀이에서 발췌한 해당 단계",
          },
          verdict: {
            type: "string",
            enum: ["correct", "logic_error", "calc_error", "unclear"],
          },
          comment: {
            type: "string",
            description: "무엇이 왜 문제인지 + 스스로 고칠 힌트",
          },
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

export const MAX_SOLUTION_LENGTH = 4000;

export async function reviewSolution(params: {
  question: string;
  solution: string;
}): Promise<FeedbackResult> {
  return aiChatJson<FeedbackResult>({
    feature: "feedback",
    system: FEEDBACK_SYSTEM,
    messages: [
      {
        role: "user",
        content: `[문제]\n${params.question}\n\n[학생 풀이]\n${params.solution}`,
      },
    ],
    schema: FEEDBACK_SCHEMA as unknown as Record<string, unknown>,
  });
}
