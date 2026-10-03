import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "student" | "teacher" | "admin";

export type Profile = {
  id: string;
  grade: number | null;
  class_no: number | null;
  student_no: number | null;
  name: string;
  role: Role;
  must_change_password: boolean;
  teacher_id?: string | null; // 학생의 담당 교사
  self_signup?: boolean; // 0017: /signup 으로 직접 가입한 교사 (학교 학생 명단이 안 보임)
  class_code?: string | null; // 0017: 가입 교사의 학급 코드
};

// admin은 교사 기능을 모두 포함한다
export function isStaff(role: Role): boolean {
  return role === "teacher" || role === "admin";
}

// 보호된 페이지 공용 가드: 로그인 + 프로필을 보장하고,
// 최초 로그인(비번 미변경) 상태면 비밀번호 변경 페이지로 강제 이동한다.
// (/change-password 페이지 자체에서는 사용하지 말 것 — 무한 리다이렉트)
export async function requireProfile(): Promise<Profile> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  // 계정은 있는데 프로필이 없는 비정상 상태 → 로그인 화면으로
  if (!profile) redirect("/login?error=no-profile");

  if (profile.must_change_password) redirect("/change-password");

  return profile;
}
