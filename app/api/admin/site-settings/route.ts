import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSignupOpen, setSignupOpen } from "@/lib/site-settings";

// 사이트 설정 (관리자 전용) — 지금은 "누구나 교사 가입 허용" 하나
async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return me?.role === "admin";
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "관리자만 사용할 수 있습니다." }, { status: 403 });
  }
  return NextResponse.json({ openSignup: await isSignupOpen() });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "관리자만 사용할 수 있습니다." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (typeof body?.openSignup !== "boolean") {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  try {
    await setSignupOpen(body.openSignup);
  } catch {
    return NextResponse.json(
      { error: "저장하지 못했습니다. (마이그레이션 0016 실행 여부 확인)" },
      { status: 500 }
    );
  }
  return NextResponse.json({ openSignup: body.openSignup });
}
