"use client";

import { useEffect, useState } from "react";

type ProviderInfo = {
  provider: string;
  label: string;
  keyName: string;
  keyHelpUrl: string;
  modelDocUrl: string;
  help: string;
  hasKey: boolean;
};
type ModelRow = {
  id: string;
  provider: string;
  model_id: string;
  label: string;
  enabled: boolean;
  sort_order: number;
};

export default function AiSettingsManager() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [models, setModels] = useState<ModelRow[]>([]);
  const [keyDraft, setKeyDraft] = useState<Record<string, string>>({});
  const [helpOpen, setHelpOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 새 모델 폼
  const [nmProvider, setNmProvider] = useState("openai");
  const [nmId, setNmId] = useState("");
  const [nmLabel, setNmLabel] = useState("");

  async function load() {
    const res = await fetch("/api/admin/ai-settings");
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "불러오지 못했습니다.");
      return;
    }
    setProviders(data.providers);
    setModels(data.models);
  }
  useEffect(() => {
    load();
  }, []);

  async function post(payload: Record<string, unknown>, okMsg?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await fetch("/api/admin/ai-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "요청에 실패했습니다.");
    } else {
      if (okMsg) setNotice(okMsg);
      await load();
    }
    setBusy(false);
    return res.ok;
  }

  async function saveKey(provider: string) {
    const ok = await post(
      { action: "save_key", provider, apiKey: keyDraft[provider] ?? "" },
      "키를 저장했습니다."
    );
    if (ok) setKeyDraft((d) => ({ ...d, [provider]: "" }));
  }

  async function addModel() {
    if (!nmId.trim() || !nmLabel.trim()) {
      setError("모델 ID와 표시 이름을 입력하세요.");
      return;
    }
    const ok = await post(
      { action: "add_model", provider: nmProvider, model_id: nmId, label: nmLabel },
      "모델을 추가했습니다."
    );
    if (ok) {
      setNmId("");
      setNmLabel("");
    }
  }

  const inputCls =
    "rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">AI 키 · 모델 설정</h2>
        <p className="mt-1 text-sm text-zinc-500">
          제공자별 API 키를 등록하고, 학생이 고를 수 있는 모델을 추가합니다.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-green-600">{notice}</p>}

      {/* API 키 */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-zinc-900">API 키</h3>
        <div className="flex flex-col gap-5">
          {providers.map((p) => (
            <div key={p.provider} className="border-b border-zinc-100 pb-4 last:border-0">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-medium text-zinc-800">{p.label}</span>
                {p.hasKey ? (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                    등록됨
                  </span>
                ) : (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                    미등록
                  </span>
                )}
                <button
                  onClick={() =>
                    setHelpOpen(helpOpen === p.provider ? null : p.provider)
                  }
                  className="text-xs text-blue-600 hover:underline"
                >
                  발급 방법 ?
                </button>
                <a
                  href={p.modelDocUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  모델 목록 문서 ↗
                </a>
              </div>

              {helpOpen === p.provider && (
                <div className="mb-2 rounded-md bg-blue-50 p-3 text-xs leading-relaxed text-zinc-700">
                  {p.help}
                  <br />
                  <a
                    href={p.keyHelpUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    키 발급 페이지 열기 ↗
                  </a>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="password"
                  placeholder={p.hasKey ? "새 키 입력 시 교체됩니다" : `${p.keyName} 붙여넣기`}
                  value={keyDraft[p.provider] ?? ""}
                  onChange={(e) =>
                    setKeyDraft((d) => ({ ...d, [p.provider]: e.target.value }))
                  }
                  className={`min-w-72 flex-1 ${inputCls}`}
                />
                <button
                  onClick={() => saveKey(p.provider)}
                  disabled={busy}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  저장
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 모델 목록 */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h3 className="mb-1 font-semibold text-zinc-900">학생이 고를 수 있는 모델</h3>
        <p className="mb-4 text-sm text-zinc-500">
          위 &quot;모델 목록 문서&quot;에서 최신 모델 ID를 확인해 추가하세요. 활성화된
          모델만 학생 화면에 나타납니다. (모델을 하나도 안 넣으면 GPT-5 계열 기본값이
          쓰입니다.)
        </p>

        {/* 추가 폼 */}
        <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg bg-zinc-50 p-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">제공자</label>
            <select
              value={nmProvider}
              onChange={(e) => setNmProvider(e.target.value)}
              className={inputCls}
            >
              {providers.map((p) => (
                <option key={p.provider} value={p.provider}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">모델 ID</label>
            <input
              value={nmId}
              onChange={(e) => setNmId(e.target.value)}
              placeholder="예: gpt-5, gemini-2.5-flash, claude-sonnet-5"
              className={`min-w-56 ${inputCls}`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">학생에게 보일 이름</label>
            <input
              value={nmLabel}
              onChange={(e) => setNmLabel(e.target.value)}
              placeholder="예: GPT-5 (정확)"
              className={`min-w-44 ${inputCls}`}
            />
          </div>
          <button
            onClick={addModel}
            disabled={busy}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            추가
          </button>
        </div>

        {models.length === 0 ? (
          <p className="text-sm text-zinc-400">
            추가된 모델이 없습니다. (현재 기본값: GPT-5 계열)
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500">
                <th className="py-2 pr-3">제공자</th>
                <th className="py-2 pr-3">모델 ID</th>
                <th className="py-2 pr-3">표시 이름</th>
                <th className="py-2 pr-3">학생 노출</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.id} className="border-b border-zinc-100">
                  <td className="py-2 pr-3">{m.provider}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{m.model_id}</td>
                  <td className="py-2 pr-3">{m.label}</td>
                  <td className="py-2 pr-3">
                    <button
                      onClick={() =>
                        post({ action: "toggle_model", id: m.id, enabled: !m.enabled })
                      }
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        m.enabled
                          ? "bg-green-100 text-green-700"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {m.enabled ? "노출" : "숨김"}
                    </button>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`${m.label} 모델을 삭제할까요?`))
                          post({ action: "delete_model", id: m.id });
                      }}
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
