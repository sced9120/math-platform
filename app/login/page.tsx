"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "no-profile"
      ? "계정 정보에 문제가 있습니다. 선생님께 문의하세요."
      : null
  );
  const [loading, setLoading] = useState(false);
  // 계정이 하나도 없는 새 사이트면 최초 설정으로 안내한다
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json())
      .then((d) => setNeedsSetup(!!d?.needsSetup))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    // 학번을 내부 가상 이메일로 변환해 로그인 (학생에겐 학번만 노출)
    const { error } = await supabase.auth.signInWithPassword({
      email: `${studentId.trim()}@school.local`,
      password,
    });

    if (error) {
      setError("학번 또는 비밀번호가 올바르지 않습니다.");
      setLoading(false);
      return;
    }

    // 역할·비번변경 여부에 따른 분기는 서버(/)에서 처리
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {needsSetup && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <b>아직 계정이 하나도 없습니다.</b>
          <p className="mt-1">
            <Link href="/setup" className="font-medium underline">
              관리자 계정 만들기 →
            </Link>
          </p>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="studentId" className="text-sm font-medium text-zinc-700">
          학번
        </label>
        <input
          id="studentId"
          type="text"
          required
          autoComplete="username"
          placeholder="예: 10315"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-zinc-700">
          비밀번호
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-md bg-blue-600 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "로그인 중..." : "로그인"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-bold text-zinc-900">수학 학습 플랫폼</h1>
        <p className="mb-6 text-sm text-zinc-500">
          학번과 비밀번호로 로그인하세요.
        </p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
