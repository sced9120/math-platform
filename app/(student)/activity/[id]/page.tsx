import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ActivityRunner from "@/components/student/activity-runner";
import { getEnabledModels } from "@/lib/ai/models";
import type { Activity } from "@/lib/types";

type ProgressRow = {
  completed: boolean;
  score: number | null;
  submission: { answer?: string; correct?: boolean } | null;
  response_text: string | null;
};

// 활동 실행 화면. 활동 데이터는 정답이 제거된 RPC(student_activities)로만 가져온다.
export default async function StudentActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const supabase = await createClient();

  const { data: rows } = await supabase.rpc("student_activities", {
    p_activity_id: id,
  });
  const activity = (rows as Activity[] | null)?.[0];
  if (!activity) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: unit }, { data: progress }, { data: me }, allModels] =
    await Promise.all([
      supabase.from("units").select("id, title").eq("id", activity.unit_id).single(),
      supabase
        .from("progress")
        .select("completed, score, submission, response_text")
        .eq("activity_id", id)
        .maybeSingle<ProgressRow>(),
      supabase
        .from("profiles")
        .select("ai_consent_at")
        .eq("id", user!.id)
        .single<{ ai_consent_at: string | null }>(),
      getEnabledModels(),
    ]);

  // 학생 선택지로 쓸 최소 정보만 (provider는 서버가 검증하므로 노출 불필요)
  const models = allModels.map((m) => ({ model_id: m.model_id, label: m.label }));

  return (
    <div>
      <Link
        href={`/unit/${activity.unit_id}`}
        className="text-sm text-blue-600 hover:underline"
      >
        ← {unit?.title ?? "단원"}
      </Link>
      <h2 className="mt-1 mb-4 text-lg font-semibold text-zinc-900">
        {activity.title}
      </h2>

      <ActivityRunner
        activity={activity}
        initialProgress={progress ?? null}
        aiConsented={!!me?.ai_consent_at}
        initialTab={tab}
        models={models}
      />
    </div>
  );
}
