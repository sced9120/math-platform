"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toStudentId, type StudentRow } from "@/lib/types";

type CreateResult = {
  studentId: string;
  name: string;
  password?: string;
  ok: boolean;
  error?: string;
};

type StudentProfile = StudentRow & {
  id: string;
  must_change_password: boolean;
};

// 붙여넣은 명단 파싱: 줄마다 "학년,반,번호,이름" (쉼표/탭/공백 구분 모두 허용)
function parseRoster(text: string): { rows: StudentRow[]; errors: string[] } {
  const rows: StudentRow[] = [];
  const errors: string[] = [];

  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line, i) => {
      const parts = line.split(/[\t,]+|\s{2,}/).map((p) => p.trim()).filter(Boolean);
      // 헤더 행(예: 학년,반,번호,이름)은 건너뛴다
      if (i === 0 && parts.some((p) => isNaN(Number(p)) && p.length <= 2)) {
        if (parts.every((p) => isNaN(Number(p)))) return;
      }
      if (parts.length < 4) {
        errors.push(`${i + 1}행: 항목이 부족합니다 (${line})`);
        return;
      }
      const [grade, class_no, student_no] = parts.slice(0, 3).map(Number);
      const name = parts.slice(3).join(" ");
      if (!grade || !class_no || !student_no || !name) {
        errors.push(`${i + 1}행: 형식 오류 (${line})`);
        return;
      }
      rows.push({ grade, class_no, student_no, name });
    });

  return { rows, errors };
}

export default function StudentsManager({
  initialStudents,
}: {
  initialStudents: StudentProfile[];
}) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<StudentRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [results, setResults] = useState<CreateResult[] | null>(null);
  const [students, setStudents] = useState<StudentProfile[]>(initialStudents);
  const [message, setMessage] = useState<string | null>(null);

  const loadStudents = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, grade, class_no, student_no, name, must_change_password")
      .eq("role", "student")
      .order("grade")
      .order("class_no")
      .order("student_no");
    setStudents((data as StudentProfile[]) ?? []);
  }, []);

  function handleParse(value: string) {
    setText(value);
    const { rows, errors } = parseRoster(value);
    setParsed(rows);
    setParseErrors(errors);
  }

  async function handleFile(file: File) {
    handleParse(await file.text());
  }

  async function handleCreate() {
    setCreating(true);
    setMessage(null);
    setResults(null);

    const res = await fetch("/api/teacher/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ students: parsed }),
    });
    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error ?? "생성에 실패했습니다.");
    } else {
      setResults(data.results);
      setText("");
      setParsed([]);
      await loadStudents();
    }
    setCreating(false);
  }

  function downloadResultsCsv() {
    if (!results) return;
    const header = "학번,이름,초기비밀번호,결과\n";
    const body = results
      .map((r) =>
        [r.studentId, r.name, r.password ?? "", r.ok ? "생성됨" : r.error].join(",")
      )
      .join("\n");
    // BOM을 붙여 Excel에서 한글이 깨지지 않게 한다
    const blob = new Blob(["\uFEFF" + header + body], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "학생계정_초기비밀번호.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function handleDelete(s: StudentProfile) {
    if (!confirm(`${toStudentId(s)} ${s.name} 계정을 삭제할까요?\n진행기록도 함께 삭제됩니다.`)) return;
    const res = await fetch("/api/teacher/students", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: s.id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "삭제에 실패했습니다.");
      return;
    }
    await loadStudents();
  }

  return (
    <div className="flex flex-col gap-8">
      {/* 일괄 생성 */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm print:hidden">
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">학생 계정 일괄 생성</h2>
        <p className="mb-4 text-sm text-zinc-500">
          한 줄에 한 명씩 <b>학년, 반, 번호, 이름</b> 순서로 입력하세요. 엑셀에서 4개
          열을 복사해 붙여넣거나 CSV 파일을 올려도 됩니다.
        </p>

        <textarea
          value={text}
          onChange={(e) => handleParse(e.target.value)}
          rows={6}
          placeholder={"예)\n1,3,15,김하늘\n1,3,16,이준서"}
          className="w-full rounded-md border border-zinc-300 p-3 font-mono text-sm focus:border-blue-500 focus:outline-none"
        />

        <div className="mt-2 flex items-center gap-4">
          <label className="cursor-pointer text-sm text-blue-600 hover:underline">
            CSV 파일 업로드
            <input
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
          {parsed.length > 0 && (
            <span className="text-sm text-zinc-600">{parsed.length}명 인식됨</span>
          )}
        </div>

        {parseErrors.length > 0 && (
          <ul className="mt-2 text-sm text-red-600">
            {parseErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}

        {parsed.length > 0 && (
          <div className="mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500">
                  <th className="py-1 pr-4">학번</th>
                  <th className="py-1 pr-4">학년</th>
                  <th className="py-1 pr-4">반</th>
                  <th className="py-1 pr-4">번호</th>
                  <th className="py-1">이름</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((s, i) => (
                  <tr key={i} className="border-b border-zinc-100">
                    <td className="py-1 pr-4 font-mono">{toStudentId(s)}</td>
                    <td className="py-1 pr-4">{s.grade}</td>
                    <td className="py-1 pr-4">{s.class_no}</td>
                    <td className="py-1 pr-4">{s.student_no}</td>
                    <td className="py-1">{s.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? "생성 중..." : `${parsed.length}명 계정 생성`}
            </button>
          </div>
        )}

        {message && <p className="mt-3 text-sm text-red-600">{message}</p>}
      </section>

      {/* 생성 결과 — 초기비밀번호는 이 화면에서만 확인 가능 */}
      {results && (
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="mb-1 text-lg font-semibold text-zinc-900">생성 결과</h2>
          <p className="mb-4 text-sm text-red-600">
            ⚠️ 초기비밀번호는 지금만 확인할 수 있습니다. 반드시 다운로드하거나 인쇄해
            두세요.
          </p>
          <table className="w-full bg-white text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500">
                <th className="p-2">학번</th>
                <th className="p-2">이름</th>
                <th className="p-2">초기비밀번호</th>
                <th className="p-2">결과</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className="border-b border-zinc-100">
                  <td className="p-2 font-mono">{r.studentId}</td>
                  <td className="p-2">{r.name}</td>
                  <td className="p-2 font-mono">{r.password ?? "-"}</td>
                  <td className={`p-2 ${r.ok ? "text-green-600" : "text-red-600"}`}>
                    {r.ok ? "생성됨" : r.error}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex gap-3 print:hidden">
            <button
              onClick={downloadResultsCsv}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              CSV 다운로드
            </button>
            <button
              onClick={() => window.print()}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              인쇄
            </button>
          </div>
        </section>
      )}

      {/* 전체 학생 목록 */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm print:hidden">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">
          전체 학생 ({students.length}명)
        </h2>
        {students.length === 0 ? (
          <p className="text-sm text-zinc-500">아직 학생 계정이 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500">
                <th className="py-1 pr-4">학번</th>
                <th className="py-1 pr-4">이름</th>
                <th className="py-1 pr-4">비밀번호 변경</th>
                <th className="py-1"></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b border-zinc-100">
                  <td className="py-1.5 pr-4 font-mono">{toStudentId(s)}</td>
                  <td className="py-1.5 pr-4">{s.name}</td>
                  <td className="py-1.5 pr-4">
                    {s.must_change_password ? (
                      <span className="text-amber-600">초기비번 상태</span>
                    ) : (
                      <span className="text-green-600">변경 완료</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right">
                    <button
                      onClick={() => handleDelete(s)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
