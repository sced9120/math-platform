import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PROVIDER_META, PROVIDERS, type Provider } from "@/lib/ai/models";

// AI 키·모델 설정 (관리자 전용)

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

function isProvider(v: unknown): v is Provider {
  return typeof v === "string" && (PROVIDERS as string[]).includes(v);
}

// GET: 제공자별 키 등록 여부(값은 노출 안 함) + 모델 목록
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "관리자만 사용할 수 있습니다." }, { status: 403 });
  }
  const admin = createAdminClient();
  const [{ data: secrets }, { data: models }] = await Promise.all([
    admin.from("ai_secrets").select("provider"),
    admin.from("ai_models").select("*").order("sort_order"),
  ]);
  const hasKey = new Set(((secrets as { provider: string }[]) ?? []).map((s) => s.provider));

  return NextResponse.json({
    providers: PROVIDERS.map((p) => ({
      provider: p,
      ...PROVIDER_META[p],
      hasKey: hasKey.has(p),
    })),
    models: models ?? [],
  });
}

// POST: 액션 분기 — 키 저장 / 모델 추가·수정·삭제
export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "관리자만 사용할 수 있습니다." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const action = body?.action;
  const admin = createAdminClient();

  // 1) API 키 저장/삭제
  if (action === "save_key") {
    if (!isProvider(body?.provider)) {
      return NextResponse.json({ error: "잘못된 제공자입니다." }, { status: 400 });
    }
    const apiKey = String(body?.apiKey ?? "").trim();
    if (apiKey.length === 0) {
      // 빈 값이면 키 삭제 → 환경변수로 폴백
      await admin.from("ai_secrets").delete().eq("provider", body.provider);
      return NextResponse.json({ ok: true, removed: true });
    }
    if (apiKey.length < 10 || apiKey.length > 300) {
      return NextResponse.json({ error: "키 형식이 올바르지 않습니다." }, { status: 400 });
    }
    const { error } = await admin
      .from("ai_secrets")
      .upsert({ provider: body.provider, api_key: apiKey, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: "저장 실패" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // 2) 모델 추가
  if (action === "add_model") {
    if (!isProvider(body?.provider)) {
      return NextResponse.json({ error: "잘못된 제공자입니다." }, { status: 400 });
    }
    const modelId = String(body?.model_id ?? "").trim();
    const label = String(body?.label ?? "").trim();
    if (!modelId || !label) {
      return NextResponse.json({ error: "모델 ID와 표시 이름을 입력하세요." }, { status: 400 });
    }
    const { error } = await admin.from("ai_models").insert({
      provider: body.provider,
      model_id: modelId,
      label,
      enabled: true,
      sort_order: Number(body?.sort_order) || 0,
    });
    if (error) return NextResponse.json({ error: "추가 실패" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // 3) 모델 활성/비활성 토글
  if (action === "toggle_model") {
    const id = String(body?.id ?? "");
    const enabled = !!body?.enabled;
    if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
    await admin.from("ai_models").update({ enabled }).eq("id", id);
    return NextResponse.json({ ok: true });
  }

  // 4) 모델 삭제
  if (action === "delete_model") {
    const id = String(body?.id ?? "");
    if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
    await admin.from("ai_models").delete().eq("id", id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "알 수 없는 요청입니다." }, { status: 400 });
}
