import { createClient } from "@/lib/supabase/server";
import FreeFeedback from "@/components/student/free-feedback";
import { getEnabledModels } from "@/lib/ai/models";
import { getAiLimits } from "@/lib/ai/server";

// 문제풀이 첨삭 — 자유 문제 모드 (내가 가진 아무 문제나 첨삭 받기)
export default async function FreeFeedbackPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: me }, allModels, limits] = await Promise.all([
    supabase
      .from("profiles")
      .select("ai_consent_at")
      .eq("id", user!.id)
      .single<{ ai_consent_at: string | null }>(),
    getEnabledModels(),
    getAiLimits(),
  ]);

  const models = allModels.map((m) => ({ model_id: m.model_id, label: m.label }));

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-zinc-900">
        ✏️ 문제풀이 첨삭
      </h2>
      <p className="mb-4 text-sm text-zinc-500">
        문제집·학습지 등 어떤 문제든 문제와 내 풀이를 올리면 AI가 첨삭해 줍니다.
      </p>
      <FreeFeedback
        aiConsented={!!me?.ai_consent_at}
        models={models}
        dailyLimit={limits.feedback}
      />
    </div>
  );
}
