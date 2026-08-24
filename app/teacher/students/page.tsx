import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import StudentsManager, {
  type RosterStudent,
  type StudentProfile,
} from "@/components/teacher/students-manager";

// 학생 관리
//  - 교사: 내 목록에 담은 학생을 관리하고, 서버 전체 명단에서 골라 담는다
//  - 관리자: 전체가 보이고, 담당 교사 이름도 함께 표시한다
export default async function TeacherStudentsPage() {
  const profile = await requireProfile();
  const isAdmin = profile.role === "admin";
  const supabase = await createClient();

  // 내 목록에 담긴 학생 (RLS 가 teacher_students 기준으로 걸러 준다 — 관리자는 전체)
  const { data } = await supabase
    .from("profiles")
    .select("id, grade, class_no, student_no, name, must_change_password, teacher_id")
    .eq("role", "student")
    .order("grade")
    .order("class_no")
    .order("student_no");

  // 이 서버에 등록된 전체 학생. 담당이 아닌 학생도 보여야 하므로 RLS 대신 함수로 받는다.
  // 0016 을 아직 실행하지 않았으면 함수가 없다 — 화면이 죽는 대신 안내를 띄운다.
  const rosterRes = await supabase.rpc("all_students");

  // 관리자 화면의 "담당 교사" 열. 한 학생을 여러 교사가 담을 수 있으므로 이름이 여럿일 수 있다.
  let teacherNames: Record<string, string> = {};
  const studentTeachers: Record<string, string[]> = {};
  if (isAdmin) {
    const [{ data: teachers }, { data: links }] = await Promise.all([
      supabase.from("profiles").select("id, name").in("role", ["teacher", "admin"]),
      supabase.from("teacher_students").select("teacher_id, student_id"),
    ]);
    teacherNames = Object.fromEntries(
      (teachers ?? []).map((t) => [t.id as string, t.name as string])
    );
    for (const l of (links ?? []) as { teacher_id: string; student_id: string }[]) {
      (studentTeachers[l.student_id] ??= []).push(l.teacher_id);
    }
  }

  return (
    <StudentsManager
      meId={profile.id}
      initialStudents={(data ?? []) as StudentProfile[]}
      roster={(rosterRes.data ?? []) as RosterStudent[]}
      rosterReady={!rosterRes.error}
      isAdmin={isAdmin}
      teacherNames={teacherNames}
      studentTeachers={studentTeachers}
    />
  );
}
