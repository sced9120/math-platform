"use client";

import { useState } from "react";
import Link from "next/link";

export type SubmissionRow = {
  studentId: string;
  name: string;
  completed: boolean;
  score: number | null;
  answer: string;
  responseText: string;
  updatedAt: string;
};

// CSV 필드 이스케이프 (쉼표/따옴표/줄바꿈 안전)
function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export default function SubmissionsTable({
  unitId,
  unitTitle,
  activityTitle,
  rows,
  responsePrompt,
}: {
  unitId: string;
  unitTitle: string;
  activityTitle: string;
  rows: SubmissionRow[];
  responsePrompt?: string;
}) {
  const doneCount = rows.filter((r) => r.completed).length;
  // 표 보기 / 서술 읽기(카드) 전환
  const [view, setView] = useState<"table" | "cards">("table");
  const [onlyWritten, setOnlyWritten] = useState(true);

  const written = rows.filter((r) => r.responseText.trim().length > 0);
  const cardRows = onlyWritten ? written : rows;

  function downloadCsv() {
    const header = ["학번", "이름", "완료", "점수", "정답 제출", "작성글", "수정시각"];
    const lines = rows.map((r) =>
      [
        r.studentId,
        r.name,
        r.completed ? "완료" : "미완료",
        r.score === null ? "" : String(r.score),
        r.answer,
        r.responseText,
        r.updatedAt ? new Date(r.updatedAt).toLocaleString("ko-KR") : "",
      ]
        .map(csvEscape)
        .join(",")
    );
    // BOM — Excel에서 한글이 깨지지 않게
    const blob = new Blob(["\uFEFF" + [header.join(","), ...lines].join("\n")], {
      type: "text/csv",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${activityTitle}_제출현황.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          href={`/teacher/units/${unitId}`}
          className="text-sm text-blue-600 hover:underline"
        >
          ← {unitTitle} 활동 관리
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">
            {activityTitle} — 제출 현황
            <span className="ml-2 text-sm font-normal text-zinc-500">
              완료 {doneCount} / {rows.length}명
            </span>
          </h2>
          <button
            onClick={downloadCsv}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            CSV 다운로드
          </button>
        </div>
      </div>

      {/* 보기 전환 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-zinc-300">
          <button
            onClick={() => setView("table")}
            className={`px-3 py-1.5 text-sm font-medium ${
              view === "table" ? "bg-blue-600 text-white" : "bg-white text-zinc-700"
            }`}
          >
            표 보기
          </button>
          <button
            onClick={() => setView("cards")}
            className={`px-3 py-1.5 text-sm font-medium ${
              view === "cards" ? "bg-blue-600 text-white" : "bg-white text-zinc-700"
            }`}
          >
            서술 읽기
          </button>
        </div>
        <span className="text-sm text-zinc-500">
          서술 작성 {written.length} / {rows.length}명
        </span>
        {view === "cards" && (
          <label className="ml-auto flex items-center gap-2 text-sm text-zinc-600">
            <input
              type="checkbox"
              checked={onlyWritten}
              onChange={(e) => setOnlyWritten(e.target.checked)}
            />
            작성한 학생만 보기
          </label>
        )}
      </div>

      {view === "cards" ? (
        <div className="flex flex-col gap-3">
          {responsePrompt && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              <b>✏️ 서술 문항</b>
              <p className="mt-1 whitespace-pre-wrap">{responsePrompt}</p>
            </div>
          )}
          {cardRows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
              아직 작성한 학생이 없습니다.
            </p>
          ) : (
            cardRows.map((r) => (
              <div
                key={r.studentId}
                className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono text-zinc-500">{r.studentId}</span>
                  <span className="font-semibold text-zinc-900">{r.name}</span>
                  {r.completed ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                      완료
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                      미완료
                    </span>
                  )}
                  {r.updatedAt && (
                    <span className="ml-auto text-xs text-zinc-400">
                      {new Date(r.updatedAt).toLocaleString("ko-KR", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
                {r.responseText.trim() ? (
                  <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-800">
                    {r.responseText}
                  </p>
                ) : (
                  <p className="text-sm text-zinc-400">— 미작성 —</p>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-500">해당 학년 학생이 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500">
                <th className="py-2 pr-3">학번</th>
                <th className="py-2 pr-3">이름</th>
                <th className="py-2 pr-3">완료</th>
                <th className="py-2 pr-3">점수</th>
                <th className="py-2 pr-3">정답 제출</th>
                <th className="py-2 pr-3">작성글</th>
                <th className="py-2">수정시각</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.studentId} className="border-b border-zinc-100 align-top">
                  <td className="py-2 pr-3 font-mono">{r.studentId}</td>
                  <td className="py-2 pr-3">{r.name}</td>
                  <td className="py-2 pr-3">
                    {r.completed ? (
                      <span className="text-green-600">완료</span>
                    ) : (
                      <span className="text-zinc-400">미완료</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">{r.score ?? "-"}</td>
                  <td className="py-2 pr-3">{r.answer || "-"}</td>
                  <td className="max-w-md whitespace-pre-wrap py-2 pr-3">
                    {r.responseText || "-"}
                  </td>
                  <td className="py-2 text-zinc-500">
                    {r.updatedAt
                      ? new Date(r.updatedAt).toLocaleString("ko-KR", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      )}
    </div>
  );
}
