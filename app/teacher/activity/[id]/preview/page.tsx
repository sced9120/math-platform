import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ActivityPreview from "@/components/teacher/activity-preview";
import type { Activity, Unit } from "@/lib/types";

const TYPE_LABELS: Record<Activity["type"], string> = {
  geogebra: "GeoGebra",
  content: "자료/설명",
  problem: "문제 풀이",
  image: "사진/이미지",
  html: "HTML 콘텐츠",
};

// 교사용 미리보기 — 학생이 보는 화면을 그대로 확인한다.
// 활동은 activities 테이블에서 직접 읽는다(교사 RLS 접근). 정답 포함이지만
// 미리보기 컴포넌트가 학생 화면과 동일하게 렌더하고 정답은 별도 표시한다.
export default async function TeacherActivityPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: activity } = await supabase
    .from("activities")
    .select("*")
    .eq("id", id)
    .single<Activity>();
  if (!activity) notFound();

  const { data: unit } = await supabase
    .from("units")
    .select("id, title, grade")
    .eq("id", activity.unit_id)
    .single<Pick<Unit, "id" | "title" | "grade">>();

  return (
    <div>
      <Link
        href={`/teacher/units/${activity.unit_id}`}
        className="text-sm text-blue-600 hover:underline"
      >
        ← {unit?.title ?? "단원"} 활동 관리
      </Link>

      <div className="mt-1 mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-zinc-900">{activity.title}</h2>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
          {TYPE_LABELS[activity.type]}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            activity.is_published
              ? "bg-green-100 text-green-700"
              : "bg-zinc-100 text-zinc-500"
          }`}
        >
          {activity.is_published ? "공개" : "비공개"}
        </span>
      </div>

      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
        👀 <b>미리보기</b> — 학생에게 보이는 화면입니다. 저장·채점·AI는 동작하지
        않습니다.
      </div>

      <ActivityPreview activity={activity} />
    </div>
  );
}
