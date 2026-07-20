"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// 학생 사이드메뉴 (햄버거로 열고 닫음)
// 구성: 활동(단원 목록) / 소크라테스식 문답 / 문제풀이 첨삭
// 데이터는 처음 열 때 한 번만 불러온다 (페이지 이동 속도에 영향 없음)

type MenuUnit = { id: string; title: string; grade: number; order_index: number };
type MenuActivity = {
  id: string;
  unit_id: string;
  type: string;
  title: string;
  order_index: number;
};

type Section = "units" | "socratic" | "feedback";

export default function SideMenu({ grade }: { grade: number | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{
    units: MenuUnit[];
    activities: MenuActivity[];
  } | null>(null);
  const [section, setSection] = useState<Section>("units");

  async function handleOpen() {
    setOpen(true);
    if (data) return;
    const supabase = createClient();
    const [{ data: units }, { data: activities }] = await Promise.all([
      supabase
        .from("units")
        .select("id, title, grade, order_index")
        .order("order_index"),
      supabase.rpc("student_activities"),
    ]);
    setData({
      units: (units as MenuUnit[]) ?? [],
      activities: (activities as MenuActivity[]) ?? [],
    });
  }

  function close() {
    setOpen(false);
  }

  // 나에게 부여된 활동이 있는 단원만
  const visibleUnits =
    data?.units.filter((u) =>
      data.activities.some((a) => a.unit_id === u.id)
    ) ?? [];
  const problemActivities =
    data?.activities.filter((a) => a.type === "problem") ?? [];
  const unitTitle = (id: string) =>
    data?.units.find((u) => u.id === id)?.title ?? "";

  const sectionBtn = (key: Section, label: string) => (
    <button
      onClick={() => setSection(key)}
      className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium ${
        section === key
          ? "bg-blue-50 text-blue-700"
          : "text-zinc-700 hover:bg-zinc-100"
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      {/* 햄버거 버튼 */}
      <button
        onClick={handleOpen}
        aria-label="메뉴 열기"
        className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-zinc-600 hover:bg-zinc-100"
      >
        ☰
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          {/* 배경 클릭 시 닫기 */}
          <div className="absolute inset-0 bg-black/30" onClick={close} />

          {/* 패널 */}
          <aside className="relative z-10 flex h-full w-72 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <span className="font-bold text-zinc-900">메뉴</span>
              <button
                onClick={close}
                aria-label="메뉴 닫기"
                className="rounded-md px-2 py-1 text-zinc-500 hover:bg-zinc-100"
              >
                ✕
              </button>
            </div>

            {/* 상위 메뉴 */}
            <div className="flex flex-col gap-1 border-b border-zinc-200 p-2">
              {sectionBtn("units", "📚 활동")}
              {sectionBtn("socratic", "💬 소크라테스식 문답")}
              {sectionBtn("feedback", "✏️ 문제풀이 첨삭")}
            </div>

            {/* 하위 목록 */}
            <div className="flex-1 overflow-y-auto p-3">
              {data === null ? (
                <p className="text-sm text-zinc-400">불러오는 중...</p>
              ) : (
                <>
                  {section === "units" && (
                    <div>
                      {grade && (
                        <p className="mb-2 text-xs font-medium text-zinc-400">
                          {grade}학년
                        </p>
                      )}
                      {visibleUnits.length === 0 ? (
                        <p className="text-sm text-zinc-400">
                          공개된 활동이 없습니다.
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {visibleUnits.map((u, i) => (
                            <li key={u.id}>
                              <Link
                                href={`/unit/${u.id}`}
                                onClick={close}
                                className="block rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-blue-50 hover:text-blue-700"
                              >
                                활동{i + 1} {u.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {section === "socratic" && (
                    <div>
                      <p className="mb-2 text-xs text-zinc-400">
                        활동을 고르면 AI 튜터와 바로 문답을 시작합니다.
                      </p>
                      <ul className="flex flex-col gap-1">
                        {(data.activities ?? []).map((a) => (
                          <li key={a.id}>
                            <Link
                              href={`/activity/${a.id}?tab=socratic`}
                              onClick={close}
                              className="block rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-blue-50 hover:text-blue-700"
                            >
                              <span className="block text-xs text-zinc-400">
                                {unitTitle(a.unit_id)}
                              </span>
                              {a.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {section === "feedback" && (
                    <div>
                      <p className="mb-2 text-xs text-zinc-400">
                        문제를 고르면 내 풀이를 적고 AI 첨삭을 받을 수 있습니다.
                      </p>
                      {problemActivities.length === 0 ? (
                        <p className="text-sm text-zinc-400">
                          공개된 문제 활동이 없습니다.
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {problemActivities.map((a) => (
                            <li key={a.id}>
                              <Link
                                href={`/activity/${a.id}?tab=feedback`}
                                onClick={close}
                                className="block rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-blue-50 hover:text-blue-700"
                              >
                                <span className="block text-xs text-zinc-400">
                                  {unitTitle(a.unit_id)}
                                </span>
                                {a.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
