import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSignupOpen } from "@/lib/site-settings";
import { adminHoldings } from "@/lib/admin-handover";
import SignupToggle from "@/components/teacher/signup-toggle";
import HandoverPanel from "@/components/teacher/handover-panel";
import TeachersManager, {
  type TeacherRow,
} from "@/components/teacher/teachers-manager";

// 교사 계정 관리 (관리자 전용)
//  - 누구나 교사 가입 열고 닫기
//  - 관리자가 아직 학생·자료를 갖고 있으면 교사 계정으로 넘기기
//  - 교사 계정 만들기·삭제
export default async function TeachersPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/teacher");

  const supabase = await createClient();
  const [{ data }, openSignup, holdings] = await Promise.all([
    supabase
      .from("profiles")
      // self_signup 은 0017 이후에만 있으므로 컬럼을 나열하지 않는다
      .select("*")
      .eq("role", "teacher")
      .order("created_at"),
    isSignupOpen(),
    adminHoldings(profile.id),
  ]);
  const teachers = (data as (TeacherRow & { self_signup?: boolean })[]) ?? [];

  return (
    <>
      <SignupToggle initialOpen={openSignup} />
      {holdings && (
        <HandoverPanel
          holdings={holdings}
          // 넘겨받을 수 있는 것은 학교 교사(관리자가 만든 교사)뿐 — 가입 교사는 학교 학생을 담을 수 없다
          teachers={teachers
            .filter((t) => t.self_signup !== true)
            .map((t) => ({ id: t.id, name: t.name }))}
        />
      )}
      <TeachersManager initialTeachers={teachers} />
    </>
  );
}
