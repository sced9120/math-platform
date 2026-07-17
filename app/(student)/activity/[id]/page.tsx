import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ActivityRunner from "@/components/student/activity-runner";
import type { Activity } from "@/lib/types";

type ProgressRow = {
  completed: boolean;
  score: number | null;
  submission: { answer?: string; correct?: boolean } | null;
};

// 활동 실행 화면. 활동 데이터는 정답이 제거된 RPC(student_activities)로만 가져온다.
export default async function StudentActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: rows } = await supabase.rpc("student_activities", {
    p_activity_id: id,
  });
  const activity = (rows as Activity[] | null)?.[0];
  if (!activity) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: unit }, { data: progress }, { data: me }] = await Promise.all([
    supabase.from("units").select("id, title").eq("id", activity.unit_id).single(),
    supabase
      .from("progress")
      .select("completed, score, submission")
      .eq("activity_id", id)
      .maybeSingle<ProgressRow>(),
    supabase
      .from("profiles")
      .select("ai_consent_at")
      .eq("id", user!.id)
      .single<{ ai_consent_at: string | null }>(),
  ]);

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
      />
    </div>
  );
}
