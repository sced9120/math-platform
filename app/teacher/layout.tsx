import Link from "next/link";
import { redirect } from "next/navigation";
import { isStaff, requireProfile } from "@/lib/auth";
import { adminStillTeaching } from "@/lib/admin-handover";
import LogoutButton from "@/components/logout-button";
import Icon from "@/components/icon";

// /teacher 전체 공통: 교사·관리자 권한 가드 + 헤더/내비게이션
//  - 교사: 학생·교과·단원·진도·기록·만져보는 수학·AI 설정
//  - 관리자: 교사 관리·만져보는 수학(자료 관리)만.
//    단, 관리자가 아직 학생·자료를 갖고 있으면(교사 계정으로 넘기기 전) 수업 메뉴도 보여 준다.
export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  if (!isStaff(profile.role)) redirect("/dashboard");
  const admin = profile.role === "admin";
  const teaching = !admin || (await adminStillTeaching(profile.id));

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3 print:hidden">
        <div className="flex items-center gap-6">
          <Link href="/teacher" className="font-bold text-zinc-900">
            수학 학습 플랫폼{" "}
            <span className="text-blue-600">{admin ? "관리자" : "교사"}</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-600">
            {admin && (
              <Link
                href="/teacher/teachers"
                className="flex items-center gap-1.5 font-medium text-blue-600 hover:text-blue-800"
              >
                <Icon name="users" size={15} /> 교사 관리
              </Link>
            )}
            {teaching && (
              <>
                <Link href="/teacher/students" className="flex items-center gap-1.5 hover:text-zinc-900">
                  <Icon name="graduation" size={15} /> 학생 관리
                </Link>
                <Link href="/teacher/subjects" className="flex items-center gap-1.5 hover:text-zinc-900">
                  <Icon name="book" size={15} /> 교과 관리
                </Link>
                <Link href="/teacher/units" className="flex items-center gap-1.5 hover:text-zinc-900">
                  <Icon name="layers" size={15} /> 단원·소단원 관리
                </Link>
                <Link href="/teacher/progress" className="flex items-center gap-1.5 hover:text-zinc-900">
                  <Icon name="chart" size={15} /> 진도 현황
                </Link>
                <Link href="/teacher/export" className="flex items-center gap-1.5 hover:text-zinc-900">
                  <Icon name="download" size={15} /> 기록 다운로드
                </Link>
              </>
            )}
            <Link href="/teacher/hands-on" className="flex items-center gap-1.5 hover:text-zinc-900">
              <Icon name="cursor" size={15} /> 만져보는 수학
            </Link>
            {teaching && (
              <Link href="/teacher/ai-settings" className="flex items-center gap-1.5 hover:text-zinc-900">
                <Icon name="sparkle" size={15} /> AI 설정
              </Link>
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
