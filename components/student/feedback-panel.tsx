"use client";

import { useState } from "react";
import AiConsent from "@/components/student/ai-consent";

type FeedbackStep = {
  student_step: string;
  verdict: "correct" | "logic_error" | "calc_error" | "unclear";
  comment: string;
};

type FeedbackResult = {
  steps: FeedbackStep[];
  overall: string;
  next_hint: string;
};

const VERDICT_STYLES: Record<
  FeedbackStep["verdict"],
  { label: string; cls: string }
> = {
  correct: { label: "정확", cls: "border-green-300 bg-green-50 text-green-800" },
  logic_error: { label: "논리 오류", cls: "border-red-300 bg-red-50 text-red-800" },
  calc_error: {
    label: "계산 오류",
    cls: "border-orange-300 bg-orange-50 text-orange-800",
  },
  unclear: { label: "서술 미비", cls: "border-zinc-300 bg-zinc-50 text-zinc-700" },
};

// 단계별 풀이 첨삭 패널 (problem 활동 전용)
export default function FeedbackPanel({
  activityId,
  consented,
  onConsent,
}: {
  activityId: string;
  consented: boolean;
  onConsent: () => void;
}) {
  const [solution, setSolution] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FeedbackResult | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!consented) {
    return <AiConsent onConsent={onConsent} />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const res = await fetch("/api/ai/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityId, solution }),
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setError(data?.error ?? "요청에 실패했습니다.");
    } else {
      setResult(data.result);
      setFromCache(!!data.cached);
      if (typeof data.remaining === "number") setRemaining(data.remaining);
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label className="text-sm font-medium text-zinc-700">
          내 풀이를 단계별로 적어 보세요
        </label>
        <textarea
          required
          rows={6}
          maxLength={4000}
          value={solution}
          onChange={(e) => setSolution(e.target.value)}
          placeholder={"예)\n1. y = x² - 4x + 3 을 완전제곱식으로 바꾼다\n2. y = (x-2)² - 1\n3. 따라서 최솟값은 -1"}
          className="rounded-md border border-zinc-300 p-3 text-sm leading-relaxed focus:border-blue-500 focus:outline-none"
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading || solution.trim().length < 5}
            className="self-start rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "첨삭 중... (잠시 걸릴 수 있어요)" : "첨삭 받기"}
          </button>
          <span className="text-xs text-zinc-400">
            {remaining !== null ? `오늘 남은 첨삭 횟수: ${remaining}회` : "일일 한도: 10회"}
          </span>
        </div>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="flex flex-col gap-3">
          {fromCache && (
            <p className="text-xs text-zinc-400">
              이전에 받은 첨삭과 같은 풀이라 저장된 결과를 보여드려요 (횟수 차감 없음).
            </p>
          )}

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
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {s.comment}
                </p>
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
        </div>
      )}
    </div>
  );
}
