import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// 관리자 → 교사 계정 넘기기 (0017 transfer_teaching)
//
// 관리자는 교사 계정만 관리한다. 다만 예전에는 관리자가 직접 수업을 했으므로,
// 아직 학생이나 자료를 갖고 있으면 그것을 교사 계정으로 넘길 때까지 수업 메뉴를 남겨 둔다.

export type AdminHoldings = {
  students: number;
  subjects: number;
  units: number;
  activities: number;
};

// 관리자가 지금 가진 학생·자료 수. (0016 전이라 owner_id 가 없으면 자료 수는 null)
export async function adminHoldings(adminId: string): Promise<AdminHoldings | null> {
  const db = createAdminClient();
  const count = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
    const { count, error } = await q;
    return error ? null : (count ?? 0);
  };
  const [students, subjects, units, activities] = await Promise.all([
    count(
      db
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "student")
        .eq("teacher_id", adminId)
    ),
    count(db.from("subjects").select("id", { count: "exact", head: true }).eq("owner_id", adminId)),
    count(db.from("units").select("id", { count: "exact", head: true }).eq("owner_id", adminId)),
    count(db.from("activities").select("id", { count: "exact", head: true }).eq("owner_id", adminId)),
  ]);
  if (students === null || subjects === null || units === null || activities === null) return null;
  return { students, subjects, units, activities };
}

// 관리자에게 수업 메뉴를 보여 줘야 하는가 — 셀 수 없으면(마이그레이션 전) 보여 준다
export async function adminStillTeaching(adminId: string): Promise<boolean> {
  const h = await adminHoldings(adminId);
  if (!h) return true;
  return h.students + h.subjects + h.units + h.activities > 0;
}
