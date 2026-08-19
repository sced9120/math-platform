"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Question } from "@/lib/screens";

// 단답형·선택형 — 채점은 DB 함수에서만 한다(정답은 학생에게 내려오지 않는다).
export default function GradedQuestion({
  activityId,
  screenKey,
  question,
  savedAnswer,
  savedCorrect,
  onGraded,
}: {
  activityId: string;
  screenKey: string;
  question: Extract<Question, { type: "short" | "choice" }>;
  savedAnswer?: string;
  savedCorrect?: boolean | null;
  onGraded: (questionKey: string, answer: string, correct: boolean) => void;
}) {
  const [value, setValue] = useState(savedAnswer ?? "");
  const [correct, setCorrect] = useState<boolean | null>(savedCorrect ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await createClient().rpc("submit_screen_answer", {
      p_activity_id: activityId,
      p_screen_key: screenKey,
      p_question_key: question.id,
      p_answer: value,
    });
    if (error) {
      setError("제출에 실패했습니다. 다시 시도하세요.");
    } else {
      const ok = (data as { correct: boolean }).correct;
      setCorrect(ok);
      onGraded(question.id, value, ok);
    }
    setBusy(false);
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4"
    >
      <p className="text-sm font-medium text-zinc-900">✏️ {question.prompt}</p>

      {question.type === "choice" ? (
        <div className="flex flex-col gap-2">
          {question.choices.map((c, i) => (
            <label key={i} className="flex items-center gap-2 text-sm text-zinc-800">
              <input
                type="radio"
                name={`${screenKey}-${question.id}`}
                checked={value === String(i)}
                onChange={() => setValue(String(i))}
              />
              {c}
            </label>
          ))}
        </div>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="답을 입력하세요"
          className="w-56 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || value.trim().length === 0}
          className="self-start rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "채점 중..." : "제출"}
        </button>
        {correct === true && <span className="text-sm font-medium text-green-600">✓ 정답입니다</span>}
        {correct === false && (
          <span className="text-sm text-red-600">아쉽지만 오답입니다. 다시 해 보세요.</span>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
