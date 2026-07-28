import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Subject, Unit } from "@/lib/types";

type StudentActivity = { id: string; unit_id: string; subject_id?: string | null };
type ProgressRow = { activity_id: string; completed: boolean };

// 학생 대시보드: 내 교과 목록 (교과 → 단원 → 활동)
// 교과에 속하지 않은 옛 단원은 아래에 따로 보여 준다.
export default async function DashboardPage() {
  const supabase = await createClient();

  const [subjectsRes, unitsRes, activitiesRes, progressRes] = await Promise.all([
    supabase.from("subjects").select("*").order("order_index"),
    supabase.from("units").select("*").order("order_index"),
    supabase.rpc("student_activities"),
    supabase.from("progress").select("activity_id, completed"),
  ]);

  // subjects 테이블(마이그레이션 0010)이 아직 없어도 화면이 죽지 않게 한다
  const subjects = (subjectsRes.data as Subject[] | null) ?? [];
  const units = (unitsRes.data as Unit[] | null) ?? [];
  const activities = (activitiesRes.data as StudentActivity[] | null) ?? [];
  const progress = (progressRes.data as ProgressRow[] | null) ?? [];

  const completedIds = new Set(
    progress.filter((p) => p.completed).map((p) => p.activity_id)
  );

  const unitById = new Map(units.map((u) => [u.id, u]));
  // 활동이 어느 교과에 속하는지: RPC 가 subject_id 를 주면 그걸 쓰고, 없으면 단원에서 찾는다
  function subjectOf(a: StudentActivity): string | null {
    if (a.subject_id !== undefined) return a.subject_id;
    return unitById.get(a.unit_id)?.subject_id ?? null;
  }

  function stats(list: StudentActivity[]) {
    const done = list.filter((a) => completedIds.has(a.id)).length;
    return { total: list.length, done };
  }

  const subjectList = subjects
    .map((s) => ({
      subject: s,
      ...stats(activities.filter((a) => subjectOf(a) === s.id)),
    }))
    .filter((x) => x.total > 0);

  // 교과에 속하지 않은 단원(옛 구조)
  const looseUnits = units
    .filter((u) => !u.subject_id)
    .map((u) => ({ unit: u, ...stats(activities.filter((a) => a.unit_id === u.id)) }))
    .filter((x) => x.total > 0);

  const empty = subjectList.length === 0 && looseUnits.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">내 교과</h2>

        {empty ? (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
            아직 공개된 교과가 없습니다.
          </p>
        ) : subjectList.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
            아직 공개된 교과가 없습니다.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {subjectList.map(({ subject, total, done }) => {
              const allDone = total > 0 && done === total;
              return (
                <Link
                  key={subject.id}
                  href={`/subject/${subject.id}`}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-blue-400"
                >
                  <div>
                    <h3 className="font-semibold text-zinc-900">{subject.title}</h3>
                    <p className="mt-0.5 text-sm text-zinc-500">활동 {total}개</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-sm ${
                      allDone ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {allDone ? "완료 ✓" : `${done} / ${total} 완료`}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {looseUnits.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">기타 단원</h2>
          <div className="flex flex-col gap-3">
            {looseUnits.map(({ unit, total, done }) => {
              const allDone = total > 0 && done === total;
              return (
                <Link
                  key={unit.id}
                  href={`/unit/${unit.id}`}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-blue-400"
                >
                  <div>
                    <h3 className="font-semibold text-zinc-900">{unit.title}</h3>
                    <p className="mt-0.5 text-sm text-zinc-500">활동 {total}개</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-sm ${
                      allDone ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {allDone ? "완료 ✓" : `${done} / ${total} 완료`}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
