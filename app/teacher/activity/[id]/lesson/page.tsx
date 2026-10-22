import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isStaff } from "@/lib/auth";
import LessonBoard from "@/components/teacher/lesson-board";
import { parseActivityHtml } from "@/lib/activity-html";
import type { Activity, Unit } from "@/lib/types";
import type { Screen } from "@/lib/screens";
import Icon from "@/components/icon";

// 함께 수업하기 — 학생이 어디까지 왔는지 보고, 같이 넘기고, 화면을 덮는다.
// 기록은 평소와 똑같이 남는다(이 화면은 진행용일 뿐 저장하는 것이 없다).
export default async function TeacherLessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  if (!isStaff(profile.role)) redirect("/dashboard");

  const supabase = await createClient();
  const { data: activity } = await supabase
    .from("activities")
    .select("*")
    .eq("id", id)
    .single<Activity>();
  if (!activity) notFound();

  const [{ data: unit }, { data: screenRows }] = await Promise.all([
    supabase
      .from("units")
      .select("id, title")
      .eq("id", activity.unit_id)
      .single<Pick<Unit, "id" | "title">>(),
    supabase
      .from("activity_screens")
      .select("*")
      .eq("activity_id", id)
      .order("order_index"),
  ]);

  // 화면 제목 목록 — 교사가 번호를 눌러 부를 수 있게.
  // 교사가 화면을 짜 둔 활동이면 그것을, HTML 활동이면 안의 <section> 들을 센다.
  const authored = (screenRows as Screen[] | null) ?? [];
  const html =
    activity.type === "html"
      ? ((activity.content as { html?: string })?.html ?? "")
      : "";
  let screenTitles: string[] = authored.map((s) => s.title || "");
  if (screenTitles.length === 0 && html) {
    screenTitles = (parseActivityHtml(html)?.screens ?? []).map((s) => s.heading || "");
  }

  return (
    <div>
      <Link
        href={`/teacher/units/${activity.unit_id}`}
        className="text-sm text-blue-600 hover:underline"
      >
        ← {unit?.title ?? "단원"} 소단원 관리
      </Link>
      <h2 className="mt-1 mb-1 text-lg font-semibold text-zinc-900">
        {activity.title}
      </h2>
      <p className="mb-4 text-sm text-zinc-500">
        <Icon name="users" /> 함께 수업하기
      </p>

      {screenTitles.length === 0 ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <Icon name="alert" /> 이 활동은 화면이 하나뿐이라 &lsquo;같이 넘기기&rsquo;가
          없습니다. 참여 현황·화면 가리기와 아래 시연 화면은 그대로 쓸 수 있습니다.
        </p>
      ) : null}

      <div className="mt-2">
        <LessonBoard
          activityId={id}
          activityTitle={activity.title}
          screenTitles={screenTitles}
          activity={activity}
          screens={authored}
          me={{ id: profile.id, name: profile.name }}
        />
      </div>
    </div>
  );
}
