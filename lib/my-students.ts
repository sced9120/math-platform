import type { SupabaseClient } from "@supabase/supabase-js";

// 내 목록에 담은 학생 id (0016 teacher_students).
// 진도·제출·기록 화면은 관리자도 "자기 목록"만 보여 준다 — 관리자는 RLS 상 모든 학생
// 프로필을 볼 수 있어서, 거르지 않으면 다른 교사의 학급까지 섞인다.
export async function myStudentIds(supabase: SupabaseClient, me: string): Promise<string[]> {
  const { data } = await supabase
    .from("teacher_students")
    .select("student_id")
    .eq("teacher_id", me);
  return ((data ?? []) as { student_id: string }[]).map((r) => r.student_id);
}
