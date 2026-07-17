import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// 역할 기반 라우팅의 진입점: student → /dashboard, teacher → /teacher
export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, must_change_password")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login?error=no-profile");
  if (profile.must_change_password) redirect("/change-password");

  redirect(profile.role === "teacher" ? "/teacher" : "/dashboard");
}
