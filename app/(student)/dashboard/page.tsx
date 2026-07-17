import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Unit } from "@/lib/types";

type StudentActivity = { id: string; unit_id: string };
type ProgressRow = { activity_id: string; completed: boolean };

// 학생 대시보드: 자기 학년의 공개 단원 목록 + 완료 현황
export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: units }, { data: activities }, { data: progress }] =
    await Promise.all([
      supabase.from("units").select("*").order("order_index"),
      supabase.rpc("student_activities"),
      supabase.from("progress").select("activity_id, completed"),
    ]);

  const completedIds = new Set(
    ((progress as ProgressRow[]) ?? []).filter((p) => p.completed).map((p) => p.activity_id)
  );

  function unitStats(unitId: string) {
    const acts = ((activities as StudentActivity[]) ?? []).filter(
      (a) => a.unit_id === unitId
    );
    const done = acts.filter((a) => completedIds.has(a.id)).length;
    return { total: acts.length, done };
  }

  const unitList = (units as Unit[]) ?? [];

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-zinc-900">내 단원</h2>

      {unitList.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          아직 공개된 단원이 없습니다.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {unitList.map((u) => {
            const { total, done } = unitStats(u.id);
            const allDone = total > 0 && done === total;
            return (
              <Link
                key={u.id}
                href={`/unit/${u.id}`}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-blue-400"
              >
                <div>
                  <h3 className="font-semibold text-zinc-900">{u.title}</h3>
                  <p className="mt-0.5 text-sm text-zinc-500">활동 {total}개</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-sm ${
                    allDone
                      ? "bg-green-100 text-green-700"
                      : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {allDone ? "완료 ✓" : `${done} / ${total} 완료`}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
