import Link from "next/link";
import { notFound } from "next/navigation";
import { getDemoActivity } from "@/lib/demo";
import DemoBanner from "@/components/demo-banner";
import HtmlActivityFrame from "@/components/student/html-activity-frame";

// 체험판 활동 실행 — 학생 화면과 같게 보이되, 저장·AI 는 없다.
export default async function DemoActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const activity = await getDemoActivity(id);
  if (!activity) notFound();

  const content = activity.content as {
    html?: string;
    height?: number;
    body?: string;
    question?: string;
    response_prompt?: string;
  };

  return (
    <div className="min-h-full bg-zinc-50">
      <DemoBanner />
      <div className="mx-auto max-w-4xl px-4 py-6">
        <Link href="/demo" className="text-sm text-blue-600 hover:underline">
          ← {activity.subjectTitle}
        </Link>
        <p className="mt-2 text-xs font-medium text-zinc-400">{activity.unitTitle}</p>
        <h1 className="mb-4 text-lg font-semibold text-zinc-900">{activity.title}</h1>

        {activity.type === "html" && content.html ? (
          <HtmlActivityFrame
            html={content.html}
            title={activity.title}
            initialHeight={content.height}
          />
        ) : activity.type === "content" && content.body ? (
          <div className="whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-6 leading-relaxed text-zinc-800">
            {content.body}
          </div>
        ) : content.question ? (
          <div className="whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-6 leading-relaxed text-zinc-800">
            {content.question}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
            체험판에서는 이 유형을 보여 주지 않습니다.
          </p>
        )}

        {/* 서술 문항은 보여 주되, 저장되지 않음을 분명히 한다 */}
        {content.response_prompt && (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-sm font-medium text-zinc-800">✏️ 내 생각 적기</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">
              {content.response_prompt}
            </p>
            <textarea
              readOnly
              placeholder="체험판에서는 작성·저장할 수 없습니다. 실제 수업에서는 여기에 쓴 글이 저장되고, 선생님이 모아서 읽을 수 있어요."
              className="mt-3 h-24 w-full cursor-not-allowed rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-500"
            />
          </div>
        )}

        <p className="mt-6 text-center text-xs text-zinc-400">
          이 활동은 <Link href="/demo" className="underline">체험판</Link> 으로 열렸습니다 · 저장되지 않습니다
        </p>
      </div>
    </div>
  );
}
