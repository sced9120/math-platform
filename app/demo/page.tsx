import Link from "next/link";
import { getDemoSubject } from "@/lib/demo";
import DemoBanner from "@/components/demo-banner";

const TYPE_LABELS: Record<string, string> = {
  geogebra: "GeoGebra",
  content: "자료",
  problem: "문제",
  image: "사진",
  html: "체험",
};

// 체험판 — 학생이 보는 화면을 로그인 없이 그대로 둘러본다(저장·AI 없음)
export default async function DemoPage() {
  const data = await getDemoSubject();

  return (
    <div className="min-h-full bg-zinc-50">
      <DemoBanner />
      <div className="mx-auto max-w-4xl px-4 py-8">
        {!data ? (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
            아직 공개된 교과가 없습니다.
          </p>
        ) : (
          <>
            <p className="text-sm font-medium text-blue-600">내 교과</p>
            <h1 className="mt-1 text-2xl font-bold text-zinc-900">{data.subject.title}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              고등학교 {data.subject.grade}학년 · 활동 {data.activities.length}개 · 학생이 보는 화면
              그대로입니다.
            </p>

            <div className="mt-7 flex flex-col gap-7">
              {data.units
                .map((u) => ({
                  unit: u,
                  list: data.activities.filter((a) => a.unit_id === u.id),
                }))
                .filter((s) => s.list.length > 0)
                .map(({ unit, list }) => (
                  <section key={unit.id}>
                    <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-700">
                      <span className="h-4 w-1 rounded-full bg-blue-500" />
                      {unit.title}
                      <span className="font-normal text-zinc-400">활동 {list.length}개</span>
                    </h2>
                    <div className="flex flex-col gap-2">
                      {list.map((a, i) => (
                        <Link
                          key={a.id}
                          href={`/demo/${a.id}`}
                          className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-blue-400"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="w-5 shrink-0 text-sm text-zinc-400">{i + 1}</span>
                            <span className="shrink-0 rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                              {TYPE_LABELS[a.type] ?? a.type}
                            </span>
                            <span className="truncate font-medium text-zinc-900">{a.title}</span>
                          </div>
                          <span className="shrink-0 text-sm text-blue-600">열기 →</span>
                        </Link>
                      ))}
                    </div>
                  </section>
                ))}
            </div>

            <div className="mt-10 rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
              <p className="font-semibold text-zinc-900">체험판에서 빠진 것</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>진도 저장 · 완료 표시 (실제로는 학생별로 기록됩니다)</li>
                <li>&lsquo;내 생각 적기&rsquo; 저장 (실제로는 교사가 모아서 읽을 수 있습니다)</li>
                <li>AI 소크라테스식 문답 · 문제풀이 첨삭</li>
              </ul>
              <p className="mt-3">
                전체 기능을 쓰려면{" "}
                <Link
                  href="https://github.com/sced9120/math-platform"
                  className="font-medium text-blue-600 underline"
                >
                  저장소
                </Link>
                를 내 학교 계정으로 배포하면 됩니다. 5분이면 됩니다.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
