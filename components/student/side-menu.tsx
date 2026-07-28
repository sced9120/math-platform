"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// 학생 사이드메뉴 (햄버거로 열고 닫음)
// 구성: 내 교과(교과 → 단원 → 활동 트리) + AI 자유 모드 두 개
// 목록은 처음 열 때 한 번만 불러온다 (페이지 이동 속도에 영향 없음)

type MenuSubject = { id: string; title: string; order_index: number };
type MenuUnit = {
  id: string;
  title: string;
  grade: number;
  order_index: number;
  subject_id: string | null;
};
type MenuActivity = {
  id: string;
  unit_id: string;
  title: string;
  order_index: number;
};

export default function SideMenu({ grade }: { grade: number | null }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [data, setData] = useState<{
    subjects: MenuSubject[];
    units: MenuUnit[];
    activities: MenuActivity[];
  } | null>(null);

  async function handleOpen() {
    setOpen(true);
    if (data) return;
    const supabase = createClient();
    const [subjectsRes, unitsRes, activitiesRes] = await Promise.all([
      supabase.from("subjects").select("id, title, order_index").order("order_index"),
      // subject_id 는 마이그레이션 0010 이후에만 있으므로 컬럼을 나열하지 않는다
      supabase.from("units").select("*").order("order_index"),
      supabase.rpc("student_activities"),
    ]);
    const subjects = (subjectsRes.data as MenuSubject[] | null) ?? [];
    setData({
      subjects,
      units: (unitsRes.data as MenuUnit[] | null) ?? [],
      activities: (activitiesRes.data as MenuActivity[] | null) ?? [],
    });
    // 교과가 하나뿐이면 자동으로 펼쳐 준다
    if (subjects.length === 1) setExpanded(new Set([subjects[0].id]));
  }

  function close() {
    setOpen(false);
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const units = data?.units ?? [];
  const activities = data?.activities ?? [];
  const hasActivity = (unitId: string) => activities.some((a) => a.unit_id === unitId);

  // 나에게 부여된 활동이 하나라도 있는 교과만
  const visibleSubjects = (data?.subjects ?? []).filter((s) =>
    units.some((u) => u.subject_id === s.id && hasActivity(u.id))
  );
  // 교과에 속하지 않은 옛 단원
  const looseUnits = units.filter((u) => !u.subject_id && hasActivity(u.id));

  const aiLink = (href: string, label: string, desc: string) => (
    <Link
      href={href}
      onClick={close}
      className="block rounded-md px-3 py-2 hover:bg-blue-50"
    >
      <span className="block text-sm font-medium text-zinc-800">{label}</span>
      <span className="block text-xs text-zinc-400">{desc}</span>
    </Link>
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

            <div className="flex flex-col gap-1 border-b border-zinc-200 p-2">
              <p className="px-3 pt-1 text-xs font-medium text-zinc-400">AI 도우미</p>
              {aiLink("/socratic", "💬 소크라테스식 문답", "무엇이든 수학 질문하기")}
              {aiLink("/feedback", "✏️ 문제풀이 첨삭", "내 문제·풀이로 첨삭 받기")}
            </div>

            {/* 내 교과 → 단원 → 활동 */}
            <div className="flex-1 overflow-y-auto p-3">
              <p className="mb-2 text-xs font-medium text-zinc-400">
                📚 내 교과{grade ? ` · ${grade}학년` : ""}
              </p>

              {data === null ? (
                <p className="text-sm text-zinc-400">불러오는 중...</p>
              ) : visibleSubjects.length === 0 && looseUnits.length === 0 ? (
                <p className="text-sm text-zinc-400">공개된 활동이 없습니다.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {visibleSubjects.map((s) => {
                    const isOpen = expanded.has(s.id);
                    const subjectUnits = units.filter(
                      (u) => u.subject_id === s.id && hasActivity(u.id)
                    );
                    return (
                      <li key={s.id}>
                        <div className="flex items-center">
                          <button
                            onClick={() => toggle(s.id)}
                            aria-expanded={isOpen}
                            className="rounded-md px-2 py-2 text-zinc-400 hover:bg-zinc-100"
                          >
                            <span className="inline-block w-3 text-xs">
                              {isOpen ? "▾" : "▸"}
                            </span>
                          </button>
                          <Link
                            href={`/subject/${s.id}`}
                            onClick={close}
                            className="flex-1 rounded-md px-2 py-2 text-sm font-semibold text-zinc-800 hover:bg-blue-50 hover:text-blue-700"
                          >
                            {s.title}
                          </Link>
                        </div>

                        {isOpen && (
                          <div className="ml-4 border-l border-zinc-200 pl-2">
                            {subjectUnits.map((u) => (
                              <div key={u.id} className="mt-1">
                                <p className="px-2 py-1 text-xs font-medium text-zinc-500">
                                  {u.title}
                                </p>
                                <ul className="flex flex-col">
                                  {activities
                                    .filter((a) => a.unit_id === u.id)
                                    .map((a) => (
                                      <li key={a.id}>
                                        <Link
                                          href={`/activity/${a.id}`}
                                          onClick={close}
                                          className="block rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:bg-blue-50 hover:text-blue-700"
                                        >
                                          {a.title}
                                        </Link>
                                      </li>
                                    ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}

                  {looseUnits.length > 0 && (
                    <li className="mt-3">
                      <p className="px-3 pb-1 text-xs font-medium text-zinc-400">기타 단원</p>
                      <ul className="flex flex-col gap-1">
                        {looseUnits.map((u) => (
                          <li key={u.id}>
                            <Link
                              href={`/unit/${u.id}`}
                              onClick={close}
                              className="block rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-blue-50 hover:text-blue-700"
                            >
                              {u.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </li>
                  )}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
