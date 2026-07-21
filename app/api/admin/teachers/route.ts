import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 교사 계정 생성/삭제 (관리자 전용).
// service role key는 이 서버 코드에서만 사용된다 — 클라이언트 노출 금지.

// 아이디는 학번과 충돌하지 않게 't' 접두사 규칙을 권장(예: tkim) — 검증은 형식만.
const ID_RE = /^[a-z][a-z0-9_]{2,29}$/i;
const PW_CHARS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generatePassword(len = 10): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => PW_CHARS[b % PW_CHARS.length]).join("");
}

// 로그인한 사용자가 관리자인지 확인
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

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "관리자만 사용할 수 있습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const loginId = String(body?.loginId ?? "").trim().toLowerCase();
  const name = String(body?.name ?? "").trim();
  if (!ID_RE.test(loginId)) {
    return NextResponse.json(
      { error: "아이디는 영문으로 시작하는 3~30자(영문·숫자·_)여야 합니다." },
      { status: 400 }
    );
  }
  if (!name) {
    return NextResponse.json({ error: "이름을 입력하세요." }, { status: 400 });
  }

  const admin = createAdminClient();
  const password = generatePassword();

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: `${loginId}@school.local`,
    password,
    email_confirm: true,
  });
  if (authError || !created?.user) {
    const dup = authError?.message?.toLowerCase().includes("already");
    return NextResponse.json(
      { error: dup ? "이미 존재하는 아이디입니다." : "계정 생성에 실패했습니다." },
      { status: dup ? 409 : 500 }
    );
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    name,
    role: "teacher",
    must_change_password: true,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id); // 반쪽 계정 방지
    return NextResponse.json({ error: "프로필 생성에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ loginId, name, password });
}

// 교사 계정 삭제 (관리자 전용). admin 계정은 이 API로 삭제 불가.
export async function DELETE(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "관리자만 사용할 수 있습니다." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const userId: string | undefined = body?.userId;
  if (!userId) {
    return NextResponse.json({ error: "userId가 필요합니다." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (!target || target.role !== "teacher") {
    return NextResponse.json(
      { error: "교사 계정만 삭제할 수 있습니다." },
      { status: 400 }
    );
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json({ error: "삭제에 실패했습니다." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
