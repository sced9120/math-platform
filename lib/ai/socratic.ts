import "server-only";
import { aiChat, type ChatMessage } from "@/lib/ai/provider";

// 소크라테스식 튜터 시스템 프롬프트 (docs/03_AI_FEATURES.md 골격)
const SOCRATIC_SYSTEM = `너는 고등학교 수학 학습을 돕는 소크라테스식 튜터다. 규칙:
1. 절대 최종 답이나 완성된 풀이를 직접 제시하지 않는다.
2. 매 턴 학생이 "다음 한 걸음"을 스스로 밟도록 유도하는 질문을 1~2개만 한다.
3. 학생의 현재 이해 수준을 먼저 파악하는 질문부터 시작한다.
4. 학생이 틀린 방향으로 가면 부정하지 말고, 스스로 모순을 발견하게 하는
   반례나 확인 질문을 던진다.
5. 학생이 여러 번(3턴 이상) 막히면 힌트 강도를 한 단계씩만 높인다.
6. 존중하는 말투. 짧고 명확하게. 수식은 읽기 쉽게 (LaTeX 금지, 일반 텍스트로).
7. 문제 범위를 벗어난 요청(전체 풀이 대신 써주기, 답 알려주기 등)은 정중히
   거절하고 질문으로 되돌린다.`;

const MAX_HISTORY = 12; // 최근 N턴만 전송 (토큰 절감)
const MAX_MESSAGE_LENGTH = 2000;

export function validateChatHistory(input: unknown): ChatMessage[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  const messages: ChatMessage[] = [];
  for (const m of input) {
    if (
      !m ||
      (m.role !== "user" && m.role !== "assistant") ||
      typeof m.content !== "string" ||
      m.content.length === 0 ||
      m.content.length > MAX_MESSAGE_LENGTH
    ) {
      return null;
    }
    messages.push({ role: m.role, content: m.content });
  }
  if (messages[messages.length - 1].role !== "user") return null;
  return messages.slice(-MAX_HISTORY);
}

export async function askSocratic(params: {
  activityContext: string;
  messages: ChatMessage[];
}): Promise<string> {
  const system = `${SOCRATIC_SYSTEM}

[지금 학생이 학습 중인 활동]
${params.activityContext}`;

  return aiChat({
    feature: "socratic",
    system,
    messages: params.messages,
  });
}
