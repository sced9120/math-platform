"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import HtmlActivityFrame, {
  type ScreenInfo,
} from "@/components/student/html-activity-frame";
import ScreenBody from "@/components/student/screen-body";
import GeoGebraEmbed from "@/components/student/geogebra-embed";
import type { Activity } from "@/lib/types";
import type { Screen } from "@/lib/screens";
import Icon from "@/components/icon";

// 수업판 아래에 띄우는 '학생이 보는 화면'.
// 활동 유형이 무엇이든 교사가 직접 넘기며 시연할 수 있어야 한다.
//
// ⚠ 이 화면은 칠판에 띄워 놓고 쓴다. 정답(problem 의 answer, 단답·선택형의
//    answer)은 절대 그리지 않는다. 교사용 미리보기(ActivityPreview)와 다른 점이다.
//
// 세 갈래
//   ① HTML 활동          → 활동 안의 스테퍼를 그대로 쓴다(iframe 다리로 조종)
//   ② 교사가 짠 화면들    → 여기서 스테퍼를 그린다
//   ③ 화면이 없는 옛 활동 → 한 장짜리. 넘길 것이 없다.

export default function LessonPreview({
  activity,
  screens,
  goto,
  onScreen,
}: {
  activity: Activity;
  screens: Screen[];
  goto: { index: number; seq: number } | null;
  onScreen: (info: ScreenInfo | null) => void;
}) {
  const content = activity.content as {
    materialId?: string;
    height?: number;
    body?: string;
    question?: string;
    imagePath?: string;
    caption?: string;
    html?: string;
  };

  const isHtml = activity.type === "html" && !!content.html;
  const authored = !isHtml && screens.length > 0;

  // ── ② 교사가 짠 화면들 — 여기서 넘긴다 ─────────────
  const [idx, setIdx] = useState(0);
  const lastSeq = useRef(-1);

  // 선생님이 부른 화면으로 (seq 가 늘 때만)
  useEffect(() => {
    if (!authored || !goto || goto.seq <= lastSeq.current) return;
    lastSeq.current = goto.seq;
    setIdx(Math.max(0, Math.min(screens.length - 1, goto.index)));
  }, [goto, authored, screens.length]);

  // 지금 보고 있는 화면을 위로 알린다.
  // 같은 화면을 거듭 알리지 않는다 — 부모 상태가 바뀌면 다시 렌더되므로
  // 매번 새 객체를 올리면 렌더 고리가 생긴다.
  const toldRef = useRef<string>("");
  useEffect(() => {
    if (isHtml) return; // HtmlActivityFrame 이 직접 알린다
    const info: ScreenInfo = authored
      ? {
          index: idx,
          total: screens.length,
          key: screens[idx]?.screen_key ?? `s${idx + 1}`,
          prompt: "",
          photo: false,
          draw: false,
          drawBg: "plain",
          title: screens[idx]?.title || "",
          hasPrompts: false,
        }
      : {
          index: 0,
          total: 1,
          key: "s1",
          prompt: "",
          photo: false,
          draw: false,
          drawBg: "plain",
          title: activity.title,
          hasPrompts: false,
        };
    const stamp = `${info.index}/${info.total}/${info.key}`;
    if (stamp === toldRef.current) return;
    toldRef.current = stamp;
    onScreen(info);
  }, [isHtml, authored, idx, screens, onScreen, activity.title]);

  // ── ① HTML 활동 ─────────────────────────────────────
  if (isHtml) {
    return (
      <HtmlActivityFrame
        html={content.html ?? ""}
        title={`${activity.title} — 학생 화면`}
        initialHeight={content.height}
        onScreen={onScreen}
        goto={goto}
        /* 교사 화면은 덮지 않는다 — 덮으면 시연을 못 한다 */
        blank={false}
      />
    );
  }

  // ── ② 교사가 짠 화면들 ──────────────────────────────
  if (authored) {
    const s = screens[idx];
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        {/* 스테퍼 */}
        <div className="flex flex-wrap items-center gap-1.5">
          {screens.map((x, i) => (
            <button
              key={x.screen_key}
              onClick={() => setIdx(i)}
              aria-label={`${i + 1}번째 화면`}
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

        {s?.sheet && (
          <span className="self-start rounded-full border border-amber-300 bg-amber-50 px-3 py-0.5 text-xs font-bold text-amber-800">
            <Icon name="document" /> {s.sheet}
          </span>
        )}
        {s?.title && (
          <h3 className="text-lg font-semibold text-zinc-900">{s.title}</h3>
        )}

        {s && <ScreenBody screen={s} fallbackTitle={activity.title} />}

        {/* 질문은 '무엇을 묻는지'만. 정답·입력칸은 그리지 않는다. */}
        {s && s.questions.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {s.questions.map((q) => (
              <p
                key={q.id}
                className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-zinc-800"
              >
                <Icon name="edit" /> {q.prompt || "(질문 없음)"}
                {q.type === "choice" && (
                  <span className="ml-1 text-xs text-zinc-500">
                    (선택형 — 보기 {q.choices.length}개)
                  </span>
                )}
                {q.type === "short" && (
                  <span className="ml-1 text-xs text-zinc-500">(단답형)</span>
                )}
              </p>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-zinc-200 pt-3">
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm font-medium disabled:opacity-40"
          >
            « 이전
          </button>
          <span className="text-xs text-zinc-500">
            {idx + 1} / {screens.length}
          </span>
          <button
            onClick={() => setIdx((i) => Math.min(screens.length - 1, i + 1))}
            disabled={idx === screens.length - 1}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            다음 »
          </button>
        </div>
      </div>
    );
  }

  // ── ③ 화면이 없는 옛 활동 — 한 장짜리 ───────────────
  return (
    <div className="flex flex-col gap-3">
      {activity.type === "geogebra" && (
        <GeoGebraEmbed
          materialId={content.materialId ?? ""}
          height={content.height ?? 600}
        />
      )}

      {activity.type === "content" && (
        <div className="whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-6 leading-relaxed text-zinc-800">
          {content.body}
        </div>
      )}

      {activity.type === "image" && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          {content.imagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={
                createClient()
                  .storage.from("activity-files")
                  .getPublicUrl(content.imagePath).data.publicUrl
              }
              alt={content.caption || activity.title}
              className="mx-auto max-w-full rounded-md"
            />
          ) : (
            <p className="text-center text-sm text-zinc-400">
              이미지가 아직 올라가지 않았습니다.
            </p>
          )}
          {content.caption && (
            <p className="mt-3 text-center text-sm text-zinc-600">
              {content.caption}
            </p>
          )}
        </div>
      )}

      {activity.type === "problem" && (
        <div className="flex flex-col gap-3">
          <div className="whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-6 leading-relaxed text-zinc-800">
            {content.question}
          </div>
          <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500">
            학생 화면에는 여기에 답 입력란이 있습니다.
            <b className="ml-1 text-zinc-700">
              정답은 이 화면에 띄우지 않습니다
            </b>{" "}
            — 칠판에 비추어도 안전하도록 뺐습니다. 정답은 미리보기에서 확인하세요.
          </p>
        </div>
      )}

      {activity.type === "html" && !content.html && (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-500">
          이 활동에는 아직 내용이 없습니다.
        </p>
      )}

      <p className="text-xs text-zinc-400">
        이 활동은 화면이 하나뿐이라 넘길 것이 없습니다. 화면 가리기와 참여 현황은
        그대로 쓸 수 있습니다.
      </p>
    </div>
  );
}
