import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SubmissionsTable, {
  type SubmissionRow,
} from "@/components/teacher/submissions-table";

type StudentRow = {
  id: string;
  grade: number;
  class_no: number;
  student_no: number;
  name: string;
};

type ProgressRow = {
  student_id: string;
  completed: boolean;
  score: number | null;
  submission: { answer?: string } | null;
  response_text: string | null;
  updated_at: string;
};

// 활동별 제출 현황 (미제출자 포함) — 권한 가드는 teacher layout이 처리
export default async function SubmissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: activity } = await supabase
    .from("activities")
    .select("id, title, type, unit_id, units(title, grade)")
    .eq("id", id)
    .single<{
      id: string;
      title: string;
      type: string;
      unit_id: string;
      units: { title: string; grade: number };
    }>();
  if (!activity) notFound();

  const [{ data: students }, { data: progress }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, grade, class_no, student_no, name")
      .eq("role", "student")
      .eq("grade", activity.units.grade)
      .order("class_no")
      .order("student_no"),
    supabase
      .from("progress")
      .select("student_id, completed, score, submission, response_text, updated_at")
      .eq("activity_id", id),
  ]);

  const progressMap = new Map(
    ((progress as ProgressRow[]) ?? []).map((p) => [p.student_id, p])
  );

  const rows: SubmissionRow[] = ((students as StudentRow[]) ?? []).map((s) => {
    const p = progressMap.get(s.id);
    return {
      studentId: `${s.grade}${String(s.class_no).padStart(2, "0")}${String(
        s.student_no
      ).padStart(2, "0")}`,
      name: s.name,
      completed: p?.completed ?? false,
      score: p?.score ?? null,
      answer: p?.submission?.answer ?? "",
      responseText: p?.response_text ?? "",
      updatedAt: p?.updated_at ?? "",
    };
  });

  return (
    <SubmissionsTable
      unitId={activity.unit_id}
      unitTitle={activity.units.title}
      activityTitle={activity.title}
      rows={rows}
    />
  );
}
