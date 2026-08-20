"use client";

import { useState } from "react";
import ScreenBody from "@/components/student/screen-body";
import type { DemoScreen } from "@/lib/demo";
import type { Screen } from "@/lib/screens";

// 체험판에서 화면 구성 활동을 넘겨 보는 뷰어.
// 학생 화면과 같은 렌더러(ScreenBody)를 쓰되 저장·채점은 하지 않는다.
export default function DemoScreens({
  screens,
  activityTitle,
}: {
  screens: DemoScreen[];
  activityTitle: string;
}) {
  const [idx, setIdx] = useState(0);
  const s = screens[idx];
  if (!s) return null;
  const last = idx === screens.length - 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {screens.map((x, i) => (
          <button
            key={x.screen_key}
            onClick={() => setIdx(i)}
            className={`h-7 w-7 rounded-full border text-xs ${
              i === idx
                ? "border-blue-600 bg-blue-600 font-bold text-white"
                : i < idx
                  ? "border-blue-300 text-blue-600"
                  : "border-zinc-200 text-zinc-400"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {s.sheet && (
        <span className="self-start rounded-full border border-amber-300 bg-amber-50 px-3 py-0.5 text-xs font-bold text-amber-800">
          📄 {s.sheet}
        </span>
      )}
      {s.title && <h3 className="text-lg font-semibold text-zinc-900">{s.title}</h3>}

      <ScreenBody
        screen={s as unknown as Pick<Screen, "type" | "config" | "title">}
        fallbackTitle={activityTitle}
      />

      {/* 질문은 보여 주되 체험판에서는 쓰거나 제출할 수 없다 */}
      {s.questions.map((q) => (
        <div key={q.id} className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-sm font-medium text-zinc-800">✏️ {q.prompt}</p>
          {q.type === "choice" && q.choices && (
            <ul className="mt-2 flex flex-col gap-1 text-sm text-zinc-600">
              {q.choices.map((c, i) => (
                <li key={i}>○ {c}</li>
              ))}
            </ul>
          )}
          <textarea
            readOnly
            placeholder="체험판에서는 작성·저장할 수 없습니다. 실제 수업에서는 여기에 쓴 것이 저장되고, 선생님이 모아서 읽을 수 있어요."
            className="mt-3 h-20 w-full cursor-not-allowed rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-500"
          />
        </div>
      ))}

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
