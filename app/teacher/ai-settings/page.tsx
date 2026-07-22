import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import SettingsManager from "@/components/teacher/settings-manager";

// AI 설정 (관리자 전용): API 키 + 모델 목록
export default async function SettingsPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/teacher");
  return <SettingsManager />;
}
