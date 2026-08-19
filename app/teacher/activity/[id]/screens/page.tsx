import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ScreensManager from "@/components/teacher/screens-manager";
import { parseActivityHtml } from "@/lib/activity-html";

// 활동 안의 "화면"을 관리하는 페이지 — 권한 가드는 teacher layout 이 처리한다.
export default async function ScreensPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: activity } = await supabase
    .from("activities")
    .select("id, title, type, unit_id, content, units(title)")
    .eq("id", id)
    .single<{
      id: string;
      title: string;
      type: string;
      unit_id: string;
      content: { html?: string } | null;
      units: { title: string };
    }>();
  if (!activity) notFound();

  const html = activity.content?.html ?? "";
  const parsed = activity.type === "html" ? parseActivityHtml(html) : null;

  return (
    <ScreensManager
      activityId={activity.id}
      activityTitle={activity.title}
      unitId={activity.unit_id}
      unitTitle={activity.units.title}
      parsed={parsed}
    />
  );
}
