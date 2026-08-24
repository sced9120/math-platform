"use client";

import { useCallback, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toStudentId, defaultPassword, type StudentRow } from "@/lib/types";

type CreateResult = {
  studentId: string;
  name: string;
  password?: string;
  ok: boolean;
  error?: string;
};

export type StudentProfile = StudentRow & {
  id: string;
  must_change_password: boolean;
  teacher_id?: string | null; // 이 계정을 만든 사람 — 담당과 다르다 (계정 삭제 권한의 근거)
};

// 이 서버에 등록된 전체 학생 (all_students RPC).
// is_mine 이 참이면 이미 내 목록에 담겨 있다.
export type RosterStudent = StudentRow & { id: string; is_mine: boolean };

type RosterRow = StudentRow & { password?: string };

// 학년·반으로 묶어서 보여 준다 (목록이 길어져도 찾기 쉽게).
// 넘어오는 목록은 이미 학년·반·번호 순으로 정렬돼 있다.
function groupByClass<T extends StudentRow>(list: T[]) {
  const map = new Map<
    string,
    { key: string; grade: number; classNo: number; list: T[] }
  >();
  for (const s of list) {
    const key = `${s.grade}-${s.class_no}`;
    if (!map.has(key)) map.set(key, { key, grade: s.grade, classNo: s.class_no, list: [] });
    map.get(key)!.list.push(s);
  }
  return [...map.values()].sort((a, b) => a.grade - b.grade || a.classNo - b.classNo);
}

// 붙여넣은 명단 파싱: 줄마다 "학년,반,번호,이름[,비밀번호]" (쉼표/탭/공백 구분 모두 허용)
// 비밀번호 열이 비어 있으면 학번이 초기비밀번호가 된다.
function parseRoster(text: string): { rows: RosterRow[]; errors: string[] } {
  const rows: RosterRow[] = [];
  const errors: string[] = [];

  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line, i) => {
      const parts = line.split(/[\t,]+|\s{2,}/).map((p) => p.trim()).filter(Boolean);
      // 헤더 행(예: 학년,반,번호,이름,비밀번호)은 건너뛴다
      if (i === 0 && parts.some((p) => isNaN(Number(p)) && p.length <= 4)) {
        if (parts.every((p) => isNaN(Number(p)))) return;
      }
      if (parts.length < 4) {
        errors.push(`${i + 1}행: 항목이 부족합니다 (${line})`);
        return;
      }
      const [grade, class_no, student_no] = parts.slice(0, 3).map(Number);
      const name = parts[3];
      const password = parts[4]; // 없으면 undefined → 학번 사용
      if (!grade || !class_no || !student_no || !name) {
        errors.push(`${i + 1}행: 형식 오류 (${line})`);
        return;
      }
      rows.push({ grade, class_no, student_no, name, password });
    });

  return { rows, errors };
}

export default function StudentsManager({
  meId,
  initialStudents,
  roster: initialRoster = [],
  rosterReady = true,
  isAdmin = false,
  teacherNames = {},
  studentTeachers = {},
}: {
  meId: string;
  initialStudents: StudentProfile[];
  roster?: RosterStudent[];
  rosterReady?: boolean;
  isAdmin?: boolean;
  teacherNames?: Record<string, string>;
  studentTeachers?: Record<string, string[]>;
}) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<RosterRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [results, setResults] = useState<CreateResult[] | null>(null);
  const [students, setStudents] = useState<StudentProfile[]>(initialStudents);
  const [message, setMessage] = useState<string | null>(null);

  // 전체 명단에서 골라 담기
  const [roster, setRoster] = useState<RosterStudent[]>(initialRoster);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [filterGrade, setFilterGrade] = useState(""); // "" = 전체
  const [filterClass, setFilterClass] = useState("");
  const [query, setQuery] = useState("");
  const [showMine, setShowMine] = useState(false);
  const [adding, setAdding] = useState(false);
  const [rosterMessage, setRosterMessage] = useState<string | null>(null);

  const classGroups = useMemo(() => groupByClass(students), [students]);

  const loadStudents = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, grade, class_no, student_no, name, must_change_password, teacher_id")
      .eq("role", "student")
      .order("grade")
      .order("class_no")
      .order("student_no");
    setStudents((data as StudentProfile[]) ?? []);
  }, []);

  const loadRoster = useCallback(async () => {
    const { data } = await createClient().rpc("all_students");
    setRoster((data as RosterStudent[]) ?? []);
  }, []);

  // 담기·빼기 뒤에는 두 목록이 함께 움직여야 한다 (담음 표시가 어긋나지 않게)
  const reloadAll = useCallback(async () => {
    await Promise.all([loadStudents(), loadRoster()]);
  }, [loadStudents, loadRoster]);

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
      await reloadAll();
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

  // 비밀번호 분실 대응: 새 비밀번호 입력(비우면 학번으로 초기화)
  async function handleResetPassword(s: StudentProfile) {
    const input = prompt(
      `${toStudentId(s)} ${s.name} 학생의 새 비밀번호를 입력하세요. (6자 이상)\n` +
        `비워 두고 확인을 누르면 학번 기반(${defaultPassword(toStudentId(s))})으로 초기화됩니다.`
    );
    if (input === null) return; // 취소
    const res = await fetch("/api/teacher/students", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: s.id, password: input.trim() }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      alert(data?.error ?? "재설정에 실패했습니다.");
      return;
    }
    alert(
      `비밀번호를 재설정했습니다.\n새 비밀번호: ${data.password}\n` +
        `학생이 로그인하면 비밀번호 변경이 다시 요구됩니다.`
    );
    await loadStudents();
  }

  // 내 목록에서만 뺀다 — 계정도 기록도 그대로 남는다.
  async function handleRemoveFromMine(s: StudentProfile) {
    const ok = confirm(
      `${toStudentId(s)} ${s.name} 학생을 내 목록에서 뺄까요?\n` +
        `계정과 활동 기록은 그대로 남고, 언제든 다시 담을 수 있습니다.`
    );
    if (!ok) return;
    const { error } = await createClient()
      .from("teacher_students")
      .delete()
      .eq("teacher_id", meId)
      .eq("student_id", s.id);
    if (error) {
      alert("빼기에 실패했습니다.");
      return;
    }
    await reloadAll();
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
    await reloadAll();
  }

  // ── 전체 명단에서 고르기 ──────────────────────────────────────────────────
  const gradeOptions = useMemo(
    () => [...new Set(roster.map((s) => s.grade))].sort((a, b) => a - b),
    [roster]
  );
  const classOptions = useMemo(
    () =>
      [
        ...new Set(
          roster
            .filter((s) => !filterGrade || String(s.grade) === filterGrade)
            .map((s) => s.class_no)
        ),
      ].sort((a, b) => a - b),
    [roster, filterGrade]
  );

  const candidates = useMemo(() => {
    const q = query.trim();
    return roster.filter((s) => {
      if (!showMine && s.is_mine) return false;
      if (filterGrade && String(s.grade) !== filterGrade) return false;
      if (filterClass && String(s.class_no) !== filterClass) return false;
      if (q && !s.name.includes(q) && !toStudentId(s).includes(q)) return false;
      return true;
    });
  }, [roster, showMine, filterGrade, filterClass, query]);

  const rosterGroups = useMemo(() => groupByClass(candidates), [candidates]);
  const notMineCount = useMemo(() => roster.filter((s) => !s.is_mine).length, [roster]);

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // 반 단위로 한 번에 (이미 담은 학생은 건드리지 않는다)
  function toggleClass(list: RosterStudent[]) {
    const addable = list.filter((s) => !s.is_mine).map((s) => s.id);
    if (addable.length === 0) return;
    const allPicked = addable.every((id) => picked.has(id));
    setPicked((prev) => {
      const next = new Set(prev);
      for (const id of addable) {
        if (allPicked) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  async function handleAddPicked() {
    if (picked.size === 0) return;
    setAdding(true);
    setRosterMessage(null);
    const count = picked.size;
    const rows = [...picked].map((student_id) => ({ teacher_id: meId, student_id }));
    const { error } = await createClient()
      .from("teacher_students")
      .upsert(rows, { onConflict: "teacher_id,student_id", ignoreDuplicates: true });
    if (error) {
      setRosterMessage("담기에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } else {
      setRosterMessage(`${count}명을 내 목록에 담았습니다.`);
      setPicked(new Set());
      await reloadAll();
    }
    setAdding(false);
  }

  const controlCls =
    "rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none";

  return (
    <div className="flex flex-col gap-8">
      {/* 0016 을 아직 안 돌렸으면 담당 표가 없다 — 화면이 죽는 대신 무엇을 하면 되는지 알린다 */}
      {!rosterReady && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 print:hidden">
          <b>담당 표(0016)가 아직 적용되지 않았습니다.</b> Supabase SQL Editor 에서{" "}
          <code className="rounded bg-white px-1 py-0.5 font-mono text-xs">
            supabase/migrations/0016_teacher_students.sql
          </code>{" "}
          을 실행하면 전체 학생 명단에서 담당 학생을 골라 담을 수 있습니다.
          {isAdmin && " 그전까지 아래 '담당 교사' 열은 비어 보입니다."}
        </div>
      )}

      {/* 일괄 생성 */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm print:hidden">
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">학생 계정 일괄 생성</h2>
        <p className="mb-4 text-sm text-zinc-500">
          한 줄에 한 명씩 <b>학년, 반, 번호, 이름, 비밀번호</b> 순서로 입력하세요.
          비밀번호를 비우면 <b>학번 앞에 s를 붙인 값</b>(예: 10101 → s10101)이
          초기비밀번호가 됩니다. 직접 지정할 땐 6자 이상. 엑셀에서 열을 복사해
          붙여넣거나 CSV 파일을 올려도 됩니다.
        </p>
        {!isAdmin && (
          <p className="mb-4 text-sm text-zinc-500">
            이미 이 서버에 있는 학생이라면 여기서 다시 만들지 말고, 아래{" "}
            <b>전체 학생에서 담아 오기</b>에서 골라 담으세요.
          </p>
        )}

        <textarea
          value={text}
          onChange={(e) => handleParse(e.target.value)}
          rows={6}
          placeholder={"예)\n1,3,15,김하늘,star1234\n1,3,16,이준서"}
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
                  <th className="py-1 pr-4">이름</th>
                  <th className="py-1">초기비밀번호</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((s, i) => (
                  <tr key={i} className="border-b border-zinc-100">
                    <td className="py-1 pr-4 font-mono">{toStudentId(s)}</td>
                    <td className="py-1 pr-4">{s.grade}</td>
                    <td className="py-1 pr-4">{s.class_no}</td>
                    <td className="py-1 pr-4">{s.student_no}</td>
                    <td className="py-1 pr-4">{s.name}</td>
                    <td className="py-1 font-mono">
                      {s.password || (
                        <span className="text-zinc-400">
                          {defaultPassword(toStudentId(s))} (학번 기반)
                        </span>
                      )}
                    </td>
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

      {/* 전체 명단에서 담아 오기 — 관리자는 이미 전체가 보이므로 필요 없다 */}
      {!isAdmin && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm print:hidden">
          <h2 className="mb-1 text-lg font-semibold text-zinc-900">
            전체 학생에서 담아 오기{" "}
            <span className="text-sm font-normal text-zinc-400">
              (아직 담지 않은 학생 {notMineCount}명)
            </span>
          </h2>
          <p className="mb-4 text-sm text-zinc-500">
            이 서버에 등록된 학생 전부입니다. 관리자나 다른 선생님이 만든 학생도
            여기서 골라 내 목록에 담을 수 있습니다. 한 학생을 여러 선생님이 함께
            담아도 됩니다.
          </p>

          {!rosterReady ? (
            <p className="text-sm text-red-600">
              전체 명단을 불러오지 못했습니다. Supabase SQL Editor 에서{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">
                supabase/migrations/0016_teacher_students.sql
              </code>{" "}
              을 실행했는지 확인하세요.
            </p>
          ) : roster.length === 0 ? (
            <p className="text-sm text-zinc-500">
              이 서버에 등록된 학생이 아직 없습니다. 위에서 명단을 붙여넣어 만드세요.
            </p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <select
                  value={filterGrade}
                  onChange={(e) => {
                    setFilterGrade(e.target.value);
                    setFilterClass("");
                  }}
                  className={controlCls}
                >
                  <option value="">학년 전체</option>
                  {gradeOptions.map((g) => (
                    <option key={g} value={String(g)}>
                      {g}학년
                    </option>
                  ))}
                </select>
                <select
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  className={controlCls}
                >
                  <option value="">반 전체</option>
                  {classOptions.map((c) => (
                    <option key={c} value={String(c)}>
                      {c}반
                    </option>
                  ))}
                </select>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="이름 또는 학번"
                  className={controlCls}
                />
                <label className="flex items-center gap-1.5 text-sm text-zinc-600">
                  <input
                    type="checkbox"
                    checked={showMine}
                    onChange={(e) => setShowMine(e.target.checked)}
                  />
                  이미 담은 학생도 보기
                </label>
              </div>

              {rosterGroups.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  조건에 맞는 학생이 없습니다.
                  {!showMine && " (이미 담은 학생은 숨겨져 있습니다)"}
                </p>
              ) : (
                <div className="flex max-h-[28rem] flex-col gap-5 overflow-y-auto pr-1">
                  {rosterGroups.map((g) => (
                    <div key={g.key}>
                      <h3 className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-zinc-700">
                        <span className="h-3.5 w-1 rounded-full bg-emerald-500" />
                        {g.grade}학년 {g.classNo}반
                        <span className="font-normal text-zinc-400">
                          {g.list.length}명
                        </span>
                        <button
                          onClick={() => toggleClass(g.list)}
                          className="text-xs font-normal text-blue-600 hover:underline"
                        >
                          이 반 전체 선택
                        </button>
                      </h3>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 md:grid-cols-4">
                        {g.list.map((s) =>
                          s.is_mine ? (
                            <span
                              key={s.id}
                              className="flex items-center gap-2 py-0.5 text-sm text-zinc-400"
                              title="이미 내 목록에 있습니다"
                            >
                              <span className="font-mono text-xs">{toStudentId(s)}</span>
                              {s.name}
                              <span className="text-xs">· 담음</span>
                            </span>
                          ) : (
                            <label
                              key={s.id}
                              className="flex cursor-pointer items-center gap-2 py-0.5 text-sm text-zinc-700"
                            >
                              <input
                                type="checkbox"
                                checked={picked.has(s.id)}
                                onChange={() => togglePick(s.id)}
                              />
                              <span className="font-mono text-xs text-zinc-500">
                                {toStudentId(s)}
                              </span>
                              {s.name}
                            </label>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  onClick={handleAddPicked}
                  disabled={adding || picked.size === 0}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {adding ? "담는 중..." : `선택한 ${picked.size}명 내 목록에 담기`}
                </button>
                {picked.size > 0 && (
                  <button
                    onClick={() => setPicked(new Set())}
                    className="text-sm text-zinc-500 hover:underline"
                  >
                    선택 해제
                  </button>
                )}
                {rosterMessage && (
                  <span className="text-sm text-zinc-600">{rosterMessage}</span>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {/* 학생 목록 — 학년·반으로 묶어서 */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm print:hidden">
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">
          {isAdmin ? "전체 학생" : "내 학생"} ({students.length}명)
        </h2>
        <p className="mb-4 text-sm text-zinc-500">
          {isAdmin
            ? "관리자는 모든 교사의 학생을 볼 수 있습니다."
            : "내 목록에 담은 학생입니다. 진도 현황·기록 다운로드도 이 학생들만 보여 줍니다."}
        </p>

        {students.length === 0 ? (
          <p className="text-sm text-zinc-500">
            {isAdmin
              ? "아직 학생 계정이 없습니다. 위에서 명단을 붙여넣어 추가하세요."
              : "내 목록이 비어 있습니다. 위 '전체 학생에서 담아 오기'에서 고르거나, 명단을 붙여넣어 새로 만드세요."}
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {classGroups.map((g) => (
              <div key={g.key}>
                <h3 className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-zinc-700">
                  <span className="h-3.5 w-1 rounded-full bg-blue-500" />
                  {g.grade}학년 {g.classNo}반
                  <span className="font-normal text-zinc-400">{g.list.length}명</span>
                </h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-zinc-500">
                      <th className="py-1 pr-4">학번</th>
                      <th className="py-1 pr-4">이름</th>
                      <th className="py-1 pr-4">비밀번호 변경</th>
                      {isAdmin && <th className="py-1 pr-4">담당 교사</th>}
                      <th className="py-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.list.map((s) => (
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
                        {isAdmin && (
                          <td className="py-1.5 pr-4 text-zinc-600">
                            {(studentTeachers[s.id] ?? []).length > 0 ? (
                              (studentTeachers[s.id] ?? [])
                                .map((id) => teacherNames[id] ?? "(알 수 없음)")
                                .join(", ")
                            ) : (
                              <span className="text-amber-600">담당 없음</span>
                            )}
                          </td>
                        )}
                        <td className="py-1.5 text-right">
                          <button
                            onClick={() => handleResetPassword(s)}
                            className="mr-3 text-xs text-blue-600 hover:underline"
                          >
                            비밀번호 재설정
                          </button>
                          {!isAdmin && (
                            <button
                              onClick={() => handleRemoveFromMine(s)}
                              className="mr-3 text-xs text-zinc-500 hover:underline"
                            >
                              내 목록에서 빼기
                            </button>
                          )}
                          {/* 계정 삭제는 만든 사람만 — 함께 담은 다른 선생님의 학생까지 사라지지 않게 */}
                          {(isAdmin || s.teacher_id === meId) && (
                            <button
                              onClick={() => handleDelete(s)}
                              className="text-xs text-red-500 hover:underline"
                            >
                              삭제
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
