import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import SetupForm from "@/components/setup-form";

// 최초 설정 화면 — 관리자·교사 계정이 하나도 없을 때만 열린다.
export default async function SetupPage() {
  let needsSetup = false;
  let dbError: string | null = null;

  try {
    const admin = createAdminClient();
    const { count, error } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .in("role", ["admin", "teacher"]);
    if (error) throw new Error(error.message);
    needsSetup = (count ?? 0) === 0;
  } catch (e) {
    dbError = e instanceof Error ? e.message : "데이터베이스 확인 실패";
  }

  // 이미 설정이 끝났으면 로그인으로 보낸다
  if (!dbError && !needsSetup) redirect("/login");

  return (
    <div className="flex min-h-full items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-zinc-900">처음 오셨네요 👋</h1>
        <p className="mt-1 text-sm text-zinc-500">
          이 사이트를 쓰려면 <b>관리자 계정</b> 하나가 필요합니다. 지금 만들어 주세요.
        </p>

        {dbError ? (
          <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <b>데이터베이스가 아직 준비되지 않았습니다.</b>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>
                Vercel 환경변수 3개(<code>NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
                <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>,{" "}
                <code>SUPABASE_SERVICE_ROLE_KEY</code>)가 들어갔는지 확인하세요.
              </li>
              <li>
                Supabase SQL Editor 에 <code>supabase/setup.sql</code> 전체를 붙여넣고 실행하세요.
              </li>
              <li>그다음 이 페이지를 새로고침하세요.</li>
            </ol>
            <p className="mt-2 text-xs text-amber-700">오류: {dbError}</p>
          </div>
        ) : (
          <SetupForm />
        )}
      </div>
    </div>
  );
}
