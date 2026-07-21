"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type TeacherRow = {
  id: string;
  name: string;
  must_change_password: boolean;
  created_at: string;
};

type CreatedInfo = { loginId: string; name: string; password: string };

export default function TeachersManager({
  initialTeachers,
}: {
  initialTeachers: TeacherRow[];
}) {
  const [teachers, setTeachers] = useState<TeacherRow[]>(initialTeachers);
  const [loginId, setLoginId] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const { data } = await createClient()
      .from("profiles")
      .select("id, name, must_change_password, created_at")
      .eq("role", "teacher")
      .order("created_at");
    setTeachers((data as TeacherRow[]) ?? []);
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setCreated(null);

    const res = await fetch("/api/admin/teachers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginId, name }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "생성에 실패했습니다.");
    } else {
      setCreated(data);
      setLoginId("");
      setName("");
      await reload();
    }
    setCreating(false);
  }

  async function handleDelete(t: TeacherRow) {
    if (!confirm(`${t.name} 교사 계정을 삭제할까요?`)) return;
    const res = await fetch("/api/admin/teachers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: t.id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "삭제에 실패했습니다.");
      return;
    }
    await reload();
  }

  const inputCls =
    "rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

  return (
    <div className="flex flex-col gap-8">
      {/* 교사 계정 생성 */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">교사 계정 만들기</h2>
        <p className="mb-4 text-sm text-zinc-500">
          아이디는 학번과 겹치지 않게 영문으로 만드세요(예: <code>kim</code>,{" "}
          <code>math2</code>). 초기비밀번호는 자동 생성되며, 교사는 첫 로그인 시
          비밀번호를 바꿉니다.
        </p>
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">아이디(영문)</label>
            <input
              type="text"
              required
              placeholder="예: kim"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">이름</label>
            <input
              type="text"
              required
              placeholder="예: 김수학"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? "생성 중..." : "교사 계정 생성"}
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {created && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="mb-2 text-sm font-semibold text-zinc-900">
              생성 완료 — 아래 정보를 교사에게 전달하세요.
            </p>
            <table className="text-sm">
              <tbody>
                <tr>
                  <td className="pr-4 text-zinc-500">아이디</td>
                  <td className="font-mono">{created.loginId}</td>
                </tr>
                <tr>
                  <td className="pr-4 text-zinc-500">이름</td>
                  <td>{created.name}</td>
                </tr>
                <tr>
                  <td className="pr-4 text-zinc-500">초기비밀번호</td>
                  <td className="font-mono">{created.password}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-xs text-red-600">
              ⚠️ 초기비밀번호는 지금만 확인할 수 있습니다.
            </p>
          </div>
        )}
      </section>

      {/* 교사 목록 */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">
          교사 ({teachers.length}명)
        </h2>
        {teachers.length === 0 ? (
          <p className="text-sm text-zinc-500">아직 교사 계정이 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500">
                <th className="py-2 pr-4">이름</th>
                <th className="py-2 pr-4">비밀번호</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.id} className="border-b border-zinc-100">
                  <td className="py-1.5 pr-4">{t.name}</td>
                  <td className="py-1.5 pr-4">
                    {t.must_change_password ? (
                      <span className="text-amber-600">초기비번 상태</span>
                    ) : (
                      <span className="text-green-600">변경 완료</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right">
                    <button
                      onClick={() => handleDelete(t)}
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
