import { NextResponse } from "next/server";
import { askAuthoring, validateChatHistory } from "@/lib/ai/authoring";
import { resolveModel } from "@/lib/ai/models";
import { consumeQuota, isGuardError, requireAiUser } from "@/lib/ai/server";

// 교사용 '조작 활동 만들기' 챗봇 (서버 전용 — API 키는 여기서만 쓰인다)
//
// 학생용 기능과 다른 점
//   · 교사(admin 포함)만 쓸 수 있다. 학생이 호출하면 403.
//   · 대화는 캐싱하지 않는다 — 매 턴 맥락이 달라 적중이 없고, 대화를 DB 에 남기지 않는다.
//   · 그래도 일일 한도는 건다. 실수로 반복 호출되는 것을 막기 위해서다.
export async function POST(request: Request) {
  const guard = await requireAiUser();
  if (isGuardError(guard)) {
    return NextResponse.json(
      { error: guard.error, code: guard.code },
      { status: guard.status }
    );
  }
  if (guard.role !== "teacher" && guard.role !== "admin") {
    return NextResponse.json(
      { error: "교사만 사용할 수 있는 기능입니다." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const messages = validateChatHistory(body?.messages);
  if (!messages) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const picked = await resolveModel(body?.model);
  if (!picked) {
    return NextResponse.json(
      { error: "사용 가능한 AI 모델이 없습니다. AI 설정에서 모델을 켜 주세요." },
      { status: 503 }
    );
  }

  const remaining = await consumeQuota(guard.userId, "authoring");
  if (remaining === null) {
    return NextResponse.json(
      { error: "오늘 사용 한도를 다 썼습니다. 내일 다시 시도해 주세요." },
      { status: 429 }
    );
  }

  try {
    const reply = await askAuthoring(
      { provider: picked.provider, model: picked.model_id },
      messages
    );
    return NextResponse.json({ reply, remaining });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI 호출에 실패했습니다.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
