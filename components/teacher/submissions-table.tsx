"use client";

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
}: {
  unitId: string;
  unitTitle: string;
  activityTitle: string;
  rows: SubmissionRow[];
}) {
  const doneCount = rows.filter((r) => r.completed).length;

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
    </div>
  );
}
