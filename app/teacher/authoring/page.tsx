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
  const [{ data: me }, models, limits, { data: acts }] = await Promise.all([
    supabase
      .from("profiles")
      .select("ai_consent_at")
      .eq("id", profile.id)
      .single<{ ai_consent_at: string | null }>(),
    getEnabledModels(),
    getAiLimits(),
    // 만든 화면을 붙일 곳 — 단원별로 묶어 고르게 한다
    supabase
      .from("activities")
      .select("id, title, order_index, units(title, order_index)")
      .order("order_index"),
  ]);

  type Row = {
    id: string;
    title: string;
    order_index: number;
    units: { title: string; order_index: number } | null;
  };
  const activities = ((acts ?? []) as unknown as Row[])
    .map((a) => ({
      id: a.id,
      title: a.title,
      unit: a.units?.title ?? "단원 없음",
      unitOrder: a.units?.order_index ?? 999,
      order: a.order_index,
    }))
    .sort((x, y) => x.unitOrder - y.unitOrder || x.order - y.order);

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
        activities={activities}
      />
    </div>
  );
}
