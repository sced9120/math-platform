import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import PromptsManager from "@/components/teacher/prompts-manager";

// AI 프롬프트 관리 (관리자 전용)
export default async function PromptsPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/teacher");
  return <PromptsManager />;
}
