import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 최초 설정 — 관리자 계정이 하나도 없을 때만 첫 관리자를 만든다.
//
// 보안 원칙
//  - 이 경로는 로그인 없이 열려 있으므로, "관리자·교사 계정이 0개"인지를
//    서버(service role)가 직접 확인한 뒤에만 생성한다.
//  - 계정이 하나라도 있으면 즉시 403. 즉 한 번 설정되면 다시는 쓸 수 없다.
//  - service role key 는 이 서버 코드에서만 쓰이며 클라이언트로 나가지 않는다.

const ID_RE = /^[a-z][a-z0-9_]{2,29}$/i;

// 관리자/교사 계정이 이미 있는지 (있으면 최초 설정 불가)
async function alreadySetUp(admin: ReturnType<typeof createAdminClient>) {
  const { count, error } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .in("role", ["admin", "teacher"]);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

// 최초 설정이 필요한 상태인지 알려 준다 (화면에서 사용)
export async function GET() {
  try {
    const admin = createAdminClient();
    return NextResponse.json({ needsSetup: !(await alreadySetUp(admin)) });
  } catch (e) {
    // DB 가 아직 준비되지 않은 경우(마이그레이션 전)도 여기로 온다
    return NextResponse.json(
      { needsSetup: false, error: e instanceof Error ? e.message : "확인 실패" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
    if (await alreadySetUp(admin)) {
      return NextResponse.json(
        { error: "이미 설정이 끝난 사이트입니다. 관리자에게 문의하세요." },
        { status: 403 }
      );
    }
  } catch (e) {
    return NextResponse.json(
      {
        error:
          "데이터베이스에 연결하지 못했습니다. 환경변수와 supabase/setup.sql 실행 여부를 확인하세요. (" +
          (e instanceof Error ? e.message : "unknown") +
          ")",
      },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const loginId = String(body?.loginId ?? "").trim().toLowerCase();
  const name = String(body?.name ?? "").trim();
  const password = String(body?.password ?? "");

  if (!ID_RE.test(loginId)) {
    return NextResponse.json(
      { error: "아이디는 영문으로 시작하는 3~30자(영문/숫자/_)여야 합니다." },
      { status: 400 }
    );
  }
  if (name.length < 1 || name.length > 30) {
    return NextResponse.json({ error: "이름을 1~30자로 입력하세요." }, { status: 400 });
  }
  if (password.length < 8 || password.length > 72) {
    return NextResponse.json({ error: "비밀번호는 8자 이상이어야 합니다." }, { status: 400 });
  }

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: `${loginId}@school.local`,
    password,
    email_confirm: true,
  });
  if (authError || !created?.user) {
    return NextResponse.json(
      {
        error: authError?.message?.toLowerCase().includes("already")
          ? `이미 존재하는 아이디입니다: ${loginId}`
          : `계정 생성 실패: ${authError?.message ?? "unknown"}`,
      },
      { status: 400 }
    );
  }

  // 본인이 정한 비밀번호이므로 변경 강제는 하지 않는다
  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    name,
    role: "admin",
    must_change_password: false,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id); // 반쪽 계정 방지
    return NextResponse.json(
      { error: `프로필 생성 실패: ${profileError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, loginId });
}
