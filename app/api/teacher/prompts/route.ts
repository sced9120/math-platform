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

// 내 AI 프롬프트 조회/수정/복원 (교사 본인 것만)
// 내 학생의 문답·첨삭 AI 가 이 프롬프트를 쓴다. 고치지 않은 것은 기본 프롬프트.
// service role 은 RLS 를 우회하므로, 모든 조회·수정에 owner_id = 나 를 직접 건다.

async function requireStaff(): Promise<string | null> {
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
  return me?.role === "teacher" || me?.role === "admin" ? user.id : null;
}

function isPromptKey(v: unknown): v is PromptKey {
  return typeof v === "string" && (PROMPT_KEYS as string[]).includes(v);
}

const denied = () => NextResponse.json({ error: "교사만 사용할 수 있습니다." }, { status: 403 });

// GET: 각 프롬프트의 현재값(내가 고친 것이 있으면 그것) + 기본값 + 고쳤는지
export async function GET() {
  const me = await requireStaff();
  if (!me) return denied();
  const { data } = await createAdminClient()
    .from("ai_prompts")
    .select("key, content")
    .eq("owner_id", me);
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

// POST: 내 프롬프트 저장 { key, content }
export async function POST(request: Request) {
  const me = await requireStaff();
  if (!me) return denied();
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

  const { error } = await createAdminClient()
    .from("ai_prompts")
    .upsert({ owner_id: me, key, content, updated_at: new Date().toISOString() });
  if (error) {
    return NextResponse.json(
      { error: "저장에 실패했습니다. (마이그레이션 0017 실행 여부 확인)" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

// DELETE: 기본값으로 복원 (내가 고친 것 삭제) { key }
export async function DELETE(request: Request) {
  const me = await requireStaff();
  if (!me) return denied();
  const body = await request.json().catch(() => null);
  const key = body?.key;
  if (!isPromptKey(key)) {
    return NextResponse.json({ error: "잘못된 프롬프트 종류입니다." }, { status: 400 });
  }
  await createAdminClient().from("ai_prompts").delete().eq("owner_id", me).eq("key", key);
  return NextResponse.json({ ok: true, default: DEFAULT_PROMPTS[key] });
}
