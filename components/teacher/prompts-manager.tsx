"use client";

import { useEffect, useState } from "react";

type PromptItem = {
  key: string;
  label: string;
  desc: string;
  default: string;
  content: string;
  customized: boolean;
};

export default function PromptsManager() {
  const [items, setItems] = useState<PromptItem[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/prompts");
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "불러오지 못했습니다.");
      return;
    }
    setItems(data.prompts);
    setDrafts(
      Object.fromEntries(
        (data.prompts as PromptItem[]).map((p) => [p.key, p.content])
      )
    );
  }

  useEffect(() => {
    load();
  }, []);

  async function save(key: string) {
    setBusy(key);
    setError(null);
    setNotice((n) => ({ ...n, [key]: "" }));
    const res = await fetch("/api/admin/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, content: drafts[key] }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "저장에 실패했습니다.");
    } else {
      setNotice((n) => ({ ...n, [key]: "저장되었습니다. 다음 AI 응답부터 반영됩니다." }));
      await load();
    }
    setBusy(null);
  }

  async function restore(key: string) {
    if (!confirm("이 프롬프트를 기본값으로 되돌릴까요? 수정한 내용은 사라집니다.")) return;
    setBusy(key);
    const res = await fetch("/api/admin/prompts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setDrafts((d) => ({ ...d, [key]: data.default }));
      setNotice((n) => ({ ...n, [key]: "기본값으로 되돌렸습니다." }));
      await load();
    }
    setBusy(null);
  }

  if (error && !items) return <p className="text-sm text-red-600">{error}</p>;
  if (!items) return <p className="text-sm text-zinc-400">불러오는 중...</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">AI 프롬프트 관리</h2>
        <p className="mt-1 text-sm text-zinc-500">
          AI의 성격·규칙을 코드 수정 없이 여기서 바꿀 수 있습니다. 저장하면 다음
          응답부터 적용됩니다.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        ⚠️ &quot;정답을 직접 알려주지 않는다&quot; 규칙은 되도록 유지하세요. 이 문장을
        지우면 AI가 학생에게 답을 그대로 알려줄 수 있습니다.
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {items.map((p) => {
        const changed = drafts[p.key] !== p.content;
        return (
          <section
            key={p.key}
            className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-1 flex items-center gap-2">
              <h3 className="font-semibold text-zinc-900">{p.label}</h3>
              {p.customized ? (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                  수정됨
                </span>
              ) : (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                  기본값
                </span>
              )}
            </div>
            <p className="mb-3 text-sm text-zinc-500">{p.desc}</p>

            <textarea
              rows={10}
              value={drafts[p.key] ?? ""}
              onChange={(e) =>
                setDrafts((d) => ({ ...d, [p.key]: e.target.value }))
              }
              className="w-full rounded-md border border-zinc-300 p-3 font-mono text-xs leading-relaxed focus:border-blue-500 focus:outline-none"
            />

            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={() => save(p.key)}
                disabled={busy === p.key || !changed}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy === p.key ? "저장 중..." : "저장"}
              </button>
              {p.customized && (
                <button
                  onClick={() => restore(p.key)}
                  disabled={busy === p.key}
                  className="text-sm text-zinc-500 hover:underline"
                >
                  기본값으로 되돌리기
                </button>
              )}
              {notice[p.key] && (
                <span className="text-sm text-green-600">{notice[p.key]}</span>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
