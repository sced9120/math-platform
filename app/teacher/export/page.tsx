import { createClient } from "@/lib/supabase/server";
import ExportBuilder, {
  type ExportActivity,
  type ExportStudent,
  type ExportUnit,
} from "@/components/teacher/export-builder";

// 기록 다운로드: 학생(학년/반/개인)과 활동을 선택해 통합 CSV 생성
export default async function ExportPage() {
  const supabase = await createClient();

  const [{ data: students }, { data: units }, { data: activities }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, grade, class_no, student_no, name")
        .eq("role", "student")
        .order("grade")
        .order("class_no")
        .order("student_no"),
      supabase.from("units").select("id, title, grade").order("grade").order("order_index"),
      supabase
        .from("activities")
        .select("id, unit_id, title, type, order_index")
        .order("order_index"),
    ]);

  return (
    <ExportBuilder
      students={(students as ExportStudent[]) ?? []}
      units={(units as ExportUnit[]) ?? []}
      activities={(activities as ExportActivity[]) ?? []}
    />
  );
}
