import "server-only";
import { callChat, type ChatMessage } from "@/lib/ai/provider";
import { getSystemPrompt } from "@/lib/ai/prompts";
import type { Provider } from "@/lib/ai/models";

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
  provider: Provider;
  model: string;
  activityContext: string;
  messages: ChatMessage[];
}): Promise<string> {
  const base = await getSystemPrompt("chat_socratic");
  const system = `${base}

[지금 학생이 학습 중인 활동]
${params.activityContext}`;

  return callChat(
    { provider: params.provider, model: params.model },
    { system, messages: params.messages }
  );
}
