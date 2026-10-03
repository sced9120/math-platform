import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 관리자 → 교사 계정으로 내 학생·자료·AI 설정 넘기기 (관리자 전용)
// 실제 이동은 DB 함수 transfer_teaching(0017)이 한 번에(트랜잭션으로) 한다.
// 관리자 본인의 세션으로 부르므로 함수 안의 auth.uid() = 관리자이고,
// 함수가 다시 한 번 관리자인지·받는 사람이 교사인지 확인한다.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") {
    return NextResponse.json({ error: "관리자만 사용할 수 있습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const to = String(body?.to ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(to)) {
    return NextResponse.json({ error: "받을 교사를 고르세요." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("transfer_teaching", { p_to: to });
  if (error) {
    return NextResponse.json(
      {
        error: error.message.includes("target must be a school teacher")
          ? "관리자가 만든 학교 교사 계정에만 넘길 수 있습니다."
          : error.message.includes("transfer_teaching")
            ? "DB 에 0017 마이그레이션을 먼저 실행하세요."
            : `넘기지 못했습니다 — ${error.message}`,
      },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true, result: data });
}
