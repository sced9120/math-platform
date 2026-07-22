import { NextResponse } from "next/server";
import { askSocratic, validateChatHistory } from "@/lib/ai/socratic";
import { resolveModel } from "@/lib/ai/models";
import {
  activityContext,
  getActivityForUser,
  isGuardError,
  requireAiUser,
  consumeQuota,
} from "@/lib/ai/server";

// 소크라테스 챗봇 (서버 전용 — API 키는 여기서만 사용된다)
// 대화는 캐싱하지 않는다: 매 턴 맥락이 달라 캐시 적중이 없고,
// 대화 내용을 DB에 저장하지 않는 것이 개인정보 최소화 원칙에도 맞다.
export async function POST(request: Request) {
  const guard = await requireAiUser();
  if (isGuardError(guard)) {
    return NextResponse.json(
      { error: guard.error, code: guard.code },
      { status: guard.status }
    );
  }

  const body = await request.json().catch(() => null);
  const messages = validateChatHistory(body?.messages);
  const activityId: string | undefined = body?.activityId;
  if (!messages || !activityId) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const activity = await getActivityForUser(guard.supabase, guard.role, activityId);
  if (!activity) {
    return NextResponse.json(
      { error: "활동을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // 학생이 고른 모델 검증 (활성 모델만 허용)
  const picked = await resolveModel(body?.model);
  if (!picked) {
    return NextResponse.json(
      { error: "사용 가능한 AI 모델이 없습니다. 선생님(관리자)에게 문의하세요." },
      { status: 503 }
    );
  }

  // 일일 한도 (턴 단위)
  const remaining = await consumeQuota(guard.userId, "socratic");
  if (remaining === null) {
    return NextResponse.json(
      { error: "오늘의 AI 질문 한도를 모두 사용했습니다. 내일 다시 이용할 수 있어요." },
      { status: 429 }
    );
  }

  try {
    const reply = await askSocratic({
      provider: picked.provider,
      model: picked.model_id,
      activityContext: activityContext(activity),
      messages,
    });
    return NextResponse.json({ reply, remaining });
  } catch (e) {
    console.error("socratic AI error:", e);
    return NextResponse.json(
      { error: "AI 응답 생성에 실패했습니다. 잠시 후 다시 시도하세요." },
      { status: 502 }
    );
  }
}
