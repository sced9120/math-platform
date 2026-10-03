import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSignupOpen } from "@/lib/site-settings";
import SignupToggle from "@/components/teacher/signup-toggle";
import TeachersManager, {
  type TeacherRow,
} from "@/components/teacher/teachers-manager";

// 교사 계정 관리 (관리자 전용)
export default async function TeachersPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/teacher");

  const supabase = await createClient();
  const [{ data }, openSignup] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, must_change_password, created_at")
      .eq("role", "teacher")
      .order("created_at"),
    isSignupOpen(),
  ]);

  return (
    <>
      <SignupToggle initialOpen={openSignup} />
      <TeachersManager initialTeachers={(data as TeacherRow[]) ?? []} />
    </>
  );
}
