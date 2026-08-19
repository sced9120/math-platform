import { requireProfile, isStaff } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getEnabledModels } from "@/lib/ai/models";
import { getAiLimits } from "@/lib/ai/server";
import { createClient } from "@/lib/supabase/server";
import AuthoringStudio from "@/components/teacher/authoring-studio";

// 조작 활동 만들기 — 왼쪽에서 말로 설명하면 오른쪽에 코드와 미리보기가 나온다.
export default async function AuthoringPage() {
  const profile = await requireProfile();
  if (!isStaff(profile.role)) redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: me }, models, limits] = await Promise.all([
    supabase
      .from("profiles")
      .select("ai_consent_at")
      .eq("id", profile.id)
      .single<{ ai_consent_at: string | null }>(),
    getEnabledModels(),
    getAiLimits(),
  ]);

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[36rem] flex-col">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-zinc-900">🛠 조작 활동 만들기</h2>
        <p className="text-sm text-zinc-500">
          만들고 싶은 화면을 말로 설명하세요. 오른쪽에서 바로 확인하고 고쳐 나갈 수 있습니다.
        </p>
      </div>
      <AuthoringStudio
        aiConsented={!!me?.ai_consent_at}
        models={models.map((m) => ({ model_id: m.model_id, label: m.label }))}
        dailyLimit={limits.authoring}
      />
    </div>
  );
}
