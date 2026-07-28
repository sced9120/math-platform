import { createClient } from "@/lib/supabase/server";
import SubjectsManager from "@/components/teacher/subjects-manager";
import type { Subject, Unit } from "@/lib/types";

// 교과 관리: 교과 생성/공개 + 단원을 어느 교과에 넣을지 지정
export default async function TeacherSubjectsPage() {
  const supabase = await createClient();

  const [subjectsRes, unitsRes] = await Promise.all([
    supabase.from("subjects").select("*").order("grade").order("order_index"),
    supabase.from("units").select("*").order("grade").order("order_index"),
  ]);

  // subjects 테이블이 아직 없으면(마이그레이션 0010 미실행) 안내를 보여 준다
  const missingTable = !!subjectsRes.error;

  return (
    <SubjectsManager
      initialSubjects={(subjectsRes.data as Subject[]) ?? []}
      initialUnits={(unitsRes.data as Unit[]) ?? []}
      missingTable={missingTable}
    />
  );
}
