"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import HtmlActivityFrame, {
  type ScreenInfo,
} from "@/components/student/html-activity-frame";
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
//  - 위쪽에 조작 줄(가로 한 줄), 아래쪽에 학생이 보는 화면 그대로.
//    창을 두 개 띄우지 않아도 되도록 교사도 같은 활동을 직접 만져 가며 시연한다.
//  - 조작 줄은 스크롤해도 따라붙는다(활동이 길어도 버튼을 찾으러 올라가지 않게).

export default function LessonBoard({
  activityId,
  activityTitle,
  screenTitles,
  html,
  me,
}: {
  activityId: string;
  activityTitle: string;
  /** 화면 제목들 — 몇 번 화면인지 눌러 부를 수 있게 */
  screenTitles: string[];
  /** 활동 HTML — 있으면 교사 화면 아래에 학생이 보는 그대로 띄운다 */
  html?: string;
  me: { id: string; name: string };
}) {
  const chanRef = useRef<RealtimeChannel | null>(null);
  const [students, setStudents] = useState<StudentPresence[]>([]);
  const [blank, setBlank] = useState(false);
  const [goto, setGoto] = useState<{ index: number; seq: number } | null>(null);
  const [open, setOpen] = useState(false); // 수업을 열었는가
  const [rosterOpen, setRosterOpen] = useState(false);
  // 교사가 지금 보고 있는 화면 (아래 미리보기에서 직접 넘긴 것)
  const [mine, setMine] = useState<ScreenInfo | null>(null);

  const total = screenTitles.length;

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

  useEffect(() => {
    if (open) push({});
  }, [blank, goto, open, push]);

  const call = useCallback(
    (index: number) => setGoto((g) => ({ index, seq: (g?.seq ?? 0) + 1 })),
    []
  );

  const hands = handQueue(students);
  const perScreen = new Array(Math.max(total, 1)).fill(0) as number[];
  for (const s of students) {
    if (s.screenIndex >= 0 && s.screenIndex < perScreen.length) {
      perScreen[s.screenIndex] += 1;
    }
  }
  const doneCount = students.filter((s) => s.doneAt != null).length;

  // ── 수업 열기 전 ────────────────────────────────────
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
        <p className="mt-1 text-sm text-zinc-600">
          아래에 <b>학생이 보는 화면</b>이 그대로 뜹니다. 직접 만져 가며 시연하고,
          원할 때 <b>&lsquo;지금 화면으로 모으기&rsquo;</b>로 학생들을 부르면 됩니다.
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

  const mineLabel = mine ? mine.index + 1 : null;

  return (
    <div className="flex flex-col gap-2">
      {/* ── 조작 줄 (스크롤해도 붙어 있다) ───────────────── */}
      <div className="sticky top-0 z-30 flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white/95 p-2 shadow-sm backdrop-blur">
        {/* 1행 — 상태 · 가리기 · 닫기 */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 whitespace-nowrap rounded-md bg-emerald-50 px-2.5 py-1.5 text-sm font-medium text-emerald-900">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
            </span>
            학생 <b>{students.length}</b>
            {doneCount > 0 && (
              <span className="text-emerald-700">· 완료 {doneCount}</span>
            )}
          </span>

          <button
            onClick={() => setBlank((v) => !v)}
            className={`whitespace-nowrap rounded-md px-3.5 py-1.5 text-sm font-semibold ${
              blank
                ? "bg-amber-500 text-white hover:bg-amber-600"
                : "bg-zinc-900 text-white hover:bg-zinc-800"
            }`}
          >
            {blank ? "화면 돌려주기" : "화면 가리기"}
          </button>

          {blank && (
            <span className="text-xs text-amber-700">
              학생 화면에 <b>&ldquo;잠시 멈추고 앞을 보세요.&rdquo;</b> — 입력도 막혀 있습니다
            </span>
          )}

          <button
            onClick={() => setRosterOpen((v) => !v)}
            aria-expanded={rosterOpen}
            className="whitespace-nowrap rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            참여 현황
            <Icon
              name="chevron"
              size={13}
              className={`ml-1 ${rosterOpen ? "" : "-rotate-90"}`}
            />
          </button>

          <button
            onClick={() => {
              setBlank(false);
              setOpen(false);
            }}
            className="ml-auto whitespace-nowrap rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            수업 닫기
          </button>
        </div>

        {/* 2행 — 같이 넘기기 */}
        {total > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => mine && call(mine.index)}
              disabled={!mine}
              className="whitespace-nowrap rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
            >
              <Icon name="arrow" size={14} /> 지금 화면
              {mineLabel ? ` (${mineLabel}번)` : ""}으로 모으기
            </button>

            <span className="mx-1 h-5 w-px bg-zinc-200" />

            <div className="flex flex-1 flex-wrap items-center gap-1">
              {screenTitles.map((t, i) => {
                const here = perScreen[i] ?? 0;
                const called = goto?.index === i;
                const atMine = mine?.index === i;
                return (
                  <button
                    key={i}
                    title={t || `${i + 1}번 화면`}
                    onClick={() => call(i)}
                    className={`relative flex h-7 min-w-7 items-center justify-center rounded border px-1.5 text-xs transition ${
                      called
                        ? "border-blue-600 bg-blue-600 font-bold text-white"
                        : atMine
                          ? "border-blue-400 bg-white font-semibold text-blue-700"
                          : here > 0
                            ? "border-blue-200 bg-blue-50 text-blue-800"
                            : "border-zinc-200 bg-white text-zinc-400 hover:bg-zinc-50"
                    }`}
                  >
                    {i + 1}
                    {here > 0 && (
                      <span
                        className={`absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 text-[9px] font-bold ${
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
          </div>
        )}

        {/* 3행 — 손든 학생 (있을 때만) */}
        {hands.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1.5">
            <span className="whitespace-nowrap text-xs font-semibold text-amber-900">
              ✋ 손든 학생 {hands.length}
            </span>
            {hands.map((s, i) => (
              <span
                key={s.userId}
                className="flex items-center gap-1 rounded border border-amber-300 bg-white px-1.5 py-0.5 text-xs"
              >
                <b className="text-amber-700">{i + 1}</b>
                <span className="font-medium text-zinc-900">{s.name}</span>
                <span className="text-zinc-400">{s.screenIndex + 1}번</span>
              </span>
            ))}
          </div>
        )}

        {/* 참여 현황 — 접었다 폈다 */}
        {rosterOpen && (
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2">
            {students.length === 0 ? (
              <p className="text-xs text-zinc-500">
                아직 들어온 학생이 없습니다. 학생이 이 활동을 열면 여기에 나타납니다.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {students.map((s) => (
                  <li
                    key={s.userId}
                    title={s.screenTitle}
                    className={`flex items-center gap-1.5 rounded border px-1.5 py-1 text-xs ${
                      s.doneAt != null
                        ? "border-emerald-300 bg-emerald-50"
                        : s.handAt != null
                          ? "border-amber-300 bg-amber-50"
                          : "border-zinc-200 bg-white"
                    }`}
                  >
                    {s.handAt != null && <span>✋</span>}
                    <span className="font-medium text-zinc-900">{s.name}</span>
                    <span className="text-zinc-400">
                      {s.screenTotal > 0 ? `${s.screenIndex + 1}/${s.screenTotal}` : "—"}
                    </span>
                    {s.doneAt != null && (
                      <Icon name="check" size={11} className="text-emerald-600" />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* ── 학생이 보는 화면 ────────────────────────────── */}
      {html ? (
        <div className="flex flex-col gap-1">
          <p className="px-0.5 text-xs text-zinc-500">
            학생이 보는 화면입니다. 여기서 직접 넘기며 시연하고,
            <b> 지금 화면으로 모으기</b>를 누르면 학생들이 따라옵니다.
            {blank && (
              <b className="text-amber-700">
                {" "}· 지금 학생 화면은 덮여 있습니다(이 화면은 그대로 보입니다).
              </b>
            )}
          </p>
          <HtmlActivityFrame
            html={html}
            title={`${activityTitle} — 학생 화면`}
            onScreen={setMine}
            goto={goto}
            /* 교사 화면은 덮지 않는다 — 덮으면 시연을 못 한다 */
            blank={false}
          />
        </div>
      ) : (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
          이 활동은 HTML 활동이 아니어서 여기에 띄울 수 없습니다. 참여 현황과
          화면 가리기는 그대로 쓸 수 있습니다.
        </p>
      )}
    </div>
  );
}
