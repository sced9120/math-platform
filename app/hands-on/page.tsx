import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SCREEN_TYPE_LABEL } from "@/lib/screens";
import { manipulativePath, type Manipulative } from "@/lib/manipulatives";

export const metadata = { title: "만져보는 수학" };

// 만져보는 수학 목록 — 누구나, 로그인 없이.
// 공개된 자료만 보인다 (RLS manipulatives_public_read 가 거른다).
export default async function HandsOnListPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("manipulatives")
    .select("id, slug, title, summary, topic, order_index, type")
    .eq("is_published", true)
    .order("topic")
    .order("order_index");

  const items = (data as Pick<
    Manipulative,
    "id" | "slug" | "title" | "summary" | "topic" | "order_index" | "type"
  >[] | null) ?? [];

  const groups = new Map<string, typeof items>();
  for (const m of items) {
    const k = m.topic || "기타";
    groups.set(k, [...(groups.get(k) ?? []), m]);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">🖐 만져보는 수학</h1>
        <p className="mt-2 text-sm text-zinc-600">
          점을 끌고, 값을 바꿔 보며 수학을 손으로 확인하는 자료입니다.
          로그인 없이 누구나 쓸 수 있고, 링크만 나눠 주면 바로 열립니다.
          <br />
          학생 기록이 필요하면 선생님이{" "}
          <Link href="/signup" className="text-blue-600 underline">
            가입
          </Link>
          해 내 학급의 활동에 추가하세요.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
          아직 공개된 자료가 없습니다.
        </p>
      ) : (
        [...groups.entries()].map(([topic, list]) => (
          <section key={topic}>
            <h2 className="mb-3 text-sm font-semibold text-zinc-500">{topic}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((m) => (
                <Link
                  key={m.id}
                  href={manipulativePath(m.slug)}
                  className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-blue-400"
                >
                  <h3 className="font-semibold text-zinc-900">{m.title}</h3>
                  {m.summary && (
                    <p className="mt-1 text-sm leading-relaxed text-zinc-600">{m.summary}</p>
                  )}
                  <p className="mt-3 text-xs text-zinc-400">{SCREEN_TYPE_LABEL[m.type]}</p>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
