"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// 최초 관리자 계정 만들기 폼.
// 실제 생성 가능 여부(계정 0개인지)는 서버 /api/setup 이 다시 확인한다.
export default function SetupForm() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("admin");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== password2) {
      setError("두 비밀번호가 다릅니다.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginId, name, password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "계정 생성에 실패했습니다.");
      return;
    }
    setDone(true);
    setTimeout(() => router.replace("/login"), 1200);
  }

  if (done) {
    return (
      <div className="mt-5 rounded-xl border border-green-300 bg-green-50 p-5 text-sm text-green-900">
        <b>관리자 계정이 만들어졌습니다 🎉</b>
        <p className="mt-1">
          아이디 <b>{loginId}</b> 로 로그인하세요. 로그인 화면으로 이동합니다…
        </p>
      </div>
    );
  }

  const input =
    "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

  return (
    <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="s-id" className="text-sm font-medium text-zinc-700">
          아이디
        </label>
        <input
          id="s-id"
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          className={input}
          placeholder="admin"
          autoComplete="username"
        />
        <span className="text-xs text-zinc-400">
          영문으로 시작하는 3~30자. 학생 학번과 겹치지 않게 정하세요.
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="s-name" className="text-sm font-medium text-zinc-700">
          이름
        </label>
        <input
          id="s-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={input}
          placeholder="예: 정현서"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="s-pw" className="text-sm font-medium text-zinc-700">
          비밀번호
        </label>
        <input
          id="s-pw"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={input}
          autoComplete="new-password"
        />
        <span className="text-xs text-zinc-400">8자 이상</span>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="s-pw2" className="text-sm font-medium text-zinc-700">
          비밀번호 확인
        </label>
        <input
          id="s-pw2"
          type="password"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          className={input}
          autoComplete="new-password"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? "만드는 중..." : "관리자 계정 만들기"}
      </button>

      <p className="text-xs text-zinc-400">
        이 화면은 <b>계정이 하나도 없을 때만</b> 열립니다. 계정이 만들어지면 자동으로 닫혀요.
      </p>
    </form>
  );
}
