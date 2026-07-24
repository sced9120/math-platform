"use client";

import { useState } from "react";
import AiConsent from "@/components/student/ai-consent";
import ModelPicker from "@/components/student/model-picker";
import { fileToImageDataUrls, MAX_PAGES } from "@/lib/client/file-to-images";
import type { AiModelOption } from "@/components/student/activity-runner";

type FeedbackMode = "correction" | "socratic";

type FeedbackStep = {
  student_step: string;
  verdict: "correct" | "logic_error" | "calc_error" | "unclear";
  comment: string;
};
type CorrectionResult = {
  steps: FeedbackStep[];
  overall: string;
  next_hint: string;
};
type SocraticResult = {
  read_back: string;
  questions: { focus: string; question: string }[];
  encouragement: string;
};

const VERDICT_STYLES: Record<
  FeedbackStep["verdict"],
  { label: string; cls: string }
> = {
  correct: { label: "정확", cls: "border-green-300 bg-green-50 text-green-800" },
  logic_error: { label: "논리 오류", cls: "border-red-300 bg-red-50 text-red-800" },
  calc_error: { label: "계산 오류", cls: "border-orange-300 bg-orange-50 text-orange-800" },
  unclear: { label: "서술 미비", cls: "border-zinc-300 bg-zinc-50 text-zinc-700" },
};

const MAX_IMAGES = 5;

export default function FeedbackPanel({
  activityId,
  consented,
  onConsent,
  models,
  dailyLimit,
}: {
  activityId: string;
  consented: boolean;
  onConsent: () => void;
  models: AiModelOption[];
  dailyLimit: number;
}) {
  const [model, setModel] = useState(models[0]?.model_id ?? "");
  const [mode, setMode] = useState<FeedbackMode>("correction");
  const [inputType, setInputType] = useState<"text" | "image">("text");
  const [solution, setSolution] = useState("");
  const [images, setImages] = useState<string[]>([]); // 미리보기 겸 전송용 data URL
  const [preparing, setPreparing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CorrectionResult | SocraticResult | null>(null);
  const [resultMode, setResultMode] = useState<FeedbackMode>("correction");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!consented) {
    return <AiConsent onConsent={onConsent} />;
  }

  async function handleFiles(files: FileList) {
    setError(null);
    setPreparing(true);
    try {
      const collected: string[] = [...images];
      for (const file of Array.from(files)) {
        const urls = await fileToImageDataUrls(file);
        collected.push(...urls);
      }
      if (collected.length > MAX_IMAGES) {
        setError(`사진/페이지는 합쳐서 최대 ${MAX_IMAGES}장까지예요.`);
        setImages(collected.slice(0, MAX_IMAGES));
      } else {
        setImages(collected);
      }
    } catch {
      setError("파일을 읽지 못했습니다. 이미지 또는 PDF 파일인지 확인해 주세요.");
    }
    setPreparing(false);
  }

  function removeImage(i: number) {
    setImages(images.filter((_, idx) => idx !== i));
  }

  const canSubmit =
    !loading &&
    !preparing &&
    (inputType === "text" ? solution.trim().length >= 5 : images.length > 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const payload =
      inputType === "text"
        ? { activityId, mode, solution, model }
        : { activityId, mode, images, model };

    const res = await fetch("/api/ai/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setError(data?.error ?? "요청에 실패했습니다.");
    } else {
      setResult(data.result);
      setResultMode(data.mode ?? mode);
      setFromCache(!!data.cached);
      if (typeof data.remaining === "number") setRemaining(data.remaining);
    }
    setLoading(false);
  }

  const tabCls = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm ${
      active ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
    }`;

  return (
    <div className="flex flex-col gap-4">
      {/* 모드 선택 */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-zinc-700">첨삭 방식</span>
        <div className="flex gap-2">
          <button onClick={() => setMode("correction")} className={tabCls(mode === "correction")}>
            단계별 오류 첨삭
          </button>
          <button onClick={() => setMode("socratic")} className={tabCls(mode === "socratic")}>
            발문형 힌트 (소크라테스식)
          </button>
        </div>
        <p className="text-xs text-zinc-400">
          {mode === "correction"
            ? "풀이를 단계별로 나눠 어디가 왜 틀렸는지 짚어 줍니다."
            : "정답 대신, 스스로 다음 걸음을 찾도록 질문을 던져 줍니다."}
        </p>
      </div>

      {/* 입력 방식 선택 */}
      <div className="flex gap-2">
        <button onClick={() => setInputType("text")} className={tabCls(inputType === "text")}>
          ⌨️ 직접 입력
        </button>
        <button onClick={() => setInputType("image")} className={tabCls(inputType === "image")}>
          📷 사진/PDF 올리기
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {inputType === "text" ? (
          <textarea
            rows={6}
            maxLength={4000}
            value={solution}
            onChange={(e) => setSolution(e.target.value)}
            placeholder={"예)\n1. y = x² - 4x + 3 을 완전제곱식으로 바꾼다\n2. y = (x-2)² - 1\n3. 따라서 최솟값은 -1"}
            className="rounded-md border border-zinc-300 p-3 text-sm leading-relaxed focus:border-blue-500 focus:outline-none"
          />
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border border-dashed border-zinc-300 p-4">
            <label className="cursor-pointer text-sm text-blue-600 hover:underline">
              사진 촬영 / 파일 선택 (이미지 또는 PDF, 최대 {MAX_IMAGES}장)
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                capture="environment"
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
            </label>
            <p className="text-xs text-zinc-400">
              손으로 푼 풀이를 찍어 올리세요. PDF는 앞 {MAX_PAGES}페이지까지 읽습니다.
            </p>
            {preparing && <p className="text-sm text-zinc-500">이미지 처리 중...</p>}
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {images.map((url, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`풀이 ${i + 1}`}
                      className="h-24 w-auto rounded-md border border-zinc-200"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-xs text-white"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className="self-start rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading
              ? "분석 중... (잠시 걸릴 수 있어요)"
              : mode === "correction"
                ? "첨삭 받기"
                : "힌트 받기"}
          </button>
          <span className="text-xs text-zinc-400">
            {remaining !== null ? `오늘 남은 횟수: ${remaining}회` : `일일 한도: ${dailyLimit}회`}
          </span>
          <ModelPicker models={models} value={model} onChange={setModel} />
        </div>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="flex flex-col gap-3">
          {fromCache && (
            <p className="text-xs text-zinc-400">
              같은 풀이라 저장된 결과를 보여드려요 (횟수 차감 없음).
            </p>
          )}

          {resultMode === "correction" ? (
            <CorrectionView result={result as CorrectionResult} />
          ) : (
            <SocraticView result={result as SocraticResult} />
          )}
        </div>
      )}
    </div>
  );
}

function CorrectionView({ result }: { result: CorrectionResult }) {
  return (
    <>
      {result.steps.map((s, i) => {
        const v = VERDICT_STYLES[s.verdict] ?? VERDICT_STYLES.unclear;
        return (
          <div key={i} className={`rounded-lg border p-3 ${v.cls}`}>
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded-full border border-current px-2 py-0.5 text-xs font-medium">
                {v.label}
              </span>
              <span className="text-sm font-medium">{s.student_step}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{s.comment}</p>
          </div>
        );
      })}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h4 className="mb-1 text-sm font-semibold text-zinc-900">총평</h4>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
          {result.overall}
        </p>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h4 className="mb-1 text-sm font-semibold text-zinc-900">다음 힌트</h4>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
          {result.next_hint}
        </p>
      </div>
    </>
  );
}

function SocraticView({ result }: { result: SocraticResult }) {
  return (
    <>
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h4 className="mb-1 text-sm font-semibold text-zinc-900">지금까지 보니…</h4>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
          {result.read_back}
        </p>
      </div>
      {result.questions.map((q, i) => (
        <div key={i} className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="mb-1 text-xs font-medium text-blue-700">💭 {q.focus}</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
            {q.question}
          </p>
        </div>
      ))}
      <p className="text-sm text-green-700">{result.encouragement}</p>
    </>
  );
}
