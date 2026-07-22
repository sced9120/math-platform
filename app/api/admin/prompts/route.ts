import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_PROMPTS,
  MAX_PROMPT_LENGTH,
  PROMPT_KEYS,
  PROMPT_META,
  type PromptKey,
} from "@/lib/ai/prompts";

// AI 프롬프트 조회/수정/복원 (관리자 전용)

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return me?.role === "admin" ? user : null;
}

function isPromptKey(v: unknown): v is PromptKey {
  return typeof v === "string" && (PROMPT_KEYS as string[]).includes(v);
}

// GET: 각 프롬프트의 현재값(override 있으면 그것) + 기본값 + 커스텀 여부
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "관리자만 사용할 수 있습니다." }, { status: 403 });
  }
  const admin = createAdminClient();
  const { data } = await admin.from("ai_prompts").select("key, content");
  const overrides = new Map(
    ((data as { key: string; content: string }[]) ?? []).map((r) => [r.key, r.content])
  );

  const prompts = PROMPT_KEYS.map((key) => ({
    key,
    label: PROMPT_META[key].label,
    desc: PROMPT_META[key].desc,
    default: DEFAULT_PROMPTS[key],
    content: overrides.get(key) ?? DEFAULT_PROMPTS[key],
    customized: overrides.has(key),
  }));
  return NextResponse.json({ prompts });
}

// POST: 프롬프트 저장(override). { key, content }
export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "관리자만 사용할 수 있습니다." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const key = body?.key;
  if (!isPromptKey(key)) {
    return NextResponse.json({ error: "잘못된 프롬프트 종류입니다." }, { status: 400 });
  }
  const content = String(body?.content ?? "").trim();
  if (content.length < 10 || content.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      { error: `프롬프트는 10자 이상 ${MAX_PROMPT_LENGTH}자 이하로 입력하세요.` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("ai_prompts")
    .upsert({ key, content, updated_at: new Date().toISOString() });
  if (error) {
    return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// DELETE: 기본값으로 복원 (override 삭제). { key }
export async function DELETE(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "관리자만 사용할 수 있습니다." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const key = body?.key;
  if (!isPromptKey(key)) {
    return NextResponse.json({ error: "잘못된 프롬프트 종류입니다." }, { status: 400 });
  }
  const admin = createAdminClient();
  await admin.from("ai_prompts").delete().eq("key", key);
  return NextResponse.json({ ok: true, default: DEFAULT_PROMPTS[key] });
}
