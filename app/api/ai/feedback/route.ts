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
import { resolveModel } from "@/lib/ai/models";

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
  // 자유 문제 모드: activityId 대신 학생이 문제를 직접 입력(또는 사진에 포함)
  const freeQuestion = String(body?.question ?? "").trim();

  const hasImages = Array.isArray(images) && images.length > 0;
  const hasText = typeof solution === "string" && solution.trim().length >= 5;

  // 입력 검증
  if (!activityId && freeQuestion.length > 2000) {
    return NextResponse.json(
      { error: "문제 내용은 2000자 이하로 입력하세요." },
      { status: 400 }
    );
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

  // 문제 내용 결정: 활동 문제 or 자유 문제(직접 입력/사진 포함)
  let question: string;
  let scopeKey: string; // 캐시 키에서 활동/자유 구분
  if (activityId) {
    const activity = await getActivityForUser(guard.supabase, guard.role, activityId);
    if (!activity || activity.type !== "problem") {
      return NextResponse.json(
        { error: "문제 활동에서만 첨삭을 사용할 수 있습니다." },
        { status: 404 }
      );
    }
    question = String(activity.content.question ?? "");
    scopeKey = activityId;
  } else {
    // 자유 모드: 텍스트 풀이면 문제도 텍스트로 필요, 사진이면 사진 속 문제 인식 허용
    if (!freeQuestion && !hasImages) {
      return NextResponse.json(
        { error: "문제 내용을 입력해 주세요. (또는 문제가 보이게 사진을 올려 주세요)" },
        { status: 400 }
      );
    }
    question =
      freeQuestion ||
      "(문제는 별도로 입력되지 않았습니다. 학생이 올린 이미지에서 문제를 찾아 읽으세요.)";
    scopeKey = "free:" + createHash("sha256").update(question).digest("hex").slice(0, 16);
  }

  // 학생이 고른 모델 검증
  const picked = await resolveModel(body?.model);
  if (!picked) {
    return NextResponse.json(
      { error: "사용 가능한 AI 모델이 없습니다. 선생님(관리자)에게 문의하세요." },
      { status: 503 }
    );
  }

  // 1) 캐시 확인 (한도 차감 전 — 캐시 적중은 무료)
  //    모델·모드·입력이 모두 같을 때만 캐시 재사용 (모델별 결과 분리).
  const inputKey = hasImages
    ? "img:" + createHash("sha256").update(imageList.join("")).digest("hex")
    : "txt:" + solution!.trim();
  const key = cacheKey("feedback", picked.model_id, scopeKey, mode, inputKey);
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

  const call = { provider: picked.provider, model: picked.model_id };

  // 3) 호출 + 캐시 저장
  try {
    const result = hasImages
      ? await reviewSolutionImages({ call, mode, question, images: imageList })
      : await reviewSolutionText({ call, mode, question, solution: solution! });
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
