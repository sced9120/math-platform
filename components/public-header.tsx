import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// 로그인 없이 여는 화면(첫 화면·만져보는 수학) 공용 머리말
export default async function PublicHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white px-6 py-3">
      <div className="flex items-center gap-5">
        <Link href="/" className="font-bold text-zinc-900">
          수학 학습 플랫폼
        </Link>
        <Link href="/hands-on" className="text-sm text-zinc-600 hover:text-zinc-900">
          🖐 만져보는 수학
        </Link>
      </div>
      <div className="flex items-center gap-2 text-sm">
        {user ? (
          <Link
            href="/"
            className="rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
          >
            내 화면으로
          </Link>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-700 hover:bg-zinc-50"
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
            >
              선생님 가입
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
