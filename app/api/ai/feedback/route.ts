import { NextResponse } from "next/server";
import {
  MAX_SOLUTION_LENGTH,
  reviewSolution,
  type FeedbackResult,
} from "@/lib/ai/feedback";
import {
  cacheKey,
  getActivityForUser,
  getCached,
  isGuardError,
  requireAiUser,
  setCached,
  consumeQuota,
} from "@/lib/ai/server";

// 단계별 풀이 첨삭 (서버 전용)
// 동일 문제·동일 풀이는 해시 캐시에서 응답 — 호출도 한도 차감도 없다.
export async function POST(request: Request) {
  const guard = await requireAiUser();
  if (isGuardError(guard)) {
    return NextResponse.json(
      { error: guard.error, code: guard.code },
      { status: guard.status }
    );
  }

  const body = await request.json().catch(() => null);
  const activityId: string | undefined = body?.activityId;
  const solution: string | undefined = body?.solution;
  if (
    !activityId ||
    typeof solution !== "string" ||
    solution.trim().length < 5 ||
    solution.length > MAX_SOLUTION_LENGTH
  ) {
    return NextResponse.json(
      { error: `풀이는 5자 이상 ${MAX_SOLUTION_LENGTH}자 이하로 입력하세요.` },
      { status: 400 }
    );
  }

  const activity = await getActivityForUser(guard.supabase, guard.role, activityId);
  if (!activity || activity.type !== "problem") {
    return NextResponse.json(
      { error: "문제 활동에서만 첨삭을 사용할 수 있습니다." },
      { status: 404 }
    );
  }
  const question = String(activity.content.question ?? "");

  // 1) 캐시 확인 (한도 차감 전 — 캐시 적중은 무료)
  const key = cacheKey("feedback", activityId, solution);
  const cached = await getCached<FeedbackResult>(key);
  if (cached) {
    return NextResponse.json({ result: cached, cached: true });
  }

  // 2) 일일 한도
  const remaining = await consumeQuota(guard.userId, "feedback");
  if (remaining === null) {
    return NextResponse.json(
      { error: "오늘의 AI 첨삭 한도를 모두 사용했습니다. 내일 다시 이용할 수 있어요." },
      { status: 429 }
    );
  }

  // 3) 호출 + 캐시 저장
  try {
    const result = await reviewSolution({ question, solution });
    await setCached(key, "feedback", result);
    return NextResponse.json({ result, remaining });
  } catch (e) {
    console.error("feedback AI error:", e);
    return NextResponse.json(
      { error: "AI 첨삭 생성에 실패했습니다. 잠시 후 다시 시도하세요." },
      { status: 502 }
    );
  }
}
