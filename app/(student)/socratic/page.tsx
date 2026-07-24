import { createClient } from "@/lib/supabase/server";
import FreeSocratic from "@/components/student/free-socratic";
import { getEnabledModels } from "@/lib/ai/models";
import { getAiLimits } from "@/lib/ai/server";

// 소크라테스식 문답 — 자유 질문 모드 (특정 활동 없이 수학 학습 전반)
export default async function FreeSocraticPage() {
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
        💬 소크라테스식 문답
      </h2>
      <p className="mb-4 text-sm text-zinc-500">
        활동과 상관없이, 수학 공부에 대해 무엇이든 질문하세요.
      </p>
      <FreeSocratic
        aiConsented={!!me?.ai_consent_at}
        models={models}
        dailyLimit={limits.socratic}
      />
    </div>
  );
}
