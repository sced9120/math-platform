"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import GeoGebraEmbed from "@/components/student/geogebra-embed";
import SocraticChat from "@/components/student/socratic-chat";
import FeedbackPanel from "@/components/student/feedback-panel";
import type { Activity } from "@/lib/types";

type ProgressState = {
  completed: boolean;
  score: number | null;
  submission: { answer?: string; correct?: boolean } | null;
};

type Tab = "run" | "socratic" | "feedback";

export default function ActivityRunner({
  activity,
  initialProgress,
  aiConsented,
}: {
  activity: Activity;
  initialProgress: ProgressState | null;
  aiConsented: boolean;
}) {
  const [progress, setProgress] = useState<ProgressState | null>(initialProgress);
  const [tab, setTab] = useState<Tab>("run");
  const [consented, setConsented] = useState(aiConsented); // AI 탭 간 공유
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // geogebra/content 유형: "학습 완료" 체크 (problem은 DB 함수 채점으로만 기록됨)
  async function markComplete() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("progress").upsert(
      { student_id: user.id, activity_id: activity.id, completed: true },
      { onConflict: "student_id,activity_id" }
    );
    if (error) {
      setError("저장에 실패했습니다. 다시 시도하세요.");
    } else {
      setProgress({ completed: true, score: null, submission: null });
    }
    setBusy(false);
  }

  const content = activity.content as {
    materialId?: string;
    height?: number;
    body?: string;
    question?: string;
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "run", label: "학습 활동" },
    { key: "socratic", label: "AI 질문" },
    // 풀이 첨삭은 문제 활동에서만 의미가 있다
    ...(activity.type === "problem"
      ? [{ key: "feedback" as Tab, label: "AI 첨삭" }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-zinc-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-t-md px-4 py-2 text-sm ${
              tab === t.key
                ? "border border-b-0 border-zinc-200 bg-white font-medium text-blue-600"
                : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "socratic" && (
        <SocraticChat
          activityId={activity.id}
          consented={consented}
          onConsent={() => setConsented(true)}
        />
      )}

      {tab === "feedback" && (
        <FeedbackPanel
          activityId={activity.id}
          consented={consented}
          onConsent={() => setConsented(true)}
        />
      )}

      {/* 유형별 실행 */}
      {tab === "run" && activity.type === "geogebra" && (
        <div className="flex flex-col gap-4">
          <GeoGebraEmbed
            materialId={content.materialId ?? ""}
            height={content.height ?? 600}
          />
          <CompleteButton
            completed={!!progress?.completed}
            busy={busy}
            onClick={markComplete}
          />
        </div>
      )}

      {tab === "run" && activity.type === "content" && (
        <div className="flex flex-col gap-4">
          <div className="whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-6 leading-relaxed text-zinc-800">
            {content.body}
          </div>
          <CompleteButton
            completed={!!progress?.completed}
            busy={busy}
            onClick={markComplete}
          />
        </div>
      )}

      {tab === "run" && activity.type === "problem" && (
        <ProblemPanel
          activityId={activity.id}
          question={content.question ?? ""}
          progress={progress}
          onResult={setProgress}
        />
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function CompleteButton({
  completed,
  busy,
  onClick,
}: {
  completed: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  if (completed) {
    return <p className="font-medium text-green-600">✓ 학습 완료로 기록되었습니다.</p>;
  }
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="self-start rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
    >
      {busy ? "저장 중..." : "학습 완료"}
    </button>
  );
}

function ProblemPanel({
  activityId,
  question,
  progress,
  onResult,
}: {
  activityId: string;
  question: string;
  progress: ProgressState | null;
  onResult: (p: ProgressState) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(
    progress?.submission?.correct ?? null
  );
  const [error, setError] = useState<string | null>(null);

  const solved = !!progress?.completed;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // 채점은 서버(DB 함수)에서만 — 정답은 클라이언트에 절대 내려오지 않는다
    const supabase = createClient();
    const { data, error } = await supabase.rpc("submit_answer", {
      p_activity_id: activityId,
      p_answer: answer,
    });

    if (error) {
      setError("제출에 실패했습니다. 다시 시도하세요.");
    } else {
      const correct = (data as { correct: boolean }).correct;
      setLastCorrect(correct);
      onResult({
        completed: correct || solved,
        score: correct ? 100 : progress?.score ?? 0,
        submission: { answer, correct },
      });
      setAnswer("");
    }
    setSubmitting(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-6 leading-relaxed text-zinc-800">
        {question}
      </div>

      {solved ? (
        <p className="font-medium text-green-600">
          ✓ 정답입니다! 완료로 기록되었습니다.
        </p>
      ) : (
        <>
          {lastCorrect === false && (
            <p className="text-sm text-red-600">
              아쉽지만 오답입니다. 다시 도전해 보세요.
              {progress?.submission?.answer && (
                <span className="text-zinc-500">
                  {" "}
                  (마지막 제출: {progress.submission.answer})
                </span>
              )}
            </p>
          )}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              required
              placeholder="답을 입력하세요"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="w-56 rounded-md border border-zinc-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "채점 중..." : "제출"}
            </button>
          </form>
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
