import { NextResponse } from "next/server";
import { createHash } from "crypto";
import {
  MAX_IMAGES,
  MAX_SOLUTION_LENGTH,
  reviewSolutionImages,
  reviewSolutionText,
  type FeedbackMode,
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

// 문제풀이 첨삭 (서버 전용)
//  입력: 텍스트(solution) 또는 사진/PDF(images: data URL 배열)
//  모드: correction(오류 첨삭) / socratic(발문형 힌트)
//  동일 입력·모드는 해시 캐시에서 응답 — 호출도 한도 차감도 없다.

// 압축된 이미지도 합산하면 클 수 있으니 서버에서도 상한을 둔다 (Vercel 본문 4.5MB 대비)
const MAX_TOTAL_IMAGE_CHARS = 4_000_000; // data URL 문자열 합계

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
  const mode: FeedbackMode = body?.mode === "socratic" ? "socratic" : "correction";
  const solution: string | undefined = body?.solution;
  const images: unknown = body?.images;

  const hasImages = Array.isArray(images) && images.length > 0;
  const hasText = typeof solution === "string" && solution.trim().length >= 5;

  // 입력 검증
  if (!activityId) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!hasImages && !hasText) {
    return NextResponse.json(
      { error: "풀이를 텍스트로 입력하거나 사진/PDF를 올려 주세요." },
      { status: 400 }
    );
  }
  if (hasText && solution!.length > MAX_SOLUTION_LENGTH) {
    return NextResponse.json(
      { error: `풀이는 ${MAX_SOLUTION_LENGTH}자 이하로 입력하세요.` },
      { status: 400 }
    );
  }
  let imageList: string[] = [];
  if (hasImages) {
    imageList = (images as unknown[]).filter(
      (u): u is string => typeof u === "string" && u.startsWith("data:image/")
    );
    if (imageList.length === 0 || imageList.length > MAX_IMAGES) {
      return NextResponse.json(
        { error: `이미지는 1~${MAX_IMAGES}장까지 올릴 수 있습니다.` },
        { status: 400 }
      );
    }
    const total = imageList.reduce((n, s) => n + s.length, 0);
    if (total > MAX_TOTAL_IMAGE_CHARS) {
      return NextResponse.json(
        { error: "이미지 용량이 너무 큽니다. 장수를 줄이거나 다시 촬영해 주세요." },
        { status: 413 }
      );
    }
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
  //    이미지는 내용 해시를, 텍스트는 원문을 키에 넣는다.
  const inputKey = hasImages
    ? "img:" + createHash("sha256").update(imageList.join("")).digest("hex")
    : "txt:" + solution!.trim();
  const key = cacheKey("feedback", activityId, mode, inputKey);
  const cached = await getCached<unknown>(key);
  if (cached) {
    return NextResponse.json({ result: cached, mode, cached: true });
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
    const result = hasImages
      ? await reviewSolutionImages({ mode, question, images: imageList })
      : await reviewSolutionText({ mode, question, solution: solution! });
    await setCached(key, "feedback", result);
    return NextResponse.json({ result, mode, remaining });
  } catch (e) {
    console.error("feedback AI error:", e);
    return NextResponse.json(
      { error: "AI 첨삭 생성에 실패했습니다. 잠시 후 다시 시도하세요." },
      { status: 502 }
    );
  }
}
