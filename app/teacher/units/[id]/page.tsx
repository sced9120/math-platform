import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ActivitiesManager from "@/components/teacher/activities-manager";
import type { Activity, Unit } from "@/lib/types";

export default async function TeacherUnitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: unit } = await supabase
    .from("units")
    .select("*")
    .eq("id", id)
    .single<Unit>();

  if (!unit) notFound();

  const [{ data: activities }, { data: classRows }] = await Promise.all([
    supabase
      .from("activities")
      .select("*")
      .eq("unit_id", unit.id)
      .order("order_index"),
    supabase
      .from("profiles")
      .select("class_no")
      .eq("role", "student")
      .eq("grade", unit.grade),
  ]);

  // 해당 학년에 존재하는 반 목록 (중복 제거·정렬)
  const classList = [
    ...new Set(
      ((classRows as { class_no: number }[]) ?? []).map((r) => r.class_no)
    ),
  ].sort((a, b) => a - b);

  return (
    <ActivitiesManager
      unit={unit}
      initialActivities={(activities as Activity[]) ?? []}
      classList={classList}
    />
  );
}
