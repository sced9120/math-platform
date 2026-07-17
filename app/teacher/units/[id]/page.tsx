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

  const { data: activities } = await supabase
    .from("activities")
    .select("*")
    .eq("unit_id", unit.id)
    .order("order_index");

  return (
    <ActivitiesManager unit={unit} initialActivities={(activities as Activity[]) ?? []} />
  );
}
