import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PROVIDER_META, PROVIDERS, type Provider } from "@/lib/ai/models";
import { getAiLimits, DEFAULT_AI_LIMITS } from "@/lib/ai/server";

// 내 AI 설정 (교사 본인 것만): API 키 등록/삭제 + 내 학생이 고를 모델 + 일일 한도
//  - 내 학생의 AI 문답·첨삭과 내 조작 활동 만들기가 이 키를 쓴다.
//  - 저장된 API 키는 어떤 응답에도 원문을 담지 않는다 (등록 여부 + 끝 4자리만).
//  - service role 은 RLS 를 우회하므로, 모든 조회·수정에 owner_id = 나 를 직접 건다.

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

function isProvider(v: unknown): v is Provider {
  return typeof v === "string" && (PROVIDERS as string[]).includes(v);
}

const denied = () => NextResponse.json({ error: "교사만 사용할 수 있습니다." }, { status: 403 });

// GET: 내 키 상태 + 내 모델 목록 + 내 한도 + 제공자 메타(도움말/문서 링크)
export async function GET() {
  const me = await requireStaff();
  if (!me) return denied();
  const admin = createAdminClient();
  const [{ data: secrets }, { data: models }, limits] = await Promise.all([
    admin.from("ai_secrets").select("provider, api_key").eq("owner_id", me),
    admin
      .from("ai_models")
      .select("id, provider, model_id, label, enabled, sort_order")
      .eq("owner_id", me)
      .order("sort_order"),
    getAiLimits(me),
  ]);

  const keyMap = new Map(
    ((secrets as { provider: string; api_key: string }[]) ?? []).map((s) => [
      s.provider,
      s.api_key,
    ])
  );

  const providers = PROVIDERS.map((p) => {
    const stored = keyMap.get(p);
    return {
      provider: p,
      ...PROVIDER_META[p],
      hasStoredKey: !!stored,
      keySuffix: stored ? stored.slice(-4) : null, // 식별용 끝 4자리만
      hasEnvKey: false, // 서버 환경변수 키는 더 이상 쓰지 않는다 (교사별 키만)
    };
  });

  return NextResponse.json({
    providers,
    models: models ?? [],
    limits,
    defaultLimits: DEFAULT_AI_LIMITS,
  });
}

// POST: 키 저장 { kind:"key", provider, apiKey } / 모델 추가 { kind:"model", provider, modelId, label }
//       / 한도 저장 { kind:"limits", socratic, feedback, authoring? }
export async function POST(request: Request) {
  const me = await requireStaff();
  if (!me) return denied();
  const body = await request.json().catch(() => null);
  const admin = createAdminClient();

  if (body?.kind === "key") {
    if (!isProvider(body?.provider)) {
      return NextResponse.json({ error: "잘못된 제공자입니다." }, { status: 400 });
    }
    const apiKey = String(body?.apiKey ?? "").trim();
    if (apiKey.length < 10 || apiKey.length > 300) {
      return NextResponse.json({ error: "API 키 형식이 올바르지 않습니다." }, { status: 400 });
    }
    const { error } = await admin.from("ai_secrets").upsert({
      owner_id: me,
      provider: body.provider,
      api_key: apiKey,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      return NextResponse.json(
        { error: "저장에 실패했습니다. (마이그레이션 0017 실행 여부 확인)" },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (body?.kind === "model") {
    if (!isProvider(body?.provider)) {
      return NextResponse.json({ error: "잘못된 제공자입니다." }, { status: 400 });
    }
    const modelId = String(body?.modelId ?? "").trim();
    const label = String(body?.label ?? "").trim();
    if (!/^[a-zA-Z0-9._:/-]{2,80}$/.test(modelId)) {
      return NextResponse.json(
        { error: "모델 ID 형식이 올바르지 않습니다. (예: gpt-5-mini)" },
        { status: 400 }
      );
    }
    if (!label || label.length > 60) {
      return NextResponse.json({ error: "표시 이름을 1~60자로 입력하세요." }, { status: 400 });
    }
    // 내 목록 맨 뒤 순서로 추가
    const { data: last } = await admin
      .from("ai_models")
      .select("sort_order")
      .eq("owner_id", me)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await admin.from("ai_models").insert({
      owner_id: me,
      provider: body.provider,
      model_id: modelId,
      label,
      enabled: true,
      sort_order: ((last?.sort_order as number | undefined) ?? -1) + 1,
    });
    if (error) return NextResponse.json({ error: "추가에 실패했습니다." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body?.kind === "limits") {
    const values = {
      socratic: Number(body?.socratic),
      feedback: Number(body?.feedback),
      // 조작 활동 만들기(교사 본인) — 보내지 않으면 그대로 둔다
      ...(body?.authoring !== undefined ? { authoring: Number(body.authoring) } : {}),
    };
    for (const v of Object.values(values)) {
      if (!Number.isInteger(v) || v < 1 || v > 500) {
        return NextResponse.json(
          { error: "한도는 1~500 사이의 정수로 입력하세요." },
          { status: 400 }
        );
      }
    }
    const now = new Date().toISOString();
    const { error } = await admin.from("ai_limits").upsert(
      Object.entries(values).map(([feature, daily_limit]) => ({
        owner_id: me,
        feature,
        daily_limit,
        updated_at: now,
      }))
    );
    if (error) {
      return NextResponse.json(
        { error: "저장에 실패했습니다. (마이그레이션 0017 실행 여부 확인)" },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
}

// PATCH: 내 모델 수정 { id, enabled?, label?, sortOrder? }
export async function PATCH(request: Request) {
  const me = await requireStaff();
  if (!me) return denied();
  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? "");
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body?.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body?.label === "string" && body.label.trim()) patch.label = body.label.trim();
  if (typeof body?.sortOrder === "number") patch.sort_order = body.sortOrder;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "수정할 내용이 없습니다." }, { status: 400 });
  }

  const { error } = await createAdminClient()
    .from("ai_models")
    .update(patch)
    .eq("id", id)
    .eq("owner_id", me); // 남의 모델은 건드리지 않는다
  if (error) return NextResponse.json({ error: "수정에 실패했습니다." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE: 내 키 삭제 { kind:"key", provider } / 내 모델 삭제 { kind:"model", id }
export async function DELETE(request: Request) {
  const me = await requireStaff();
  if (!me) return denied();
  const body = await request.json().catch(() => null);
  const admin = createAdminClient();

  if (body?.kind === "key") {
    if (!isProvider(body?.provider)) {
      return NextResponse.json({ error: "잘못된 제공자입니다." }, { status: 400 });
    }
    await admin.from("ai_secrets").delete().eq("owner_id", me).eq("provider", body.provider);
    return NextResponse.json({ ok: true });
  }

  if (body?.kind === "model") {
    const id = String(body?.id ?? "");
    if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
    await admin.from("ai_models").delete().eq("id", id).eq("owner_id", me);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
}
