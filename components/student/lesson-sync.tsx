"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  flatten,
  isTeacher,
  lessonChannel,
  type StudentPresence,
  type TeacherPresence,
} from "@/lib/lesson";
import Icon from "@/components/icon";

// 학생 쪽 수업 참여.
//  - 내가 몇 번째 화면인지 선생님께 계속 알린다.
//  - 선생님이 화면을 부르면 따라가고, 가리면 덮는다.
//  - 손들기.
// 선생님이 채널에 없으면 아무것도 보여 주지 않는다(평소 자습과 똑같다).

export type LessonControl = {
  blank: boolean;
  goto: { index: number; seq: number } | null;
};

export default function LessonSync({
  activityId,
  teacherId,
  me,
  screenIndex,
  screenTotal,
  screenTitle,
  completed,
  onControl,
}: {
  activityId: string;
  /** 이 활동을 만든 교사. 이 사람의 지시만 따른다. */
  teacherId: string;
  me: { id: string; name: string };
  screenIndex: number;
  screenTotal: number;
  screenTitle: string;
  completed: boolean;
  onControl: (c: LessonControl) => void;
}) {
  const chanRef = useRef<RealtimeChannel | null>(null);
  const [live, setLive] = useState<TeacherPresence | null>(null);
  const [handAt, setHandAt] = useState<number | null>(null);

  // 내 상태는 ref 에도 둔다 — track() 안에서 최신 값을 읽어야 한다
  const mine = useRef<StudentPresence>({
    role: "student",
    userId: me.id,
    name: me.name,
    screenIndex,
    screenTotal,
    screenTitle,
    handAt: null,
    doneAt: completed ? Date.now() : null,
  });

  // 채널은 활동당 한 번만 연다
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel(lessonChannel(activityId), {
      config: { presence: { key: me.id } },
    });
    chanRef.current = ch;

    ch.on("presence", { event: "sync" }, () => {
      const all = flatten(ch.presenceState() as Record<string, unknown[]>);
      // 이 활동의 담당 교사만 선생님으로 인정한다.
      // (채널 이름만 알면 누구나 들어올 수 있으므로 신분을 확인한다)
      const t = all.filter(isTeacher).find((p) => p.userId === teacherId) ?? null;
      setLive(t);
    });

    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") void ch.track(mine.current);
    });

    return () => {
      void supabase.removeChannel(ch);
      chanRef.current = null;
    };
  }, [activityId, me.id, teacherId]);

  // 화면이 바뀌면 알린다
  useEffect(() => {
    mine.current = {
      ...mine.current,
      screenIndex,
      screenTotal,
      screenTitle,
      doneAt: completed ? (mine.current.doneAt ?? Date.now()) : null,
      handAt,
    };
    void chanRef.current?.track(mine.current);
  }, [screenIndex, screenTotal, screenTitle, completed, handAt]);

  // 선생님의 지시를 위로 올린다
  useEffect(() => {
    onControl({
      blank: !!live?.blank,
      goto:
        live && live.gotoIndex != null
          ? { index: live.gotoIndex, seq: live.gotoSeq }
          : null,
    });
  }, [live, onControl]);

  // 선생님이 화면을 가리면 손든 것은 내린다(가린 동안 줄이 꼬이지 않게)
  useEffect(() => {
    if (live?.blank) setHandAt(null);
  }, [live?.blank]);

  if (!live) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
          </span>
          {live.name} 선생님과 함께 수업 중
        </span>
        <button
          type="button"
          onClick={() => setHandAt((v) => (v == null ? Date.now() : null))}
          aria-pressed={handAt != null}
          className={`ml-auto rounded-md border px-3 py-1.5 text-sm font-medium transition ${
            handAt != null
              ? "border-amber-400 bg-amber-100 text-amber-900"
              : "border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100"
          }`}
        >
          {handAt != null ? "✋ 손 든 상태 — 내리기" : "✋ 손들기"}
        </button>
      </div>

      {live.blank && <Veil teacherName={live.name} />}
    </>
  );
}

// 화면 가리기 — 보이는 것만 막는 게 아니라 입력까지 막는다.
//  - 덮개가 화면 전체를 덮어 마우스·터치를 가로챈다
//  - 포커스를 빼고, 탭으로 빠져나가지 못하게 가둔다
//  - 활동 iframe 안쪽은 HtmlActivityFrame 이 따로 알려 막는다
function Veil({ teacherName }: { teacherName: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    active?.blur?.();
    ref.current?.focus();

    // 스크롤도 멈춘다
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // 키보드로 뒤쪽 요소를 건드리지 못하게 한다
    function trap(e: KeyboardEvent) {
      if (e.key === "Tab") {
        e.preventDefault();
        ref.current?.focus();
      }
    }
    document.addEventListener("keydown", trap, true);
    return () => {
      document.removeEventListener("keydown", trap, true);
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alertdialog"
      aria-label="선생님을 보세요"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-zinc-900 text-center outline-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <Icon name="users" size={56} className="text-zinc-500" />
      <p className="text-3xl font-bold text-white">선생님을 보세요</p>
      <p className="text-sm text-zinc-400">
        {teacherName} 선생님이 화면을 잠시 덮었습니다.
        <br />
        끝나면 하던 곳에서 그대로 이어집니다.
      </p>
    </div>
  );
}
