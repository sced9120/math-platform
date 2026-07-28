"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Subject, Unit } from "@/lib/types";

const EMPTY = { title: "", grade: 1, order_index: 0, is_published: false };

export default function SubjectsManager({
  initialSubjects,
  initialUnits,
  missingTable,
}: {
  initialSubjects: Subject[];
  initialUnits: Unit[];
  missingTable: boolean;
}) {
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);
  const [units, setUnits] = useState<Unit[]>(initialUnits);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [s, u] = await Promise.all([
      supabase.from("subjects").select("*").order("grade").order("order_index"),
      supabase.from("units").select("*").order("grade").order("order_index"),
    ]);
    setSubjects((s.data as Subject[]) ?? []);
    setUnits((u.data as Unit[]) ?? []);
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const payload = { ...form, title: form.title.trim() };
    const { error: err } = editingId
      ? await supabase.from("subjects").update(payload).eq("id", editingId)
      : await supabase.from("subjects").insert(payload);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setForm(EMPTY);
    setEditingId(null);
    await load();
  }

  async function togglePublish(s: Subject) {
    const supabase = createClient();
    await supabase.from("subjects").update({ is_published: !s.is_published }).eq("id", s.id);
    await load();
  }

  async function remove(s: Subject) {
    if (!confirm(`교과 "${s.title}" 을(를) 삭제할까요?\n소속 단원은 지워지지 않고 '교과 미지정'이 됩니다.`))
      return;
    const supabase = createClient();
    const { error: err } = await supabase.from("subjects").delete().eq("id", s.id);
    if (err) setError(err.message);
    await load();
  }

  // 단원의 소속 교과 변경
  async function assignUnit(unitId: string, subjectId: string) {
    const supabase = createClient();
    const { error: err } = await supabase
      .from("units")
      .update({ subject_id: subjectId === "" ? null : subjectId })
      .eq("id", unitId);
    if (err) setError(err.message);
    await load();
  }

  if (missingTable) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="font-bold text-amber-900">마이그레이션이 아직 실행되지 않았습니다</h2>
        <p className="mt-2 text-sm text-amber-800">
          <code className="rounded bg-amber-100 px-1">supabase/migrations/0010_subjects.sql</code> 을
          Supabase SQL Editor 에서 실행한 뒤 이 페이지를 새로고침하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900">
          {editingId ? "교과 수정" : "교과 추가"}
        </h2>
        <form
          onSubmit={handleSave}
          className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="s-title" className="text-sm font-medium text-zinc-700">
              교과명
            </label>
            <input
              id="s-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="예: 공통수학2"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="s-grade" className="text-sm font-medium text-zinc-700">
              학년
            </label>
            <select
              id="s-grade"
              value={form.grade}
              onChange={(e) => setForm({ ...form, grade: Number(e.target.value) })}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value={1}>1학년</option>
              <option value={2}>2학년</option>
              <option value={3}>3학년</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="s-order" className="text-sm font-medium text-zinc-700">
              순서
            </label>
            <input
              id="s-order"
              type="number"
              value={form.order_index}
              onChange={(e) => setForm({ ...form, order_index: Number(e.target.value) })}
              className="w-24 rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
            />
            공개
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "저장 중..." : editingId ? "수정" : "추가"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY);
              }}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm"
            >
              취소
            </button>
          )}
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900">교과 목록</h2>
        {subjects.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
            아직 교과가 없습니다.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {subjects.map((s) => {
              const mine = units.filter((u) => u.subject_id === s.id);
              return (
                <div key={s.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-zinc-900">{s.title}</span>
                      <span className="ml-2 text-sm text-zinc-500">
                        {s.grade}학년 · 순서 {s.order_index} · 단원 {mine.length}개
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => togglePublish(s)}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          s.is_published
                            ? "bg-green-100 text-green-700"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {s.is_published ? "공개" : "비공개"}
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(s.id);
                          setForm({
                            title: s.title,
                            grade: s.grade,
                            order_index: s.order_index,
                            is_published: s.is_published,
                          });
                        }}
                        className="rounded-md border border-zinc-300 px-3 py-1 text-xs"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => remove(s)}
                        className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-600"
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  {mine.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-1 border-t border-zinc-100 pt-3">
                      {mine.map((u) => (
                        <li key={u.id} className="flex items-center justify-between text-sm">
                          <span className="text-zinc-700">
                            {u.title}
                            <span className="ml-2 text-xs text-zinc-400">
                              순서 {u.order_index}
                            </span>
                          </span>
                          <button
                            onClick={() => assignUnit(u.id, "")}
                            className="text-xs text-zinc-500 hover:text-red-600"
                          >
                            교과에서 빼기
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900">단원 → 교과 지정</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500">
                <th className="p-3">단원</th>
                <th className="p-3">학년</th>
                <th className="p-3">소속 교과</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id} className="border-b border-zinc-100 last:border-0">
                  <td className="p-3 text-zinc-800">{u.title}</td>
                  <td className="p-3 text-zinc-500">{u.grade}학년</td>
                  <td className="p-3">
                    <select
                      value={u.subject_id ?? ""}
                      onChange={(e) => assignUnit(u.id, e.target.value)}
                      className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                    >
                      <option value="">(교과 미지정)</option>
                      {subjects
                        .filter((s) => s.grade === u.grade)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title}
                          </option>
                        ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
