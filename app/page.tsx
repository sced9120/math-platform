import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PublicHeader from "@/components/public-header";

// 첫 화면
//  - 로그인한 사람: 예전처럼 역할에 맞는 화면으로 (student → /dashboard, teacher·admin → /teacher)
//  - 처음 온 사람: 누구나 쓰는 만져보는 수학 + 로그인 + 선생님 가입(내 학급 만들기)
export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, must_change_password")
      .eq("id", user.id)
      .single();

    if (!profile) redirect("/login?error=no-profile");
    if (profile.must_change_password) redirect("/change-password");

    // admin·teacher는 교사 화면으로 (admin은 거기서 '교사 관리'까지 가능)
    const staff = profile.role === "teacher" || profile.role === "admin";
    redirect(staff ? "/teacher" : "/dashboard");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50">
      <PublicHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6">
        <section className="mb-10">
          <h1 className="text-3xl font-bold text-zinc-900">손으로 만지며 배우는 수학</h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-zinc-600">
            누구나 바로 조작 자료를 열어 볼 수 있습니다. 선생님은 가입하면 내 학급을 만들고,
            학생 계정과 활동을 구성해 기록까지 모아 볼 수 있습니다.
          </p>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <Link
            href="/hands-on"
            className="rounded-xl border border-blue-200 bg-white p-6 shadow-sm hover:border-blue-400"
          >
            <p className="text-2xl">🖐</p>
            <h2 className="mt-2 font-semibold text-zinc-900">만져보는 수학</h2>
            <p className="mt-1 text-sm leading-relaxed text-zinc-600">
              로그인 없이 누구나. 링크만 나눠 주면 학생이 바로 엽니다. (기록은 저장하지 않음)
            </p>
          </Link>

          <Link
            href="/login"
            className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm hover:border-blue-400"
          >
            <p className="text-2xl">🎒</p>
            <h2 className="mt-2 font-semibold text-zinc-900">학생 로그인</h2>
            <p className="mt-1 text-sm leading-relaxed text-zinc-600">
              선생님께 받은 학번·비밀번호(와 학급 코드)로 들어가 활동하고 기록을 남깁니다.
            </p>
          </Link>

          <Link
            href="/signup"
            className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm hover:border-blue-400"
          >
            <p className="text-2xl">🧑‍🏫</p>
            <h2 className="mt-2 font-semibold text-zinc-900">선생님 — 내 학급 만들기</h2>
            <p className="mt-1 text-sm leading-relaxed text-zinc-600">
              교사 계정을 만들면 학생 계정·교과·활동 구성, AI 문답·첨삭, 진도와 기록 관리를 모두
              쓸 수 있습니다.
            </p>
            <p className="mt-3 text-sm text-blue-600">
              가입하기 → <span className="text-zinc-400">· 이미 계정이 있으면 로그인</span>
            </p>
          </Link>
        </div>
      </main>
    </div>
  );
}
