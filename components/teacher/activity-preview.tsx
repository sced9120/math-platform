"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import GeoGebraEmbed from "@/components/student/geogebra-embed";
import HtmlActivityFrame, {
  type ScreenInfo,
} from "@/components/student/html-activity-frame";
import { FREE_KEY } from "@/components/student/screen-response";
import type { Activity } from "@/lib/types";

// 교사용 활동 미리보기 — 학생이 실제로 보는 화면을 그대로 렌더한다(읽기 전용).
// 저장·채점·AI 없이 "결과물이 어떻게 보이는지"만 확인하는 용도.
export default function ActivityPreview({ activity }: { activity: Activity }) {
  // 활동 HTML 이 지금 보여 주는 화면 — 학생 화면처럼 화면마다 질문이 바뀐다
  const [screen, setScreen] = useState<ScreenInfo | null>(null);
  const screenDriven = activity.type === "html" && !!screen?.hasPrompts;

  const content = activity.content as {
    materialId?: string;
    height?: number;
    body?: string;
    question?: string;
    answer?: string;
    tolerance?: number;
    imagePath?: string;
    caption?: string;
    html?: string;
    response_prompt?: string;
  };

  function imageUrl(path: string): string {
    return createClient().storage.from("activity-files").getPublicUrl(path).data
      .publicUrl;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 유형별 본체 — 학생 화면과 동일하게 */}
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
              src={imageUrl(content.imagePath)}
              alt={content.caption || activity.title}
              className="mx-auto max-w-full rounded-md"
            />
          ) : (
            <p className="text-center text-sm text-zinc-400">
              이미지가 아직 업로드되지 않았습니다.
            </p>
          )}
          {content.caption && (
            <p className="mt-3 text-center text-sm text-zinc-600">
              {content.caption}
            </p>
          )}
        </div>
      )}

      {activity.type === "html" && (
        <HtmlActivityFrame
          html={content.html ?? ""}
          title={activity.title}
          initialHeight={content.height}
          onScreen={setScreen}
        />
      )}

      {activity.type === "problem" && (
        <div className="flex flex-col gap-4">
          <div className="whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-6 leading-relaxed text-zinc-800">
            {content.question}
          </div>
          {/* 학생 화면과 같은 답 입력란(미리보기라 비활성) */}
          <div className="flex gap-2">
            <input
              type="text"
              disabled
              placeholder="답을 입력하세요"
              className="w-56 cursor-not-allowed rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-zinc-400"
            />
            <button
              disabled
              className="cursor-not-allowed rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white opacity-50"
            >
              제출
            </button>
          </div>
          {/* 교사에게만 보이는 정답 정보 (학생에게는 내려가지 않음) */}
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            🔑 정답: <b>{content.answer || "(미설정)"}</b>
            {content.tolerance ? ` · 허용오차 ±${content.tolerance}` : ""}
            <span className="ml-1 text-amber-600">
              (교사에게만 보입니다 — 학생 화면에는 표시되지 않습니다)
            </span>
          </p>
        </div>
      )}

      {/* 학생 기록칸 (미리보기라 비활성).
          화면별 질문을 갖춘 활동은 지금 열린 화면의 질문을, 옛 활동은 활동 단위 질문을 보여 준다. */}
      {screenDriven ? (
        screen!.prompt ? (
          <PreviewBox
            prompt={screen!.prompt}
            photo={screen!.photo}
            badge={
              screen!.key === FREE_KEY
                ? "자유 기록 화면"
                : `${screen!.index + 1}번째 화면`
            }
          />
        ) : (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-500">
            이 화면에는 기록칸이 없습니다 — 조작·관찰만 하는 화면입니다.
            <span className="ml-1 text-zinc-400">
              (질문을 넣으려면 활동 HTML 의 이 화면에 data-prompt 를 추가하세요)
            </span>
          </p>
        )
      ) : (
        content.response_prompt && <PreviewBox prompt={content.response_prompt} />
      )}
    </div>
  );
}

// 미리보기용 기록칸 — 학생 화면과 같은 모양이되 입력은 막아 둔다
function PreviewBox({
  prompt,
  photo,
  badge,
}: {
  prompt: string;
  photo?: boolean;
  badge?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border p-4 ${
        photo ? "border-amber-300 bg-amber-50" : "border-blue-200 bg-blue-50"
      }`}
    >
      {badge && (
        <span className="self-start rounded bg-white/70 px-2 py-0.5 text-xs font-semibold text-zinc-600">
          {badge}
        </span>
      )}
      <label className="text-sm font-medium text-zinc-900">✏️ {prompt}</label>
      <textarea
        readOnly
        rows={5}
        placeholder="학생이 여기에 글을 작성해 저장합니다. (미리보기에서는 작성·저장할 수 없습니다)"
        className="cursor-not-allowed rounded-md border border-zinc-200 bg-white p-3 text-sm text-zinc-500"
      />
      {photo && (
        <p className="text-xs text-zinc-500">
          📷 이 화면은 학생이 사진(공책 촬영·PDF)으로도 낼 수 있습니다.
        </p>
      )}
    </div>
  );
}
