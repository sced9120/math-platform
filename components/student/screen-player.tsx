"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import GeoGebraEmbed from "@/components/student/geogebra-embed";
import HtmlActivityFrame from "@/components/student/html-activity-frame";
import PlaneCanvas from "@/components/student/plane-canvas";
import GradedQuestion from "@/components/student/graded-question";
import ScreenResponse, {
  FREE_KEY,
  FREE_PROMPT,
  type SavedResponse,
} from "@/components/student/screen-response";
import { DEFAULT_PLANE, type Screen } from "@/lib/screens";

export type SavedByKey = Record<string, SavedResponse & { correct?: boolean | null }>;

// 화면 구성이 있는 활동을 재생한다.
// 화면 넘김을 활동 HTML 이 아니라 여기(플랫폼)가 맡는 것이 핵심 —
// 그래야 화면마다 유형을 다르게 줄 수 있고, 한 화면이 깨져도 다른 화면이 산다.
export default function ScreenPlayer({
  activityId,
  activityTitle,
  screens,
  initialResponses,
  onProgress,
}: {
  activityId: string;
  activityTitle: string;
  screens: Screen[];
  initialResponses: SavedByKey;
  onProgress?: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [saved, setSaved] = useState<SavedByKey>(initialResponses);
  const screen = screens[idx];
  const last = idx === screens.length - 1;

  // 기록 키: 화면 + 질문 (질문이 하나뿐이면 질문키는 빈 값)
  const rk = (screenKey: string, questionKey: string) =>
    questionKey ? `${screenKey}|${questionKey}` : screenKey;

  function remember(screenKey: string, questionKey: string, value: SavedResponse & { correct?: boolean | null }) {
    setSaved((prev) => ({ ...prev, [rk(screenKey, questionKey)]: value }));
    onProgress?.();
  }

  if (!screen) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* 화면 번호 */}
      <div className="flex flex-wrap items-center gap-1.5">
        {screens.map((s, i) => (
          <button
            key={s.screen_key}
            onClick={() => setIdx(i)}
            className={`h-7 w-7 rounded-full border text-xs ${
              i === idx
                ? "border-blue-600 bg-blue-600 font-bold text-white"
                : i < idx
                  ? "border-blue-300 text-blue-600"
                  : "border-zinc-200 text-zinc-400"
            }`}
            aria-label={`${i + 1}번째 화면`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {screen.sheet && (
        <span className="self-start rounded-full border border-amber-300 bg-amber-50 px-3 py-0.5 text-xs font-bold text-amber-800">
          📄 {screen.sheet}
        </span>
      )}
      {screen.title && (
        <h3 className="text-lg font-semibold text-zinc-900">{screen.title}</h3>
      )}

      {/* 유형별 화면칸 */}
      <ScreenBody screen={screen} activityTitle={activityTitle} />

      {/* 질문칸 */}
      {screen.questions.map((q) =>
        q.type === "text" ? (
          <ScreenResponse
            key={q.id}
            activityId={activityId}
            screenKey={screen.screen_key}
            questionKey={q.id}
            prompt={q.prompt}
            allowPhoto={!!q.photo}
            saved={saved[rk(screen.screen_key, q.id)]}
            onSaved={(_, v) => remember(screen.screen_key, q.id, v)}
            tone={q.photo ? "amber" : "blue"}
          />
        ) : (
          <GradedQuestion
            key={q.id}
            activityId={activityId}
            screenKey={screen.screen_key}
            question={q}
            savedAnswer={saved[rk(screen.screen_key, q.id)]?.text}
            savedCorrect={saved[rk(screen.screen_key, q.id)]?.correct}
            onGraded={(qk, answer, correct) =>
              remember(screen.screen_key, qk, { text: answer, images: [], correct })
            }
          />
        )
      )}

      {/* 마지막 화면에는 언제나 자유 기록칸 */}
      {last && (
        <ScreenResponse
          activityId={activityId}
          screenKey={FREE_KEY}
          prompt={FREE_PROMPT}
          allowPhoto
          saved={saved[FREE_KEY]}
          onSaved={(_, v) => remember(FREE_KEY, "", v)}
          tone="amber"
        />
      )}

      <div className="flex items-center justify-between border-t border-zinc-200 pt-4">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          « 이전
        </button>
        <span className="text-xs text-zinc-500">
          {idx + 1} / {screens.length}
        </span>
        <button
          onClick={() => setIdx((i) => Math.min(screens.length - 1, i + 1))}
          disabled={last}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
        >
          {last ? "완료 ✓" : "다음 »"}
        </button>
      </div>
    </div>
  );
}

function ScreenBody({ screen, activityTitle }: { screen: Screen; activityTitle: string }) {
  const c = screen.config ?? {};
  switch (screen.type) {
    case "text":
      return (
        <div
          className="rounded-lg border border-zinc-200 bg-white p-6 leading-relaxed text-zinc-800"
          dangerouslySetInnerHTML={{ __html: c.body ?? "" }}
        />
      );
    case "plane":
      return <PlaneCanvas config={c.plane ?? DEFAULT_PLANE} />;
    case "geogebra":
      return <GeoGebraEmbed materialId={c.materialId ?? ""} height={c.height ?? 600} />;
    case "image":
      return (
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              createClient().storage.from("activity-files").getPublicUrl(c.imagePath ?? "").data
                .publicUrl
            }
            alt={c.caption || screen.title || activityTitle}
            className="mx-auto max-w-full rounded-md"
          />
          {c.caption && <p className="mt-3 text-center text-sm text-zinc-600">{c.caption}</p>}
        </div>
      );
    case "html":
    case "legacy":
      return (
        <HtmlActivityFrame
          html={c.html ?? ""}
          title={screen.title || activityTitle}
          initialHeight={c.height}
        />
      );
    default:
      return null;
  }
}
