import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Subject, Unit } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  geogebra: "GeoGebra",
  content: "자료",
  problem: "문제",
  image: "사진",
  html: "체험",
};

type StudentActivity = {
  id: string;
  unit_id: string;
  type: string;
  title: string;
  order_index: number;
};
type ProgressRow = { activity_id: string; completed: boolean };

// 교과 상세: 단원별로 묶인 활동 목록 (내 교과 → 공통수학2 → 각 활동)
export default async function StudentSubjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: subject } = await supabase
    .from("subjects")
    .select("*")
    .eq("id", id)
    .maybeSingle<Subject>();
  if (!subject) notFound();

  const [unitsRes, activitiesRes, progressRes] = await Promise.all([
    supabase.from("units").select("*").eq("subject_id", id).order("order_index"),
    supabase.rpc("student_activities"),
    supabase.from("progress").select("activity_id, completed"),
  ]);

  const units = (unitsRes.data as Unit[] | null) ?? [];
  const unitIds = new Set(units.map((u) => u.id));
  const activities = ((activitiesRes.data as StudentActivity[] | null) ?? []).filter(
    (a) => unitIds.has(a.unit_id)
  );
  const completed = new Set(
    ((progressRes.data as ProgressRow[] | null) ?? [])
      .filter((p) => p.completed)
      .map((p) => p.activity_id)
  );

  const doneCount = activities.filter((a) => completed.has(a.id)).length;

  // 활동이 하나도 없는 단원은 감춘다
  const sections = units
    .map((u) => ({ unit: u, list: activities.filter((a) => a.unit_id === u.id) }))
    .filter((s) => s.list.length > 0);

  // 전체 통틀어 몇 번째 활동인지(단원을 넘어 이어지는 번호)
  let counter = 0;

  return (
    <div>
      <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
        ← 내 교과
      </Link>
      <div className="mt-1 mb-5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">{subject.title}</h2>
        <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-600">
          {doneCount} / {activities.length} 완료
        </span>
      </div>

      {sections.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          아직 공개된 활동이 없습니다.
        </p>
      ) : (
        <div className="flex flex-col gap-7">
          {sections.map(({ unit, list }) => (
            <section key={unit.id}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-700">
                <span className="h-4 w-1 rounded-full bg-blue-500" />
                {unit.title}
                <span className="font-normal text-zinc-400">활동 {list.length}개</span>
              </h3>
              <div className="flex flex-col gap-2">
                {list.map((a) => {
                  counter += 1;
                  const isDone = completed.has(a.id);
                  return (
                    <Link
                      key={a.id}
                      href={`/activity/${a.id}`}
                      className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-blue-400"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="w-5 shrink-0 text-sm text-zinc-400">{counter}</span>
                        <span className="shrink-0 rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                          {TYPE_LABELS[a.type] ?? a.type}
                        </span>
                        <span className="truncate font-medium text-zinc-900">{a.title}</span>
                      </div>
                      {isDone ? (
                        <span className="shrink-0 text-sm text-green-600">완료 ✓</span>
                      ) : (
                        <span className="shrink-0 text-sm text-zinc-400">미완료</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
