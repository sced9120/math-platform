import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ScreenBody from "@/components/student/screen-body";
import CopyLinkButton from "@/components/copy-link-button";
import { manipulativePath, schoolLevelLabel, type Manipulative } from "@/lib/manipulatives";

// 만져보는 수학 한 가지 — 링크만 있으면 누구나 연다. 아무것도 저장하지 않는다.
export default async function HandsOnItemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("manipulatives")
    .select("id, slug, title, summary, topic, school_level, type, config")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle<
      Pick<Manipulative, "id" | "slug" | "title" | "summary" | "topic" | "school_level" | "type" | "config">
    >();
  if (!item) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/hands-on?level=${item.school_level}`}
        className="text-sm text-blue-600 hover:underline"
      >
        ← 만져보는 수학 · {schoolLevelLabel(item.school_level)}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-zinc-400">
            {schoolLevelLabel(item.school_level)}
            {item.topic ? ` · ${item.topic}` : ""}
          </p>
          <h1 className="text-xl font-bold text-zinc-900">{item.title}</h1>
          {item.summary && <p className="mt-1 text-sm text-zinc-600">{item.summary}</p>}
        </div>
        <CopyLinkButton path={manipulativePath(item.slug)} />
      </div>

      <ScreenBody screen={{ type: item.type, config: item.config, title: item.title }} />

      <p className="mt-2 text-center text-xs text-zinc-400">
        만져보는 수학은 기록을 저장하지 않습니다 · 학생 기록이 필요하면 선생님 계정으로 내 활동에
        추가해 쓰세요
      </p>
    </div>
  );
}
