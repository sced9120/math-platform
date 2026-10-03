import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSignupOpen } from "@/lib/site-settings";
import { generateClassCode } from "@/lib/class-code";

// 교사 가입 — 누구나 교사 계정을 만들어 "내 학급"을 꾸린다.
//
// 보안 원칙
//  - 로그인 없이 열린 경로라, 관리자가 가입을 열어 둔 경우에만 만든다(사이트 설정).
//  - 만들 수 있는 역할은 teacher 뿐이다. admin 은 절대 만들지 않는다.
//  - 새 교사는 자기 자료·자기 학생만 보도록 DB 정책(0017)이 막아 준다. 학교 학생 명단도 안 보인다.
//  - service role key 는 이 서버 코드에서만 쓰이며 클라이언트로 나가지 않는다.

const ID_RE = /^[a-z][a-z0-9_]{2,29}$/; // 영문으로 시작 → 숫자뿐인 학번과 겹치지 않는다

export async function GET() {
  return NextResponse.json({ open: await isSignupOpen() });
}

export async function POST(request: Request) {
  if (!(await isSignupOpen())) {
    return NextResponse.json(
      { error: "지금은 교사 가입을 받지 않습니다. 사이트 관리자에게 문의하세요." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  // 사람 눈에 안 보이는 칸 — 채워져 있으면 자동 가입 봇으로 본다
  if (String(body?.website ?? "").length > 0) {
    return NextResponse.json({ error: "가입할 수 없습니다." }, { status: 400 });
  }

  const loginId = String(body?.loginId ?? "").trim().toLowerCase();
  const name = String(body?.name ?? "").trim();
  const password = String(body?.password ?? "");

  if (!ID_RE.test(loginId)) {
    return NextResponse.json(
      { error: "아이디는 영문 소문자로 시작하는 3~30자(영문·숫자·_)여야 합니다." },
      { status: 400 }
    );
  }
  if (name.length < 1 || name.length > 30) {
    return NextResponse.json({ error: "이름을 1~30자로 입력하세요." }, { status: 400 });
  }
  if (password.length < 8 || password.length > 72) {
    return NextResponse.json({ error: "비밀번호는 8자 이상이어야 합니다." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: `${loginId}@school.local`,
    password,
    email_confirm: true,
  });
  if (authError || !created?.user) {
    const dup = authError?.message?.toLowerCase().includes("already");
    return NextResponse.json(
      { error: dup ? "이미 쓰이는 아이디입니다. 다른 아이디를 골라 주세요." : "계정을 만들지 못했습니다." },
      { status: 400 }
    );
  }

  // 학급 코드는 겹치면 안 된다 — 드물게 겹치면 새로 뽑아 다시 시도
  let profileError: { message: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await admin.from("profiles").insert({
      id: created.user.id,
      name,
      role: "teacher",
      must_change_password: false, // 본인이 정한 비밀번호
      self_signup: true, // 가입 교사 — 학교 학생 명단이 보이지 않고, 학생은 학급 코드로 로그인
      class_code: generateClassCode(),
    });
    profileError = error;
    if (!error || !error.message.includes("class_code")) break;
  }

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id); // 반쪽 계정 방지
    return NextResponse.json({ error: "계정을 만들지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, loginId });
}
