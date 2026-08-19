import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ScreensManager from "@/components/teacher/screens-manager";
import ScreensEditor from "@/components/teacher/screens-editor";
import { parseActivityHtml } from "@/lib/activity-html";
import type { Screen } from "@/lib/screens";

// 활동 안의 "화면"을 관리하는 페이지 — 권한 가드는 teacher layout 이 처리한다.
//  - 화면 구성(activity_screens)이 있으면 새 편집기
//  - 없으면 예전 방식(HTML 한 덩어리) 편집기
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

  const [{ data: screenRows }, { data: siblings }] = await Promise.all([
    supabase
      .from("activity_screens")
      .select("*")
      .eq("activity_id", id)
      .order("order_index"),
    supabase
      .from("activities")
      .select("id, title")
      .eq("unit_id", activity.unit_id)
      .neq("id", id)
      .order("order_index"),
  ]);

  const screens = (screenRows as Screen[] | null) ?? [];

  if (screens.length > 0) {
    return (
      <ScreensEditor
        activityId={activity.id}
        activityTitle={activity.title}
        unitId={activity.unit_id}
        unitTitle={activity.units.title}
        initialScreens={screens}
        otherActivities={(siblings as { id: string; title: string }[] | null) ?? []}
      />
    );
  }

  const parsed =
    activity.type === "html" ? parseActivityHtml(activity.content?.html ?? "") : null;

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
