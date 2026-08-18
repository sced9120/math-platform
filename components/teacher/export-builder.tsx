"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  compareScreenKeys,
  screensToCell,
  type ScreenAnswer,
} from "@/lib/responses";

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

type ScreenRow = {
  student_id: string;
  activity_id: string;
  screen_key: string;
  prompt: string;
  text: string;
  images: string[] | null;
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
    const [{ data, error }, { data: screenData, error: screenError }] =
      await Promise.all([
        supabase
          .from("progress")
          .select(
            "student_id, activity_id, completed, score, submission, response_text, updated_at"
          )
          .in("student_id", studentIds)
          .in("activity_id", activityIds),
        supabase
          .from("screen_responses")
          .select("student_id, activity_id, screen_key, prompt, text, images")
          .in("student_id", studentIds)
          .in("activity_id", activityIds),
      ]);

    if (error || screenError) {
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

    // 화면별 기록을 (학생|활동) 으로 모아 화면 순서대로 정렬해 둔다
    const screenMap = new Map<string, ScreenAnswer[]>();
    for (const r of (screenData as ScreenRow[]) ?? []) {
      const k = `${r.student_id}|${r.activity_id}`;
      const list = screenMap.get(k) ?? [];
      list.push({
        key: r.screen_key,
        prompt: r.prompt ?? "",
        text: r.text ?? "",
        images: r.images ?? [],
      });
      screenMap.set(k, list);
    }
    for (const list of screenMap.values()) {
      list.sort((a, b) => compareScreenKeys(a.key, b.key));
    }
    const pickedStudents = students.filter((s) => selStudents.has(s.id));

    // 활동 열 순서: 단원 순서 → 활동 순서. 열머리는 "단원번호-활동번호 활동명"
    const unitOrder = new Map(units.map((u, i) => [u.id, i]));
    const pickedActivities = activities
      .filter((a) => selActivities.has(a.id))
      .sort(
        (a, b) =>
          (unitOrder.get(a.unit_id) ?? 0) - (unitOrder.get(b.unit_id) ?? 0) ||
          a.order_index - b.order_index
      );
    const actLabel = (a: ExportActivity) => {
      const uIdx = (unitOrder.get(a.unit_id) ?? 0) + 1;
      const inUnit = pickedActivities.filter((x) => x.unit_id === a.unit_id);
      const aIdx = inUnit.indexOf(a) + 1;
      return `활동${uIdx}-${aIdx} ${a.title}`;
    };

    // 활동 셀 내용: 정답 제출 + 화면별 기록을 하나의 칸에 담는다.
    // 사진으로 낸 칸은 글 대신 "첨부파일 참고" 가 들어간다(screensToCell).
    const cellValue = (p?: ProgressRow, screens?: ScreenAnswer[]): string => {
      const parts: string[] = [];
      if (p?.submission?.answer) {
        parts.push(
          `답: ${p.submission.answer}${p.score != null ? ` (${p.score}점)` : ""}`
        );
      }
      const screenText = screens ? screensToCell(screens) : "";
      if (screenText) parts.push(screenText);
      // 화면별 기록 이전에 쓴 옛 작성글도 함께 내보낸다
      if (p?.response_text) parts.push(p.response_text);
      if (parts.length === 0) {
        if (!p) return "";
        return p.completed ? "완료" : "미완료";
      }
      return parts.join("\n");
    };

    // 한 학생 = 한 행 (반 / 번호 / 이름 / 활동1-1 / 활동1-2 / ...)
    const header = ["반", "번호", "이름", ...pickedActivities.map(actLabel)];
    const lines = pickedStudents
      .sort(
        (a, b) =>
          a.grade - b.grade || a.class_no - b.class_no || a.student_no - b.student_no
      )
      .map((s) =>
        [
          `${s.grade}학년 ${s.class_no}반`,
          String(s.student_no),
          s.name,
          ...pickedActivities.map((a) =>
            cellValue(
              progressMap.get(`${s.id}|${a.id}`),
              screenMap.get(`${s.id}|${a.id}`)
            )
          ),
        ]
          .map(csvEscape)
          .join(",")
      );

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
      <p className="-mt-4 text-sm text-zinc-500">
        학생이 사진으로 낸 칸에는 <b>첨부파일 참고</b> 라고 적힙니다. 사진 자체는
        활동별 <b>제출 현황</b> 화면에서 보고 내려받을 수 있어요.
      </p>
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
