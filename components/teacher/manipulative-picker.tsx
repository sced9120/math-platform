"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SCREEN_TYPE_LABEL } from "@/lib/screens";
import type { Manipulative } from "@/lib/manipulatives";

// 만져보는 수학 목록에서 하나를 고른다 (활동 편집기의 "활동 추가"에서 연다).
// 공개된 자료만 보인다 — RLS(manipulatives_public_read)가 거른다.
export default function ManipulativePicker({
  onPick,
  onClose,
  busy,
}: {
  onPick: (m: Manipulative) => void;
  onClose: () => void;
  busy?: boolean;
}) {
  const [items, setItems] = useState<Manipulative[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    createClient()
      .from("manipulatives")
      .select("*")
      .eq("is_published", true)
      .order("topic")
      .order("order_index")
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setError("목록을 불러오지 못했습니다. (마이그레이션 0016 실행 여부 확인)");
        else setItems((data as Manipulative[]) ?? []);
      });
    return () => {
      alive = false;
    };
  }, []);

  const groups = new Map<string, Manipulative[]>();
  for (const m of items ?? []) {
    const k = m.topic || "기타";
    groups.set(k, [...(groups.get(k) ?? []), m]);
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-800">
          🖐 만져보는 수학에서 가져오기
          <span className="ml-2 font-normal text-zinc-500">
            고르면 이 소단원 끝에 활동 한 화면으로 복사됩니다
          </span>
        </p>
        <button onClick={onClose} className="text-sm text-zinc-500 hover:text-zinc-800">
          닫기
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : items === null ? (
        <p className="text-sm text-zinc-400">불러오는 중...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-500">아직 공개된 자료가 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {[...groups.entries()].map(([topic, list]) => (
            <div key={topic}>
              <p className="mb-1 text-xs font-medium text-zinc-500">{topic}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {list.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onPick(m)}
                    disabled={busy}
                    className="rounded-lg border border-zinc-200 bg-white p-3 text-left hover:border-blue-400 disabled:opacity-50"
                  >
                    <span className="block text-sm font-medium text-zinc-900">{m.title}</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      {SCREEN_TYPE_LABEL[m.type]}
                      {m.summary ? ` · ${m.summary}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
