import { createClient } from "@/lib/supabase/server";
import StudentsManager from "@/components/teacher/students-manager";

export default async function TeacherStudentsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, grade, class_no, student_no, name, must_change_password")
    .eq("role", "student")
    .order("grade")
    .order("class_no")
    .order("student_no");

  return <StudentsManager initialStudents={data ?? []} />;
}
