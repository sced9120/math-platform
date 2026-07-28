"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";

type Subject = { id: string; title: string; grade: number; order_index: number };
type Unit = {
  id: string;
  title: string;
  grade: number;
  order_index: number;
  subject_id: string | null;
};
type Activity = {
  id: string;
  title: string;
  unit_id: string;
  order_index: number;
  is_published: boolean;
  assigned_classes: number[] | null;
};
type Student = { id: string; grade: number; class_no: number };
type Progress = { student_id: string; activity_id: string; completed: boolean };

export type BoardData = {
  subjects: Subject[];
  units: Unit[];
  activities: Activity[];
  students: Student[];
  progress: Progress[];
};

// 완료율에 따른 배경색 (0% 흰색 → 100% 진한 초록)
function heat(rate: number | null): string {
  if (rate === null) return "bg-zinc-50 text-zinc-300";
  if (rate >= 0.9) return "bg-green-600 text-white";
  if (rate >= 0.7) return "bg-green-400 text-white";
  if (rate >= 0.5) return "bg-green-200 text-green-900";
  if (rate >= 0.3) return "bg-amber-100 text-amber-800";
  if (rate > 0) return "bg-orange-100 text-orange-800";
  return "bg-white text-zinc-400";
}

export default function ProgressBoard({ data }: { data: BoardData }) {
  const grades = useMemo(
    () => [...new Set(data.students.map((s) => s.grade))].sort((a, b) => a - b),
    [data.students]
  );
  const [grade, setGrade] = useState<number>(grades[0] ?? 1);
  const [onlyPublished, setOnlyPublished] = useState(true);

  const classes = useMemo(
    () =>
      [...new Set(data.students.filter((s) => s.grade === grade).map((s) => s.class_no))].sort(
        (a, b) => a - b
      ),
    [data.students, grade]
  );

  // 학년에 해당하는 단원 → 활동
  const unitsOfGrade = data.units.filter((u) => u.grade === grade);
  const unitIds = new Set(unitsOfGrade.map((u) => u.id));
  const acts = data.activities
    .filter((a) => unitIds.has(a.unit_id))
    .filter((a) => (onlyPublished ? a.is_published : true));

  // 학생 index
  const studentsByClass = useMemo(() => {
    const m = new Map<number, string[]>();
    data.students
      .filter((s) => s.grade === grade)
      .forEach((s) => {
        if (!m.has(s.class_no)) m.set(s.class_no, []);
        m.get(s.class_no)!.push(s.id);
      });
    return m;
  }, [data.students, grade]);

  // 완료 집합
  const done = useMemo(() => {
    const m = new Map<string, Set<string>>(); // activityId → studentIds
    data.progress.forEach((p) => {
      if (!m.has(p.activity_id)) m.set(p.activity_id, new Set());
      m.get(p.activity_id)!.add(p.student_id);
    });
    return m;
  }, [data.progress]);

  // 활동 × 반 완료율 (해당 반에 부여되지 않은 활동은 null)
  function rateOf(a: Activity, cls: number): { rate: number | null; done: number; total: number } {
    if (a.assigned_classes && !a.assigned_classes.includes(cls)) {
      return { rate: null, done: 0, total: 0 };
    }
    const ids = studentsByClass.get(cls) ?? [];
    if (ids.length === 0) return { rate: null, done: 0, total: 0 };
    const set = done.get(a.id);
    const d = set ? ids.filter((i) => set.has(i)).length : 0;
    return { rate: d / ids.length, done: d, total: ids.length };
  }

  // 단원별로 묶어 표시
  const sections = unitsOfGrade
    .map((u) => ({
      unit: u,
      subject: data.subjects.find((s) => s.id === u.subject_id) ?? null,
      list: acts.filter((a) => a.unit_id === u.id),
    }))
    .filter((s) => s.list.length > 0);

  // 반별 전체 완료율
  const classTotals = classes.map((cls) => {
    let d = 0,
      t = 0;
    acts.forEach((a) => {
      const r = rateOf(a, cls);
      d += r.done;
      t += r.total;
    });
    return { cls, done: d, total: t, rate: t ? d / t : null };
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">진도 현황</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            학년
            <select
              value={grade}
              onChange={(e) => setGrade(Number(e.target.value))}
              className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
            >
              {(grades.length ? grades : [1]).map((g) => (
                <option key={g} value={g}>
                  {g}학년
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input
              type="checkbox"
              checked={onlyPublished}
              onChange={(e) => setOnlyPublished(e.target.checked)}
            />
            공개된 활동만
          </label>
        </div>
      </div>

      {classes.length === 0 || acts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          {classes.length === 0
            ? "해당 학년 학생이 없습니다."
            : "표시할 활동이 없습니다."}
        </p>
      ) : (
        <>
          {/* 반별 요약 */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {classTotals.map((c) => (
              <div key={c.cls} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold text-zinc-900">{c.cls}반</span>
                  <span className="text-lg font-bold text-blue-600">
                    {c.rate === null ? "-" : Math.round(c.rate * 100) + "%"}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${(c.rate ?? 0) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  완료 {c.done} / {c.total}건
                </p>
              </div>
            ))}
          </div>

          {/* 활동 × 반 히트맵 */}
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="py-2 pr-3 text-left font-medium">활동</th>
                  {classes.map((c) => (
                    <th key={c} className="px-2 py-2 text-center font-medium">
                      {c}반
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sections.map(({ unit, subject, list }) => (
                  <Fragment key={unit.id}>
                    <tr className="bg-zinc-50">
                      <td
                        colSpan={classes.length + 1}
                        className="px-2 py-1.5 text-xs font-semibold text-zinc-600"
                      >
                        {subject ? `${subject.title} · ` : ""}
                        {unit.title}
                      </td>
                    </tr>
                    {list.map((a) => (
                      <tr key={a.id} className="border-b border-zinc-100 last:border-0">
                        <td className="max-w-[260px] truncate py-2 pr-3">
                          <Link
                            href={`/teacher/activity/${a.id}/submissions`}
                            className="text-zinc-800 hover:text-blue-600 hover:underline"
                          >
                            {a.title}
                          </Link>
                          {!a.is_published && (
                            <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-500">
                              비공개
                            </span>
                          )}
                        </td>
                        {classes.map((c) => {
                          const r = rateOf(a, c);
                          return (
                            <td key={c} className="px-1 py-1 text-center">
                              <div
                                className={`rounded-md px-1 py-1.5 text-xs font-semibold ${heat(r.rate)}`}
                                title={
                                  r.rate === null
                                    ? "이 반에는 부여되지 않음"
                                    : `${r.done} / ${r.total}명 완료`
                                }
                              >
                                {r.rate === null ? "–" : Math.round(r.rate * 100) + "%"}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-zinc-400">
              칸을 가리키면 완료 인원이 보입니다. 활동명을 누르면 제출 현황으로 이동합니다.
              &lsquo;–&rsquo; 는 그 반에 부여되지 않은 활동입니다.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
