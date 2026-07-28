import Link from "next/link";
import { redirect } from "next/navigation";
import { isStaff, requireProfile } from "@/lib/auth";
import LogoutButton from "@/components/logout-button";

// /teacher 전체 공통: 교사·관리자 권한 가드 + 헤더/내비게이션
export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  if (!isStaff(profile.role)) redirect("/dashboard");
  const admin = profile.role === "admin";

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3 print:hidden">
        <div className="flex items-center gap-6">
          <Link href="/teacher" className="font-bold text-zinc-900">
            수학 학습 플랫폼{" "}
            <span className="text-blue-600">{admin ? "관리자" : "교사"}</span>
          </Link>
          <nav className="flex gap-4 text-sm text-zinc-600">
            <Link href="/teacher/students" className="hover:text-zinc-900">
              학생 관리
            </Link>
            <Link href="/teacher/subjects" className="hover:text-zinc-900">
              교과 관리
            </Link>
            <Link href="/teacher/units" className="hover:text-zinc-900">
              단원/활동 관리
            </Link>
            <Link href="/teacher/export" className="hover:text-zinc-900">
              기록 다운로드
            </Link>
            {admin && (
              <>
                <Link href="/teacher/teachers" className="font-medium text-blue-600 hover:text-blue-800">
                  교사 관리
                </Link>
                <Link href="/teacher/prompts" className="font-medium text-blue-600 hover:text-blue-800">
                  AI 프롬프트
                </Link>
                <Link href="/teacher/ai-settings" className="font-medium text-blue-600 hover:text-blue-800">
                  AI 키·모델
                </Link>
              </>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-600">
            {profile.name} {admin ? "관리자" : "선생님"}
          </span>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
