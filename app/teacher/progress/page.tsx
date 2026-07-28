import { createClient } from "@/lib/supabase/server";
import ProgressBoard, { type BoardData } from "@/components/teacher/progress-board";

// 진도 현황: 반 × 활동 완료율 (권한 가드는 teacher layout이 처리)
export default async function TeacherProgressPage() {
  const supabase = await createClient();

  const [subjectsRes, unitsRes, activitiesRes, studentsRes, progressRes] =
    await Promise.all([
      supabase.from("subjects").select("id, title, grade, order_index").order("order_index"),
      // subject_id 는 마이그레이션 0010 이후에만 있으므로 컬럼을 나열하지 않는다
      supabase.from("units").select("*").order("order_index"),
      supabase
        .from("activities")
        .select("id, title, unit_id, order_index, is_published, assigned_classes")
        .order("order_index"),
      supabase
        .from("profiles")
        .select("id, grade, class_no")
        .eq("role", "student"),
      supabase.from("progress").select("student_id, activity_id, completed"),
    ]);

  const data: BoardData = {
    // subjects 테이블이 아직 없어도(마이그레이션 전) 화면이 죽지 않게 한다
    subjects: subjectsRes.data ?? [],
    units: unitsRes.data ?? [],
    activities: activitiesRes.data ?? [],
    students: studentsRes.data ?? [],
    progress: (progressRes.data ?? []).filter((p) => p.completed),
  };

  return <ProgressBoard data={data} />;
}
