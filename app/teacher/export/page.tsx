import { createClient } from "@/lib/supabase/server";
import { myStudentIds } from "@/lib/my-students";
import ExportBuilder, {
  type ExportActivity,
  type ExportStudent,
  type ExportUnit,
} from "@/components/teacher/export-builder";

// 기록 다운로드: 학생(학년/반/개인)과 활동을 선택해 통합 CSV 생성
export default async function ExportPage() {
  const supabase = await createClient();
  const me = (await supabase.auth.getUser()).data.user?.id ?? "";
  const myIds = await myStudentIds(supabase, me);

  const [{ data: students }, { data: units }, { data: activities }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, grade, class_no, student_no, name")
        .eq("role", "student")
        .in("id", myIds) // 내 목록에 담은 학생만 (관리자도 — 다른 교사 학급이 섞이지 않게)
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
