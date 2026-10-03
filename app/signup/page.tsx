"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// 교사 가입 — 가입하면 바로 "내 학급" 교사 화면으로 들어간다.
// 실제 이메일은 받지 않는다(아이디@school.local 가상 이메일).
export default function SignupPage() {
  const router = useRouter();
  const [open, setOpen] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [website, setWebsite] = useState(""); // 봇 걸러내기용 (사람에겐 안 보임)
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/signup")
      .then((r) => r.json())
      .then((d) => setOpen(!!d?.open))
      .catch(() => setOpen(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setLoading(true);

    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, loginId, password, website }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "가입하지 못했습니다.");
      setLoading(false);
      return;
    }

    // 바로 로그인해서 교사 화면으로
    const { error: signInError } = await createClient().auth.signInWithPassword({
      email: `${data.loginId}@school.local`,
      password,
    });
    if (signInError) {
      router.push("/login");
      return;
    }
    router.push("/teacher");
    router.refresh();
  }

  const inputCls =
    "rounded-md border border-zinc-300 px-3 py-2 focus:border-blue-500 focus:outline-none";

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← 처음으로
        </Link>
        <h1 className="mt-2 mb-1 text-xl font-bold text-zinc-900">선생님 가입</h1>
        <p className="mb-6 text-sm text-zinc-500">
          가입하면 내 학급을 만들어 학생 계정과 활동을 구성할 수 있습니다.
        </p>

        {open === null ? (
          <p className="text-sm text-zinc-400">확인 중...</p>
        ) : !open ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            지금은 교사 가입을 받지 않습니다. 사이트 관리자에게 계정을 요청하세요.
            <p className="mt-2">
              <Link href="/hands-on" className="underline">
                만져보는 수학은 가입 없이 쓸 수 있습니다 →
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">이름</span>
              <input
                required
                maxLength={30}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 김수학"
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">아이디</span>
              <input
                required
                autoComplete="username"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value.toLowerCase())}
                placeholder="영문 소문자로 시작, 3~30자"
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">비밀번호</span>
              <input
                required
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8자 이상"
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">비밀번호 확인</span>
              <input
                required
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputCls}
              />
            </label>
            {/* 봇 걸러내기 — 화면과 보조기기 모두에서 숨긴다 */}
            <input
              tabIndex={-1}
              aria-hidden="true"
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="hidden"
              name="website"
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 rounded-md bg-blue-600 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "만드는 중..." : "가입하고 시작하기"}
            </button>
            <p className="text-center text-sm text-zinc-500">
              이미 계정이 있나요?{" "}
              <Link href="/login" className="text-blue-600 hover:underline">
                로그인
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
