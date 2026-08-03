import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import StudentsManager from "@/components/teacher/students-manager";

// 학생 관리
//  - 교사: 자기가 담당하는 학생만 보인다 (RLS 가 걸러 준다)
//  - 관리자: 전체가 보이고, 담당 교사 이름도 함께 표시한다
export default async function TeacherStudentsPage() {
  const profile = await requireProfile();
  const isAdmin = profile.role === "admin";
  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select("id, grade, class_no, student_no, name, must_change_password, teacher_id")
    .eq("role", "student")
    .order("grade")
    .order("class_no")
    .order("student_no");

  // 관리자 화면에서 "담당 교사"를 이름으로 보여 주기 위한 표
  let teacherNames: Record<string, string> = {};
  if (isAdmin) {
    const { data: teachers } = await supabase
      .from("profiles")
      .select("id, name")
      .in("role", ["teacher", "admin"]);
    teacherNames = Object.fromEntries(
      (teachers ?? []).map((t) => [t.id as string, t.name as string])
    );
  }

  return (
    <StudentsManager
      initialStudents={data ?? []}
      isAdmin={isAdmin}
      teacherNames={teacherNames}
    />
  );
}
