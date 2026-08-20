"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SCREEN_TYPE_LABEL, type Screen, type ScreenType } from "@/lib/screens";

type LibraryRow = Screen & {
  activity_id: string;
  activities: { title: string; unit_id: string; units: { title: string } | null } | null;
};

// 이미 만들어 둔 활동을 골라 지금 소단원으로 복사해 온다.
// 아카이브(정적 사이트)를 뒤질 필요 없이 DB 안에서 끝난다 — 활동은 이미 전부 여기 있다.
export default function ScreenLibrary({
  currentActivityId,
  onPick,
  onClose,
}: {
  currentActivityId: string;
  onPick: (row: Screen) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<LibraryRow[] | null>(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState<ScreenType | "">("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await createClient()
        .from("activity_screens")
        .select("*, activities(title, unit_id, units(title))")
        .neq("activity_id", currentActivityId)
        .order("order_index")
        .limit(500);
      if (!alive) return;
      if (error) setError("목록을 읽지 못했습니다.");
      else setRows((data as LibraryRow[]) ?? []);
    })();
    return () => {
      alive = false;
    };
  }, [currentActivityId]);

  const filtered = (rows ?? []).filter((r) => {
    if (type && r.type !== type) return false;
    if (!q.trim()) return true;
    const hay = `${r.title} ${r.sheet} ${r.activities?.title ?? ""}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-blue-300 bg-blue-50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-zinc-900">다른 활동에서 가져오기</span>
        <button onClick={onClose} className="ml-auto text-sm text-zinc-500 hover:underline">
          닫기
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="활동 이름·소단원·학습지로 찾기"
          className="min-w-56 flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ScreenType | "")}
          className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        >
          <option value="">유형 전체</option>
          {Object.entries(SCREEN_TYPE_LABEL).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {rows === null && <p className="text-sm text-zinc-500">불러오는 중...</p>}
      {rows !== null && filtered.length === 0 && (
        <p className="text-sm text-zinc-500">
          가져올 활동이 없습니다. (다른 소단원에서 활동을 만들면 여기에 보입니다)
        </p>
      )}

      <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
        {filtered.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
          >
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
              {SCREEN_TYPE_LABEL[r.type]}
            </span>
            <span className="font-medium text-zinc-900">
              {r.title || <span className="text-zinc-400">이름 없음</span>}
            </span>
            <span className="text-xs text-zinc-500">
              {r.activities?.units?.title ? `${r.activities.units.title} · ` : ""}
              {r.activities?.title ?? ""}
            </span>
            {r.questions?.length > 0 && (
              <span className="text-xs text-zinc-400">질문 {r.questions.length}개</span>
            )}
            <button
              onClick={() => onPick(r)}
              className="ml-auto rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
            >
              가져오기
            </button>
          </li>
        ))}
      </ul>

      <p className="text-xs text-zinc-500">
        가져오면 <b>사본</b>이 만들어집니다. 여기서 고쳐도 원래 활동은 그대로입니다.
      </p>
    </div>
  );
}
