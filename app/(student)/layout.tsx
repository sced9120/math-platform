import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import LogoutButton from "@/components/logout-button";

// 학생 페이지 공통: 학생 가드 + 헤더 (URL에는 영향 없는 route group)
export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  if (profile.role === "teacher") redirect("/teacher");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
        <Link href="/dashboard" className="font-bold text-zinc-900">
          수학 학습 플랫폼
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-600">
            {profile.grade}학년 {profile.class_no}반 {profile.name}
          </span>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
