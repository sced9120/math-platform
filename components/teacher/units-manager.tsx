"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Unit } from "@/lib/types";

const EMPTY_FORM = { title: "", grade: 1, order_index: 0, is_published: false };

export default function UnitsManager({ initialUnits }: { initialUnits: Unit[] }) {
  const [units, setUnits] = useState<Unit[]>(initialUnits);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("units")
      .select("*")
      .order("grade")
      .order("order_index");
    setUnits((data as Unit[]) ?? []);
  }, []);

  function startEdit(u: Unit) {
    setEditingId(u.id);
    setForm({
      title: u.title,
      grade: u.grade,
      order_index: u.order_index,
      is_published: u.is_published,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error } = editingId
      ? await supabase.from("units").update(form).eq("id", editingId)
      : await supabase.from("units").insert(form);

    if (error) {
      setError("저장에 실패했습니다. 다시 시도하세요.");
    } else {
      cancelEdit();
      await load();
    }
    setSaving(false);
  }

  async function handleDelete(u: Unit) {
    if (!confirm(`'${u.title}' 단원을 삭제할까요?\n소속 활동과 진행기록도 함께 삭제됩니다.`))
      return;
    const supabase = createClient();
    const { error } = await supabase.from("units").delete().eq("id", u.id);
    if (error) {
      alert("삭제에 실패했습니다.");
      return;
    }
    if (editingId === u.id) cancelEdit();
    await load();
  }

  async function togglePublish(u: Unit) {
    const supabase = createClient();
    await supabase.from("units").update({ is_published: !u.is_published }).eq("id", u.id);
    await load();
  }

  return (
    <div className="flex flex-col gap-8">
      {/* 단원 추가/수정 폼 */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">
          {editingId ? "단원 수정" : "새 단원 추가"}
        </h2>
        <form onSubmit={handleSave} className="flex flex-wrap items-end gap-4">
          <div className="flex min-w-64 flex-1 flex-col gap-1">
            <label htmlFor="title" className="text-sm font-medium text-zinc-700">
              단원명
            </label>
            <input
              id="title"
              type="text"
              required
              placeholder="예: 이차함수와 그래프"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="rounded-md border border-zinc-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="grade" className="text-sm font-medium text-zinc-700">
              학년
            </label>
            <select
              id="grade"
              value={form.grade}
              onChange={(e) => setForm({ ...form, grade: Number(e.target.value) })}
              className="rounded-md border border-zinc-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            >
              <option value={1}>1학년</option>
              <option value={2}>2학년</option>
              <option value={3}>3학년</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="order" className="text-sm font-medium text-zinc-700">
              순서
            </label>
            <input
              id="order"
              type="number"
              value={form.order_index}
              onChange={(e) => setForm({ ...form, order_index: Number(e.target.value) })}
              className="w-20 rounded-md border border-zinc-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-2 pb-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
            />
            공개
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "저장 중..." : editingId ? "수정 저장" : "추가"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
              >
                취소
              </button>
            )}
          </div>
        </form>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </section>

      {/* 단원 목록 */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">
          단원 목록 ({units.length}개)
        </h2>
        {units.length === 0 ? (
          <p className="text-sm text-zinc-500">아직 단원이 없습니다. 위에서 추가하세요.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500">
                <th className="py-2 pr-4">학년</th>
                <th className="py-2 pr-4">순서</th>
                <th className="py-2 pr-4">단원명</th>
                <th className="py-2 pr-4">공개</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id} className="border-b border-zinc-100">
                  <td className="py-2 pr-4">{u.grade}학년</td>
                  <td className="py-2 pr-4">{u.order_index}</td>
                  <td className="py-2 pr-4 font-medium text-zinc-900">{u.title}</td>
                  <td className="py-2 pr-4">
                    <button
                      onClick={() => togglePublish(u)}
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        u.is_published
                          ? "bg-green-100 text-green-700"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {u.is_published ? "공개" : "비공개"}
                    </button>
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-3">
                      <Link
                        href={`/teacher/units/${u.id}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        활동 관리
                      </Link>
                      <button
                        onClick={() => startEdit(u)}
                        className="text-xs text-zinc-600 hover:underline"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        삭제
                      </button>
                    </div>
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
