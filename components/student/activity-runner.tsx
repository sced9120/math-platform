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
  response_text?: string | null;
};

type Tab = "run" | "socratic" | "feedback";
export type AiModelOption = { model_id: string; label: string };

export default function ActivityRunner({
  activity,
  initialProgress,
  aiConsented,
  initialTab,
  models,
}: {
  activity: Activity;
  initialProgress: ProgressState | null;
  aiConsented: boolean;
  initialTab?: string;
  models: AiModelOption[];
}) {
  // 사이드메뉴에서 ?tab=socratic / ?tab=feedback 으로 진입 시 해당 탭을 바로 연다
  const startTab: Tab =
    initialTab === "socratic"
      ? "socratic"
      : initialTab === "feedback" && activity.type === "problem"
        ? "feedback"
        : "run";
  const [progress, setProgress] = useState<ProgressState | null>(initialProgress);
  const [tab, setTab] = useState<Tab>(startTab);
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
    imagePath?: string;
    caption?: string;
    html?: string;
    response_prompt?: string;
  };

  const hasResponse = typeof content.response_prompt === "string";
  // 글 작성란이 있으면 완료는 글 저장으로 처리 (별도 완료 버튼 숨김)
  const showCompleteButton = !hasResponse;

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
          models={models}
        />
      )}

      {tab === "feedback" && (
        <FeedbackPanel
          activityId={activity.id}
          consented={consented}
          onConsent={() => setConsented(true)}
          models={models}
        />
      )}

      {/* 유형별 실행 */}
      {tab === "run" && activity.type === "geogebra" && (
        <div className="flex flex-col gap-4">
          <GeoGebraEmbed
            materialId={content.materialId ?? ""}
            height={content.height ?? 600}
          />
          {showCompleteButton && (
            <CompleteButton
              completed={!!progress?.completed}
              busy={busy}
              onClick={markComplete}
            />
          )}
        </div>
      )}

      {tab === "run" && activity.type === "content" && (
        <div className="flex flex-col gap-4">
          <div className="whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-6 leading-relaxed text-zinc-800">
            {content.body}
          </div>
          {showCompleteButton && (
            <CompleteButton
              completed={!!progress?.completed}
              busy={busy}
              onClick={markComplete}
            />
          )}
        </div>
      )}

      {tab === "run" && activity.type === "image" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={createClient()
                .storage.from("activity-files")
                .getPublicUrl(content.imagePath ?? "").data.publicUrl}
              alt={content.caption || activity.title}
              className="mx-auto max-w-full rounded-md"
            />
            {content.caption && (
              <p className="mt-3 text-center text-sm text-zinc-600">
                {content.caption}
              </p>
            )}
          </div>
          {showCompleteButton && (
            <CompleteButton
              completed={!!progress?.completed}
              busy={busy}
              onClick={markComplete}
            />
          )}
        </div>
      )}

      {tab === "run" && activity.type === "html" && (
        <div className="flex flex-col gap-4">
          {/* sandbox: 스크립트만 허용 — 앱 세션/쿠키에는 접근 불가 */}
          <iframe
            srcDoc={content.html ?? ""}
            sandbox="allow-scripts"
            style={{ height: content.height ?? 600 }}
            className="w-full rounded-lg border border-zinc-200 bg-white"
            title={activity.title}
          />
          {showCompleteButton && (
            <CompleteButton
              completed={!!progress?.completed}
              busy={busy}
              onClick={markComplete}
            />
          )}
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

      {tab === "run" && hasResponse && (
        <ResponseSection
          activityId={activity.id}
          prompt={content.response_prompt!}
          initialText={progress?.response_text ?? ""}
          onSaved={() => {
            if (activity.type !== "problem") {
              setProgress((p) => ({
                completed: true,
                score: p?.score ?? null,
                submission: p?.submission ?? null,
                response_text: p?.response_text,
              }));
            }
          }}
        />
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

// 학생 글 작성란 (소감/답변/풀이 과정) — save_response RPC로 저장
function ResponseSection({
  activityId,
  prompt,
  initialText,
  onSaved,
}: {
  activityId: string;
  prompt: string;
  initialText: string;
  onSaved: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error } = await createClient().rpc("save_response", {
      p_activity_id: activityId,
      p_text: text,
    });
    if (error) {
      setError("저장에 실패했습니다. 다시 시도하세요.");
    } else {
      setSavedAt(new Date());
      onSaved();
    }
    setSaving(false);
  }

  return (
    <form
      onSubmit={handleSave}
      className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50 p-4"
    >
      <label className="text-sm font-medium text-zinc-900">✏️ {prompt}</label>
      <textarea
        required
        rows={5}
        maxLength={4000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="여기에 작성하세요 (저장 후에도 수정할 수 있어요)"
        className="rounded-md border border-zinc-300 bg-white p-3 text-sm leading-relaxed focus:border-blue-500 focus:outline-none"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || text.trim().length === 0}
          className="self-start rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
        {savedAt && (
          <span className="text-sm text-green-600">
            ✓ 저장됨 ({savedAt.toLocaleTimeString("ko-KR")})
          </span>
        )}
        {!savedAt && initialText && (
          <span className="text-sm text-zinc-500">이전에 저장한 글입니다.</span>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
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
