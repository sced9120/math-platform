import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Unit } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  geogebra: "GeoGebra",
  content: "자료",
  problem: "문제",
  image: "사진",
  html: "체험",
};

type StudentActivity = {
  id: string;
  type: string;
  title: string;
  order_index: number;
};
type ProgressRow = { activity_id: string; completed: boolean; score: number | null };

// 단원의 활동 목록 (학생용 — 정답이 제거된 RPC로 조회)
export default async function StudentUnitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: unit } = await supabase
    .from("units")
    .select("*")
    .eq("id", id)
    .single<Unit>();
  if (!unit) notFound();

  const [{ data: activities }, { data: progress }] = await Promise.all([
    supabase.rpc("student_activities", { p_unit_id: id }),
    supabase.from("progress").select("activity_id, completed, score"),
  ]);

  const progressMap = new Map(
    ((progress as ProgressRow[]) ?? []).map((p) => [p.activity_id, p])
  );
  const actList = (activities as StudentActivity[]) ?? [];

  return (
    <div>
      <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
        ← 내 단원
      </Link>
      <h2 className="mt-1 mb-4 text-lg font-semibold text-zinc-900">{unit.title}</h2>

      {actList.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          아직 공개된 활동이 없습니다.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {actList.map((a, i) => {
            const p = progressMap.get(a.id);
            return (
              <Link
                key={a.id}
                href={`/activity/${a.id}`}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-blue-400"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm text-zinc-400">{i + 1}</span>
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                    {TYPE_LABELS[a.type] ?? a.type}
                  </span>
                  <span className="font-medium text-zinc-900">{a.title}</span>
                </div>
                {p?.completed ? (
                  <span className="text-sm text-green-600">완료 ✓</span>
                ) : (
                  <span className="text-sm text-zinc-400">미완료</span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
