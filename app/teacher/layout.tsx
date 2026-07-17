import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import LogoutButton from "@/components/logout-button";

// /teacher 전체 공통: 교사 권한 가드 + 헤더/내비게이션
export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  if (profile.role !== "teacher") redirect("/dashboard");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3 print:hidden">
        <div className="flex items-center gap-6">
          <Link href="/teacher" className="font-bold text-zinc-900">
            수학 학습 플랫폼 <span className="text-blue-600">교사</span>
          </Link>
          <nav className="flex gap-4 text-sm text-zinc-600">
            <Link href="/teacher/students" className="hover:text-zinc-900">
              학생 관리
            </Link>
            <Link href="/teacher/units" className="hover:text-zinc-900">
              단원/활동 관리
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-600">{profile.name} 선생님</span>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
