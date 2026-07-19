"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ExportStudent = {
  id: string;
  grade: number;
  class_no: number;
  student_no: number;
  name: string;
};
export type ExportUnit = { id: string; title: string; grade: number };
export type ExportActivity = {
  id: string;
  unit_id: string;
  title: string;
  type: string;
  order_index: number;
};

type ProgressRow = {
  student_id: string;
  activity_id: string;
  completed: boolean;
  score: number | null;
  submission: { answer?: string } | null;
  response_text: string | null;
  updated_at: string;
};

const TYPE_LABELS: Record<string, string> = {
  geogebra: "GeoGebra",
  content: "자료",
  problem: "문제",
  image: "사진",
  html: "체험",
};

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function studentId(s: ExportStudent): string {
  return `${s.grade}${String(s.class_no).padStart(2, "0")}${String(
    s.student_no
  ).padStart(2, "0")}`;
}

export default function ExportBuilder({
  students,
  units,
  activities,
}: {
  students: ExportStudent[];
  units: ExportUnit[];
  activities: ExportActivity[];
}) {
  const [selStudents, setSelStudents] = useState<Set<string>>(new Set());
  const [selActivities, setSelActivities] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 반(학년-반) 단위 그룹
  const classGroups = new Map<string, ExportStudent[]>();
  for (const s of students) {
    const key = `${s.grade}학년 ${s.class_no}반`;
    if (!classGroups.has(key)) classGroups.set(key, []);
    classGroups.get(key)!.push(s);
  }

  function toggleSet<T>(set: Set<T>, item: T, on: boolean): Set<T> {
    const next = new Set(set);
    if (on) next.add(item);
    else next.delete(item);
    return next;
  }

  function toggleMany(
    set: Set<string>,
    ids: string[],
    on: boolean
  ): Set<string> {
    const next = new Set(set);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    return next;
  }

  async function downloadCsv() {
    setBusy(true);
    setError(null);

    const studentIds = [...selStudents];
    const activityIds = [...selActivities];
    const supabase = createClient();
    const { data, error } = await supabase
      .from("progress")
      .select(
        "student_id, activity_id, completed, score, submission, response_text, updated_at"
      )
      .in("student_id", studentIds)
      .in("activity_id", activityIds);

    if (error) {
      setError("기록 조회에 실패했습니다.");
      setBusy(false);
      return;
    }

    const progressMap = new Map(
      ((data as ProgressRow[]) ?? []).map((p) => [
        `${p.student_id}|${p.activity_id}`,
        p,
      ])
    );
    const unitMap = new Map(units.map((u) => [u.id, u]));
    const pickedStudents = students.filter((s) => selStudents.has(s.id));
    const pickedActivities = activities.filter((a) => selActivities.has(a.id));

    const header = [
      "학번", "이름", "단원", "활동", "유형",
      "완료", "점수", "정답 제출", "작성글", "수정시각",
    ];
    const lines: string[] = [];
    for (const s of pickedStudents) {
      for (const a of pickedActivities) {
        const p = progressMap.get(`${s.id}|${a.id}`);
        lines.push(
          [
            studentId(s),
            s.name,
            unitMap.get(a.unit_id)?.title ?? "",
            a.title,
            TYPE_LABELS[a.type] ?? a.type,
            p?.completed ? "완료" : "미완료",
            p?.score == null ? "" : String(p.score),
            p?.submission?.answer ?? "",
            p?.response_text ?? "",
            p?.updated_at ? new Date(p.updated_at).toLocaleString("ko-KR") : "",
          ]
            .map(csvEscape)
            .join(",")
        );
      }
    }

    const blob = new Blob(["\uFEFF" + [header.join(","), ...lines].join("\n")], {
      type: "text/csv",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `활동기록_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900">기록 다운로드</h2>
        <button
          onClick={downloadCsv}
          disabled={busy || selStudents.size === 0 || selActivities.size === 0}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy
            ? "생성 중..."
            : `CSV 다운로드 (학생 ${selStudents.size} × 활동 ${selActivities.size})`}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 학생 선택 */}
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-zinc-900">① 학생 선택</h3>
            <div className="flex gap-2 text-xs">
              <button
                onClick={() =>
                  setSelStudents(new Set(students.map((s) => s.id)))
                }
                className="text-blue-600 hover:underline"
              >
                전체 선택
              </button>
              <button
                onClick={() => setSelStudents(new Set())}
                className="text-zinc-500 hover:underline"
              >
                해제
              </button>
            </div>
          </div>

          {[...classGroups.entries()].map(([label, group]) => {
            const allChecked = group.every((s) => selStudents.has(s.id));
            return (
              <div key={label} className="mb-3">
                <label className="flex items-center gap-2 font-medium text-zinc-800">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e) =>
                      setSelStudents(
                        toggleMany(
                          selStudents,
                          group.map((s) => s.id),
                          e.target.checked
                        )
                      )
                    }
                  />
                  {label}
                  <span className="text-xs font-normal text-zinc-400">
                    ({group.length}명)
                  </span>
                </label>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 pl-6 text-sm text-zinc-600">
                  {group.map((s) => (
                    <label key={s.id} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={selStudents.has(s.id)}
                        onChange={(e) =>
                          setSelStudents(
                            toggleSet(selStudents, s.id, e.target.checked)
                          )
                        }
                      />
                      {s.student_no}번 {s.name}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
          {students.length === 0 && (
            <p className="text-sm text-zinc-500">등록된 학생이 없습니다.</p>
          )}
        </section>

        {/* 활동 선택 */}
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-zinc-900">② 활동 선택</h3>
            <div className="flex gap-2 text-xs">
              <button
                onClick={() =>
                  setSelActivities(new Set(activities.map((a) => a.id)))
                }
                className="text-blue-600 hover:underline"
              >
                전체 선택
              </button>
              <button
                onClick={() => setSelActivities(new Set())}
                className="text-zinc-500 hover:underline"
              >
                해제
              </button>
            </div>
          </div>

          {units.map((u) => {
            const acts = activities.filter((a) => a.unit_id === u.id);
            if (acts.length === 0) return null;
            const allChecked = acts.every((a) => selActivities.has(a.id));
            return (
              <div key={u.id} className="mb-3">
                <label className="flex items-center gap-2 font-medium text-zinc-800">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e) =>
                      setSelActivities(
                        toggleMany(
                          selActivities,
                          acts.map((a) => a.id),
                          e.target.checked
                        )
                      )
                    }
                  />
                  {u.grade}학년 · {u.title}
                </label>
                <div className="mt-1 flex flex-col gap-1 pl-6 text-sm text-zinc-600">
                  {acts.map((a) => (
                    <label key={a.id} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={selActivities.has(a.id)}
                        onChange={(e) =>
                          setSelActivities(
                            toggleSet(selActivities, a.id, e.target.checked)
                          )
                        }
                      />
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
                        {TYPE_LABELS[a.type] ?? a.type}
                      </span>
                      {a.title}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
          {activities.length === 0 && (
            <p className="text-sm text-zinc-500">등록된 활동이 없습니다.</p>
          )}
        </section>
      </div>
    </div>
  );
}
