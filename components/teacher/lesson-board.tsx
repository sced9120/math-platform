"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  byRoster,
  flatten,
  handQueue,
  isStudent,
  lessonChannel,
  type StudentPresence,
  type TeacherPresence,
} from "@/lib/lesson";
import Icon from "@/components/icon";

// 교사 쪽 수업 진행판.
// 들어와 있는 학생이 각자 몇 번째 화면에 있는지 한눈에 보고,
// 전원을 같은 화면으로 부르거나 화면을 덮는다.

export default function LessonBoard({
  activityId,
  activityTitle,
  screenTitles,
  me,
}: {
  activityId: string;
  activityTitle: string;
  /** 화면 제목들 — 몇 번 화면인지 눌러 부를 수 있게 */
  screenTitles: string[];
  me: { id: string; name: string };
}) {
  const chanRef = useRef<RealtimeChannel | null>(null);
  const [students, setStudents] = useState<StudentPresence[]>([]);
  const [blank, setBlank] = useState(false);
  const [goto, setGoto] = useState<{ index: number; seq: number } | null>(null);
  const [open, setOpen] = useState(false); // 수업을 열었는가

  const total = screenTitles.length;

  // 내 상태(가리기·부르기)를 presence 에 실어 보낸다
  const push = useCallback(
    (next: Partial<TeacherPresence>) => {
      const payload: TeacherPresence = {
        role: "teacher",
        userId: me.id,
        name: me.name,
        blank,
        gotoIndex: goto?.index ?? null,
        gotoSeq: goto?.seq ?? 0,
        ...next,
      };
      void chanRef.current?.track(payload);
    },
    [me.id, me.name, blank, goto]
  );

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    const ch = supabase.channel(lessonChannel(activityId), {
      config: { presence: { key: me.id } },
    });
    chanRef.current = ch;

    ch.on("presence", { event: "sync" }, () => {
      const all = flatten(ch.presenceState() as Record<string, unknown[]>);
      setStudents(all.filter(isStudent).sort(byRoster));
    });

    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void ch.track({
          role: "teacher",
          userId: me.id,
          name: me.name,
          blank: false,
          gotoIndex: null,
          gotoSeq: 0,
        } satisfies TeacherPresence);
      }
    });

    return () => {
      void supabase.removeChannel(ch);
      chanRef.current = null;
      setStudents([]);
    };
  }, [open, activityId, me.id, me.name]);

  // 상태가 바뀌면 바로 알린다
  useEffect(() => {
    if (open) push({});
  }, [blank, goto, open, push]);

  const hands = handQueue(students);

  // 화면별로 몇 명이 있는지
  const perScreen = new Array(Math.max(total, 1)).fill(0) as number[];
  for (const s of students) {
    if (s.screenIndex >= 0 && s.screenIndex < perScreen.length) {
      perScreen[s.screenIndex] += 1;
    }
  }
  const doneCount = students.filter((s) => s.doneAt != null).length;

  if (!open) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">
          <Icon name="users" size={18} /> 함께 수업하기
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          수업을 열면 이 활동을 펼친 학생들이 자동으로 들어옵니다. 누가 몇 번째
          화면에 있는지 보이고, 전원을 같은 화면으로 부르거나 화면을 덮을 수
          있습니다.
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          학생은 따로 할 일이 없습니다. 활동을 열어 두기만 하면 됩니다.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="mt-4 rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          수업 열기
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 상태줄 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
        <span className="flex items-center gap-2 font-medium text-emerald-900">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
          </span>
          수업 중 · {activityTitle}
        </span>
        <span className="text-sm text-emerald-800">
          들어온 학생 <b>{students.length}</b>명
          {doneCount > 0 && <> · 완료 <b>{doneCount}</b>명</>}
        </span>
        <button
          onClick={() => {
            setBlank(false);
            setOpen(false);
          }}
          className="ml-auto rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          수업 닫기
        </button>
      </div>

      {/* 화면 가리기 */}
      <div
        className={`flex flex-wrap items-center gap-3 rounded-lg border p-4 ${
          blank ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-white"
        }`}
      >
        <button
          onClick={() => setBlank((v) => !v)}
          className={`rounded-md px-5 py-2.5 text-sm font-semibold ${
            blank
              ? "bg-white text-zinc-900 hover:bg-zinc-100"
              : "bg-zinc-900 text-white hover:bg-zinc-800"
          }`}
        >
          {blank ? "화면 돌려주기" : "화면 가리기"}
        </button>
        <span className={`text-sm ${blank ? "text-zinc-300" : "text-zinc-600"}`}>
          {blank ? (
            <>
              학생 화면이 덮여 있습니다 — <b>보기도 만지기도 못 합니다.</b>{" "}
              하던 자리는 그대로 남아 있습니다.
            </>
          ) : (
            <>
              학생 화면을 덮고 입력을 막습니다. 설명할 때 쓰세요.
              <br />
              <span className="text-xs text-zinc-500">
                학생에게는 검은 화면에 <b>&ldquo;잠시 멈추고 앞을 보세요.&rdquo;</b> 라고 뜹니다.
              </span>
            </>
          )}
        </span>
      </div>

      {/* 같이 넘기기 */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-zinc-900">
          <Icon name="arrow" /> 같이 넘기기
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          번호를 누르면 학생 전원이 그 화면으로 갑니다. 그 뒤에는 각자 자유롭게
          움직일 수 있습니다.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {screenTitles.map((t, i) => {
            const here = perScreen[i] ?? 0;
            const called = goto?.index === i;
            return (
              <button
                key={i}
                title={t || `${i + 1}번 화면`}
                onClick={() =>
                  setGoto({ index: i, seq: (goto?.seq ?? 0) + 1 })
                }
                className={`relative flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-sm transition ${
                  called
                    ? "border-blue-600 bg-blue-600 font-bold text-white"
                    : here > 0
                      ? "border-blue-300 bg-blue-50 text-blue-800"
                      : "border-zinc-300 bg-white text-zinc-500 hover:bg-zinc-50"
                }`}
              >
                {i + 1}
                {here > 0 && (
                  <span
                    className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                      called ? "bg-white text-blue-700" : "bg-blue-600 text-white"
                    }`}
                  >
                    {here}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {goto && (
          <p className="mt-2 text-xs text-zinc-500">
            {goto.index + 1}번 화면으로 불렀습니다
            {screenTitles[goto.index] ? ` — ${screenTitles[goto.index]}` : ""}
          </p>
        )}
      </div>

      {/* 손들기 */}
      {hands.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-900">
            ✋ 손든 학생 {hands.length}명 — 누른 순서
          </h3>
          <ol className="mt-2 flex flex-wrap gap-2">
            {hands.map((s, i) => (
              <li
                key={s.userId}
                className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-sm"
              >
                <span className="font-bold text-amber-700">{i + 1}</span>
                <span className="font-medium text-zinc-900">{s.name}</span>
                <span className="text-xs text-zinc-500">
                  {s.screenIndex + 1}번 화면
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 참여 현황 */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-zinc-900">
          <Icon name="graduation" /> 참여 현황
        </h3>
        {students.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            아직 들어온 학생이 없습니다. 학생이 이 활동을 열면 여기에 나타납니다.
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {students.map((s) => (
              <li
                key={s.userId}
                className={`flex min-w-28 flex-col gap-0.5 rounded-md border px-2.5 py-1.5 ${
                  s.doneAt != null
                    ? "border-emerald-300 bg-emerald-50"
                    : s.handAt != null
                      ? "border-amber-300 bg-amber-50"
                      : "border-zinc-200 bg-zinc-50"
                }`}
              >
                <span className="flex items-center gap-1 text-sm font-medium text-zinc-900">
                  {s.handAt != null && <span>✋</span>}
                  {s.name}
                  {s.doneAt != null && (
                    <Icon name="check" size={13} className="text-emerald-600" />
                  )}
                </span>
                <span className="text-xs text-zinc-500">
                  {s.screenTotal > 0
                    ? `${s.screenIndex + 1} / ${s.screenTotal}`
                    : "보는 중"}
                </span>
                {/* 진행 막대 */}
                <span className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-zinc-200">
                  <span
                    className={`block h-full rounded-full ${
                      s.doneAt != null ? "bg-emerald-500" : "bg-blue-500"
                    }`}
                    style={{
                      width:
                        s.screenTotal > 0
                          ? `${((s.screenIndex + 1) / s.screenTotal) * 100}%`
                          : "0%",
                    }}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
