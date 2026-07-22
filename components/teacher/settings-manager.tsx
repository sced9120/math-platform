"use client";

import { useEffect, useState } from "react";

type ProviderInfo = {
  provider: "openai" | "gemini" | "anthropic";
  label: string;
  keyName: string;
  keyHelpUrl: string;
  modelDocUrl: string;
  help: string;
  hasStoredKey: boolean;
  keySuffix: string | null;
  hasEnvKey: boolean;
};

type ModelRow = {
  id: string;
  provider: "openai" | "gemini" | "anthropic";
  model_id: string;
  label: string;
  enabled: boolean;
  sort_order: number;
};

export default function SettingsManager() {
  const [providers, setProviders] = useState<ProviderInfo[] | null>(null);
  const [models, setModels] = useState<ModelRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState<string | null>(null); // 펼친 도움말 provider

  async function load() {
    const res = await fetch("/api/admin/settings");
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

  if (error && !providers) return <p className="text-sm text-red-600">{error}</p>;
  if (!providers) return <p className="text-sm text-zinc-400">불러오는 중...</p>;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">AI 설정</h2>
        <p className="mt-1 text-sm text-zinc-500">
          제공자별 API 키를 등록하고, 학생이 고를 수 있는 모델을 관리합니다.
          최신 모델 ID는 각 제공자 공식 문서에서 확인해 추가하세요.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* API 키 */}
      <section className="flex flex-col gap-4">
        <h3 className="font-semibold text-zinc-900">1. API 키</h3>
        {providers.map((p) => (
          <ApiKeyCard
            key={p.provider}
            info={p}
            helpOpen={help === p.provider}
            onToggleHelp={() =>
              setHelp((h) => (h === p.provider ? null : p.provider))
            }
            onChanged={load}
            onError={setError}
          />
        ))}
      </section>

      {/* 모델 목록 */}
      <section className="flex flex-col gap-4">
        <h3 className="font-semibold text-zinc-900">2. 학생이 고를 수 있는 모델</h3>
        <p className="text-sm text-zinc-500">
          모델을 여러 개 추가하면 학생 화면에 선택 메뉴가 생깁니다. 하나뿐이면
          그 모델이 자동 사용됩니다. 아직 없으면 GPT-5 mini/GPT-5가 기본으로
          쓰입니다(OpenAI 키 필요).
        </p>
        <ModelsEditor
          providers={providers}
          models={models}
          onChanged={load}
          onError={setError}
        />
      </section>
    </div>
  );
}

function ApiKeyCard({
  info,
  helpOpen,
  onToggleHelp,
  onChanged,
  onError,
}: {
  info: ProviderInfo;
  helpOpen: boolean;
  onToggleHelp: () => void;
  onChanged: () => void;
  onError: (m: string) => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    onError("");
    setSaved(false);
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "key", provider: info.provider, apiKey: value }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) onError(data?.error ?? "저장에 실패했습니다.");
    else {
      setValue("");
      setSaved(true);
      onChanged();
    }
    setBusy(false);
  }

  async function remove() {
    if (!confirm(`${info.label} 키를 삭제할까요?`)) return;
    setBusy(true);
    await fetch("/api/admin/settings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "key", provider: info.provider }),
    });
    onChanged();
    setBusy(false);
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-medium text-zinc-900">{info.label}</span>
        {info.hasStoredKey ? (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
            등록됨 (…{info.keySuffix})
          </span>
        ) : info.hasEnvKey ? (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
            서버 환경변수로 설정됨
          </span>
        ) : (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
            미설정
          </span>
        )}
        <button
          onClick={onToggleHelp}
          className="ml-auto text-xs text-blue-600 hover:underline"
        >
          {helpOpen ? "도움말 닫기" : "❓ 키 발급 방법"}
        </button>
      </div>

      {helpOpen && (
        <div className="mb-3 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">
          <p className="leading-relaxed">{info.help}</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <a
              href={info.keyHelpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              🔑 키 발급 페이지 열기
            </a>
            <a
              href={info.modelDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              📖 사용 가능한 모델 목록(공식 문서)
            </a>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="password"
          placeholder={`${info.keyName} 붙여넣기`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-w-64 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={save}
          disabled={busy || value.trim().length < 10}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "저장 중..." : info.hasStoredKey ? "키 교체" : "저장"}
        </button>
        {info.hasStoredKey && (
          <button
            onClick={remove}
            disabled={busy}
            className="text-xs text-red-500 hover:underline"
          >
            삭제
          </button>
        )}
        {saved && <span className="text-sm text-green-600">저장됨</span>}
      </div>
    </div>
  );
}

function ModelsEditor({
  providers,
  models,
  onChanged,
  onError,
}: {
  providers: ProviderInfo[];
  models: ModelRow[];
  onChanged: () => void;
  onError: (m: string) => void;
}) {
  const [provider, setProvider] = useState<ProviderInfo["provider"]>("openai");
  const [modelId, setModelId] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const providerLabel = (p: string) =>
    providers.find((x) => x.provider === p)?.label ?? p;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    onError("");
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "model", provider, modelId, label }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) onError(data?.error ?? "추가에 실패했습니다.");
    else {
      setModelId("");
      setLabel("");
      onChanged();
    }
    setBusy(false);
  }

  async function toggle(m: ModelRow) {
    await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id, enabled: !m.enabled }),
    });
    onChanged();
  }

  async function remove(m: ModelRow) {
    if (!confirm(`'${m.label}' 모델을 삭제할까요?`)) return;
    await fetch("/api/admin/settings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "model", id: m.id }),
    });
    onChanged();
  }

  const inputCls =
    "rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

  return (
    <div className="flex flex-col gap-4">
      {/* 모델 추가 폼 */}
      <form
        onSubmit={add}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
      >
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">제공자</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as ProviderInfo["provider"])}
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
          <label className="text-sm font-medium text-zinc-700">
            모델 ID{" "}
            <a
              href={
                providers.find((p) => p.provider === provider)?.modelDocUrl ?? "#"
              }
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-normal text-blue-600 hover:underline"
            >
              (공식 문서에서 확인 ↗)
            </a>
          </label>
          <input
            type="text"
            required
            placeholder="예: gpt-5-mini"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className={`w-48 ${inputCls}`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">학생에게 보일 이름</label>
          <input
            type="text"
            required
            placeholder="예: GPT-5 mini (빠름)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={`w-56 ${inputCls}`}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "추가 중..." : "모델 추가"}
        </button>
      </form>

      {/* 모델 목록 */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        {models.length === 0 ? (
          <p className="text-sm text-zinc-500">
            추가된 모델이 없습니다. (지금은 GPT-5 mini/GPT-5 기본값으로 동작)
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
                  <td className="py-2 pr-3 text-zinc-600">
                    {providerLabel(m.provider)}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">{m.model_id}</td>
                  <td className="py-2 pr-3">{m.label}</td>
                  <td className="py-2 pr-3">
                    <button
                      onClick={() => toggle(m)}
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
                      onClick={() => remove(m)}
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
      </div>
    </div>
  );
}
