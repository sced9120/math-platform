import { NextResponse } from "next/server";
import { askSocratic, validateChatHistory } from "@/lib/ai/socratic";
import {
  activityContext,
  getActivityForUser,
  isGuardError,
  requireAiUser,
  consumeQuota,
  pickModel,
  activityOwner,
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
  if (!messages) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  // activityId가 있으면 활동 문답, 없으면 자유 질문 모드(수학 학습 전반)
  let context: string;
  if (activityId) {
    const activity = await getActivityForUser(guard.supabase, guard.role, activityId);
    if (!activity) {
      return NextResponse.json(
        { error: "활동을 찾을 수 없습니다." },
        { status: 404 }
      );
    }
    context = activityContext(activity);
  } else {
    context =
      "자유 질문 모드: 학생이 특정 활동 없이 수학 학습 전반에 대해 질문한다. " +
      "수학 개념·문제 풀이·수학 공부 방법에 관한 질문이면 무엇이든 소크라테스식으로 대화하되, " +
      "수학 학습과 무관한 주제는 여전히 답하지 않고 수학 학습으로 유도한다. " +
      "지금은 특정 활동이 없으므로 '이 활동' 대신 '수학 공부'라는 표현을 쓴다.";
  }

  // 학생이 고른 모델 검증 + 담당 교사의 키 확인 (없으면 한도를 깎지 않고 알린다)
  // 활동 안의 AI 는 그 활동을 만든 교사의 키·모델·한도를 쓴다 (활동 접근 권한은 위에서 확인했다).
  // 자유 모드는 guard.ownerId(나를 담은 교사 중 키가 있는 교사).
  const ai = {
    ...guard,
    ownerId: (activityId && (await activityOwner(activityId))) || guard.ownerId,
  };
  const call = await pickModel(body?.model, ai);
  if (isGuardError(call)) {
    return NextResponse.json({ error: call.error, code: call.code }, { status: call.status });
  }

  // 일일 한도 (턴 단위) — 담당 교사가 정한 한도
  const remaining = await consumeQuota(guard.userId, "socratic", ai.ownerId);
  if (remaining === null) {
    return NextResponse.json(
      { error: "오늘의 AI 질문 한도를 모두 사용했습니다. 내일 다시 이용할 수 있어요." },
      { status: 429 }
    );
  }

  try {
    const reply = await askSocratic({
      provider: call.provider,
      model: call.model,
      ownerId: call.ownerId,
      activityContext: context,
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
