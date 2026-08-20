"use client";

import { useState } from "react";

// 공개 아카이브 내보내기 버튼.
// 배포된 앱은 깃 저장소에 파일을 못 쓰므로, 서버가 GitHub API 로 커밋한다.
// 커밋되면 GitHub Pages 가 알아서 다시 빌드한다(보통 1~2분).
export default function ArchivePublish() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/teacher/archive", { method: "POST" });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "내보내기에 실패했습니다.");
      else if (data.count === 0) setMsg(data.message);
      else
        setMsg(
          `소단원 ${data.count}개를 내보냈습니다 (커밋 ${data.commit}). ` +
            "공개 사이트에 반영되기까지 1~2분 걸립니다."
        );
    } catch {
      setError("서버에 닿지 못했습니다.");
    }
    setBusy(false);
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="mb-1 font-semibold text-zinc-900">공개 아카이브 내보내기</h3>
      <p className="text-sm text-zinc-500">
        화면 구성으로 만든 <b>공개 소단원</b>을 로그인 없이 열리는 단일 HTML 로 내보냅니다.
        예전 방식으로 만든 활동 파일은 건드리지 않습니다.
      </p>
      <button
        onClick={run}
        disabled={busy}
        className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? "내보내는 중..." : "지금 내보내기"}
      </button>
      {msg && <p className="mt-2 text-sm text-green-600">✓ {msg}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
