import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

// ============================================================
// AI provider 추상화 — 모델 교체/로컬 전환은 이 파일만 수정하면 된다.
// (docs/03_AI_FEATURES.md "AI 호출 추상화 설계")
// AI_PROVIDER 환경변수로 전환: 'gpt'(기본) | 'claude' | 'gemini' | 'local'
// ============================================================

export type AiFeature = "socratic" | "feedback";

export type ChatMessage = { role: "user" | "assistant"; content: string };

const PROVIDER = process.env.AI_PROVIDER ?? "gpt";

// 모델 라우팅 (비용 통제):
//  - socratic: 호출이 잦은 대화 → 저가 모델
//  - feedback: 정밀한 수학 판정 + 구조화 JSON → 상위 모델
const GPT_MODELS: Record<AiFeature, string> = {
  socratic: "gpt-5-mini",
  feedback: "gpt-5",
};

const CLAUDE_MODELS: Record<AiFeature, string> = {
  socratic: "claude-sonnet-5",
  feedback: "claude-opus-4-8",
};

// ---------- 공용 인터페이스 ----------

// 텍스트 응답 (소크라테스 챗봇)
export async function aiChat(params: {
  feature: AiFeature;
  system: string;
  messages: ChatMessage[];
}): Promise<string> {
  switch (PROVIDER) {
    case "gpt":
      return gptChat(params);
    case "claude":
      return claudeChat(params);
    default:
      throw new Error(`AI provider '${PROVIDER}'는 아직 구현되지 않았습니다.`);
  }
}

// JSON 스키마 강제 응답 (첨삭) — 스키마 위반 응답이 나올 수 없다
export async function aiChatJson<T>(params: {
  feature: AiFeature;
  system: string;
  messages: ChatMessage[];
  schema: Record<string, unknown>;
}): Promise<T> {
  switch (PROVIDER) {
    case "gpt":
      return gptChatJson<T>(params);
    case "claude":
      return claudeChatJson<T>(params);
    default:
      throw new Error(`AI provider '${PROVIDER}'는 아직 구현되지 않았습니다.`);
  }
}

// ---------- OpenAI (GPT) ----------

let _openai: OpenAI | null = null;
function openai(): OpenAI {
  if (!_openai) _openai = new OpenAI(); // OPENAI_API_KEY 사용 (서버 전용)
  return _openai;
}

async function gptChat(params: {
  feature: AiFeature;
  system: string;
  messages: ChatMessage[];
}): Promise<string> {
  const response = await openai().chat.completions.create({
    model: GPT_MODELS[params.feature],
    max_completion_tokens: 4000,
    reasoning_effort: "low", // 대화는 저지연·저비용 우선
    messages: [
      { role: "system", content: params.system },
      ...params.messages,
    ],
  });
  return response.choices[0]?.message?.content ?? "";
}

async function gptChatJson<T>(params: {
  feature: AiFeature;
  system: string;
  messages: ChatMessage[];
  schema: Record<string, unknown>;
}): Promise<T> {
  const response = await openai().chat.completions.create({
    model: GPT_MODELS[params.feature],
    max_completion_tokens: 8000,
    reasoning_effort: "medium", // 수학 판정은 추론 필요
    response_format: {
      type: "json_schema",
      json_schema: { name: "response", strict: true, schema: params.schema },
    },
    messages: [
      { role: "system", content: params.system },
      ...params.messages,
    ],
  });
  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("AI 응답이 비어 있습니다.");
  return JSON.parse(text) as T;
}

// ---------- Anthropic (Claude) ----------

let _anthropic: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic(); // ANTHROPIC_API_KEY 사용 (서버 전용)
  return _anthropic;
}

async function claudeChat(params: {
  feature: AiFeature;
  system: string;
  messages: ChatMessage[];
}): Promise<string> {
  const response = await anthropic().messages.create({
    model: CLAUDE_MODELS[params.feature],
    max_tokens: 8000,
    output_config: { effort: "low" },
    system: params.system,
    messages: params.messages,
  });
  const text = response.content.find((b) => b.type === "text");
  return text?.text ?? "";
}

async function claudeChatJson<T>(params: {
  feature: AiFeature;
  system: string;
  messages: ChatMessage[];
  schema: Record<string, unknown>;
}): Promise<T> {
  const response = await anthropic().messages.create({
    model: CLAUDE_MODELS[params.feature],
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: params.system,
    messages: params.messages,
    output_config: {
      format: { type: "json_schema", schema: params.schema },
    },
  });
  const text = response.content.find((b) => b.type === "text");
  if (!text) throw new Error("AI 응답이 비어 있습니다.");
  return JSON.parse(text.text) as T;
}
