import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { getApiKey, type Provider } from "@/lib/ai/models";

// ============================================================
// AI provider 추상화 — OpenAI / Gemini / Anthropic.
// 호출부는 {provider, model}을 넘기고, 키는 DB(ai_secrets) 또는 환경변수에서.
// (docs/03_AI_FEATURES.md "AI 호출 추상화 설계")
// ============================================================

export type ChatMessage = { role: "user" | "assistant"; content: string };

type Call = { provider: Provider; model: string };

async function keyOrThrow(provider: Provider): Promise<string> {
  const key = await getApiKey(provider);
  if (!key) {
    throw new Error(
      `${provider} API 키가 설정되지 않았습니다. 관리자 설정에서 키를 등록하세요.`
    );
  }
  return key;
}

// "data:image/jpeg;base64,XXXX" → { mimeType, data }
function splitDataUrl(url: string): { mimeType: string; data: string } {
  const m = url.match(/^data:(.+?);base64,(.+)$/);
  if (!m) throw new Error("잘못된 이미지 형식입니다.");
  return { mimeType: m[1], data: m[2] };
}

// ---------- 텍스트 응답 (소크라테스 챗봇) ----------
export async function callChat(
  call: Call,
  params: { system: string; messages: ChatMessage[] }
): Promise<string> {
  switch (call.provider) {
    case "openai":
      return openaiChat(call.model, params);
    case "gemini":
      return geminiChat(call.model, params);
    case "anthropic":
      return anthropicChat(call.model, params);
  }
}

// ---------- JSON 스키마 응답 (첨삭, 텍스트 입력) ----------
export async function callChatJson<T>(
  call: Call,
  params: { system: string; messages: ChatMessage[]; schema: Record<string, unknown> }
): Promise<T> {
  const text = params.messages.map((m) => m.content).join("\n");
  return callChatJsonWithImages<T>(call, {
    system: params.system,
    text,
    images: [],
    schema: params.schema,
  });
}

// ---------- JSON 스키마 응답 (첨삭, 텍스트 + 이미지) ----------
export async function callChatJsonWithImages<T>(
  call: Call,
  params: { system: string; text: string; images: string[]; schema: Record<string, unknown> }
): Promise<T> {
  let raw: string;
  switch (call.provider) {
    case "openai":
      raw = await openaiJson(call.model, params);
      break;
    case "gemini":
      raw = await geminiJson(call.model, params);
      break;
    case "anthropic":
      raw = await anthropicJson(call.model, params);
      break;
  }
  if (!raw) throw new Error("AI 응답이 비어 있습니다.");
  return JSON.parse(raw) as T;
}

// ================= OpenAI =================

async function openaiClient(): Promise<OpenAI> {
  return new OpenAI({ apiKey: await keyOrThrow("openai") });
}
// gpt-5 계열만 reasoning_effort를 지원 → 다른 모델엔 넣지 않는다
function openaiExtra(model: string, effort: "low" | "medium") {
  return model.startsWith("gpt-5") ? { reasoning_effort: effort } : {};
}

async function openaiChat(
  model: string,
  params: { system: string; messages: ChatMessage[] }
): Promise<string> {
  const client = await openaiClient();
  const res = await client.chat.completions.create({
    model,
    max_completion_tokens: 4000,
    ...openaiExtra(model, "low"),
    messages: [{ role: "system", content: params.system }, ...params.messages],
  });
  return res.choices[0]?.message?.content ?? "";
}

async function openaiJson(
  model: string,
  params: { system: string; text: string; images: string[]; schema: Record<string, unknown> }
): Promise<string> {
  const client = await openaiClient();
  const content: OpenAI.Chat.ChatCompletionContentPart[] = [
    { type: "text", text: params.text },
    ...params.images.map(
      (url) => ({ type: "image_url", image_url: { url } }) as const
    ),
  ];
  const res = await client.chat.completions.create({
    model,
    max_completion_tokens: 8000,
    ...openaiExtra(model, "medium"),
    response_format: {
      type: "json_schema",
      json_schema: { name: "response", strict: true, schema: params.schema },
    },
    messages: [
      { role: "system", content: params.system },
      { role: "user", content },
    ],
  });
  return res.choices[0]?.message?.content ?? "";
}

// ================= Gemini =================

async function geminiClient(): Promise<GoogleGenAI> {
  return new GoogleGenAI({ apiKey: await keyOrThrow("gemini") });
}

async function geminiChat(
  model: string,
  params: { system: string; messages: ChatMessage[] }
): Promise<string> {
  const ai = await geminiClient();
  const res = await ai.models.generateContent({
    model,
    contents: params.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    config: { systemInstruction: params.system, maxOutputTokens: 4000 },
  });
  return res.text ?? "";
}

async function geminiJson(
  model: string,
  params: { system: string; text: string; images: string[]; schema: Record<string, unknown> }
): Promise<string> {
  const ai = await geminiClient();
  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [{ text: params.text }];
  for (const url of params.images) {
    const { mimeType, data } = splitDataUrl(url);
    parts.push({ inlineData: { mimeType, data } });
  }
  const res = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts }],
    config: {
      // 지정 스키마는 시스템 프롬프트에 명시돼 있으므로 JSON 모드만 켠다
      systemInstruction: params.system,
      responseMimeType: "application/json",
      maxOutputTokens: 8000,
    },
  });
  return res.text ?? "";
}

// ================= Anthropic (Claude) =================

async function anthropicClient(): Promise<Anthropic> {
  return new Anthropic({ apiKey: await keyOrThrow("anthropic") });
}

async function anthropicChat(
  model: string,
  params: { system: string; messages: ChatMessage[] }
): Promise<string> {
  const client = await anthropicClient();
  const res = await client.messages.create({
    model,
    max_tokens: 8000,
    system: params.system,
    messages: params.messages,
  });
  const t = res.content.find((b) => b.type === "text");
  return t?.text ?? "";
}

async function anthropicJson(
  model: string,
  params: { system: string; text: string; images: string[]; schema: Record<string, unknown> }
): Promise<string> {
  const client = await anthropicClient();
  const blocks: Anthropic.ContentBlockParam[] = [{ type: "text", text: params.text }];
  for (const url of params.images) {
    const { mimeType, data } = splitDataUrl(url);
    blocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data,
      },
    });
  }
  const res = await client.messages.create({
    model,
    max_tokens: 16000,
    system: params.system,
    messages: [{ role: "user", content: blocks }],
    output_config: { format: { type: "json_schema", schema: params.schema } },
  });
  const t = res.content.find((b) => b.type === "text");
  return t?.text ?? "";
}
