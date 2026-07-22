import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type Provider = "openai" | "gemini" | "anthropic";

export type AiModel = {
  id: string;
  provider: Provider;
  model_id: string;
  label: string;
  enabled: boolean;
  sort_order: number;
};

// 관리자가 모델을 하나도 안 넣었을 때 쓰는 기본 목록 (OpenAI 키만 있으면 바로 동작)
export const DEFAULT_MODELS: Omit<AiModel, "id">[] = [
  { provider: "openai", model_id: "gpt-5-mini", label: "GPT-5 mini (빠름·저렴)", enabled: true, sort_order: 0 },
  { provider: "openai", model_id: "gpt-5", label: "GPT-5 (정확)", enabled: true, sort_order: 1 },
];

// 제공자별 메타: 키 발급 도움말 + 공식 모델 문서 링크 (관리자 화면에 노출)
export const PROVIDER_META: Record<
  Provider,
  { label: string; keyName: string; keyHelpUrl: string; modelDocUrl: string; help: string }
> = {
  openai: {
    label: "OpenAI (ChatGPT)",
    keyName: "OPENAI_API_KEY",
    keyHelpUrl: "https://platform.openai.com/api-keys",
    modelDocUrl: "https://platform.openai.com/docs/models",
    help: "platform.openai.com 로그인 → 우측 상단 프로필 → 'API keys' → 'Create new secret key' → sk-... 복사. 결제수단 등록 및 사용 한도 설정 권장.",
  },
  gemini: {
    label: "Google Gemini",
    keyName: "GEMINI_API_KEY",
    keyHelpUrl: "https://aistudio.google.com/app/apikey",
    modelDocUrl: "https://ai.google.dev/gemini-api/docs/models",
    help: "aistudio.google.com → 'Get API key' → 'Create API key' → 복사. ⚠️ 무료 등급은 입력이 모델 학습에 쓰일 수 있으니, 학생 데이터 보호가 필요하면 유료(결제 등록) 등급을 쓰세요.",
  },
  anthropic: {
    label: "Anthropic (Claude)",
    keyName: "ANTHROPIC_API_KEY",
    keyHelpUrl: "https://console.anthropic.com/settings/keys",
    modelDocUrl: "https://docs.claude.com/en/docs/about-claude/models/overview",
    help: "console.anthropic.com → Settings → 'API keys' → 'Create Key' → 복사. 크레딧 충전 필요.",
  },
};

export const PROVIDERS = Object.keys(PROVIDER_META) as Provider[];

// provider별 API 키: DB(ai_secrets) 우선, 없으면 환경변수
const ENV_KEY: Record<Provider, string | undefined> = {
  openai: process.env.OPENAI_API_KEY,
  gemini: process.env.GEMINI_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
};

export async function getApiKey(provider: Provider): Promise<string | null> {
  try {
    const { data } = await createAdminClient()
      .from("ai_secrets")
      .select("api_key")
      .eq("provider", provider)
      .maybeSingle();
    const key = (data?.api_key as string | undefined)?.trim();
    if (key) return key;
  } catch {
    // 테이블 미생성 등 → 환경변수로 폴백
  }
  return ENV_KEY[provider] ?? null;
}

// 활성 모델 목록 (관리자 미설정 시 기본 목록). 학생 선택지로 사용.
export async function getEnabledModels(): Promise<Omit<AiModel, "id">[]> {
  try {
    const { data } = await createAdminClient()
      .from("ai_models")
      .select("provider, model_id, label, enabled, sort_order")
      .eq("enabled", true)
      .order("sort_order");
    const rows = (data as Omit<AiModel, "id">[] | null) ?? [];
    if (rows.length > 0) return rows;
  } catch {
    // 폴백
  }
  return DEFAULT_MODELS;
}

// 학생이 보낸 model_id가 실제 활성 모델인지 검증하고 provider를 반환
export async function resolveModel(
  modelId: string | undefined
): Promise<{ provider: Provider; model_id: string } | null> {
  const models = await getEnabledModels();
  const picked = modelId
    ? models.find((m) => m.model_id === modelId)
    : models[0]; // 미선택 시 첫 번째(기본)
  if (!picked) return null;
  return { provider: picked.provider, model_id: picked.model_id };
}
