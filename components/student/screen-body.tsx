"use client";

import { createClient } from "@/lib/supabase/client";
import GeoGebraEmbed from "@/components/student/geogebra-embed";
import HtmlActivityFrame from "@/components/student/html-activity-frame";
import PlaneCanvas from "@/components/student/plane-canvas";
import { DEFAULT_PLANE, type Screen } from "@/lib/screens";

// 활동(화면) 한 칸을 유형에 맞게 그린다.
// 학생 화면과 교사 편집기의 미리보기가 같은 것을 보도록 여기 한 곳만 쓴다.
export default function ScreenBody({
  screen,
  fallbackTitle = "",
}: {
  screen: Pick<Screen, "type" | "config" | "title">;
  fallbackTitle?: string;
}) {
  const c = screen.config ?? {};

  switch (screen.type) {
    case "text":
      return c.body ? (
        <div
          className="rounded-lg border border-zinc-200 bg-white p-6 leading-relaxed text-zinc-800"
          dangerouslySetInnerHTML={{ __html: c.body }}
        />
      ) : (
        <Empty>본문을 적으면 여기에 보입니다.</Empty>
      );

    case "plane":
      return <PlaneCanvas config={c.plane ?? DEFAULT_PLANE} />;

    case "geogebra":
      return c.materialId ? (
        <GeoGebraEmbed materialId={c.materialId} height={c.height ?? 600} />
      ) : (
        <Empty>지오지브라 자료 ID 를 넣으면 여기에 보입니다.</Empty>
      );

    case "image":
      return c.imagePath ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              createClient().storage.from("activity-files").getPublicUrl(c.imagePath).data
                .publicUrl
            }
            alt={c.caption || screen.title || fallbackTitle}
            className="mx-auto max-w-full rounded-md"
          />
          {c.caption && <p className="mt-3 text-center text-sm text-zinc-600">{c.caption}</p>}
        </div>
      ) : (
        <Empty>이미지 경로를 넣으면 여기에 보입니다.</Empty>
      );

    case "html":
    case "legacy":
      return c.html ? (
        <HtmlActivityFrame
          html={c.html}
          title={screen.title || fallbackTitle}
          initialHeight={c.height}
        />
      ) : (
        <Empty>HTML 을 붙여넣으면 여기에서 바로 돌아갑니다.</Empty>
      );

    default:
      return null;
  }
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
      {children}
    </p>
  );
}
