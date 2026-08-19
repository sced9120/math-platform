"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  danglingIds,
  serializeActivityHtml,
  type ParsedActivity,
  type ScreenBlock,
} from "@/lib/activity-html";

// 활동 안의 화면을 순서 바꾸기·질문 고치기·글 고치기·지우기 로 관리한다.
// 조작(SVG·슬라이더) 코드는 활동 스크립트에 그대로 남겨 두고 건드리지 않는다.
export default function ScreensManager({
  activityId,
  activityTitle,
  unitId,
  unitTitle,
  parsed,
}: {
  activityId: string;
  activityTitle: string;
  unitId: string;
  unitTitle: string;
  parsed: ParsedActivity | null;
}) {
  const router = useRouter();
  const [screens, setScreens] = useState<ScreenBlock[]>(parsed?.screens ?? []);
  const [openBody, setOpenBody] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  if (!parsed) {
    return (
      <div className="flex flex-col gap-4">
        <Back unitId={unitId} unitTitle={unitTitle} />
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          이 활동은 화면으로 나뉘어 있지 않아 화면 관리를 쓸 수 없습니다.
          <br />
          (HTML 활동 중 <code>&lt;section class=&quot;screen&quot;&gt;</code> 구조로 만든 것만
          지원합니다)
        </p>
      </div>
    );
  }

  function patch(i: number, v: Partial<ScreenBlock>) {
    setScreens((prev) => prev.map((s, j) => (j === i ? { ...s, ...v } : s)));
    setDirty(true);
    setSavedAt(null);
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= screens.length) return;
    const next = [...screens];
    [next[i], next[j]] = [next[j], next[i]];
    setScreens(next);
    setDirty(true);
    setSavedAt(null);
    if (openBody === i) setOpenBody(j);
    else if (openBody === j) setOpenBody(i);
  }

  function remove(i: number) {
    const s = screens[i];
    const dangling = danglingIds([s], parsed!.after);
    const warn =
      dangling.length > 0
        ? `\n\n⚠ 이 화면의 조작 코드가 활동 스크립트에 남아 있습니다 (${dangling
            .slice(0, 4)
            .join(", ")}${dangling.length > 4 ? " 외" : ""}).\n지우면 다른 화면의 조작까지 멈출 수 있습니다.`
        : "";
    if (!confirm(`‘${s.heading || s.key}’ 화면을 지울까요?${warn}`)) return;
    setScreens((prev) => prev.filter((_, j) => j !== i));
    setOpenBody(null);
    setDirty(true);
    setSavedAt(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const supabase = createClient();

    // 다른 값(height 등)을 잃지 않도록 저장 직전에 현재 content 를 읽어 합친다
    const { data: row, error: readErr } = await supabase
      .from("activities")
      .select("content")
      .eq("id", activityId)
      .single<{ content: Record<string, unknown> }>();
    if (readErr || !row) {
      setError("활동을 읽지 못했습니다. 다시 시도하세요.");
      setSaving(false);
      return;
    }

    const html = serializeActivityHtml({ ...parsed!, screens });
    const { error: writeErr } = await supabase
      .from("activities")
      .update({ content: { ...row.content, html } })
      .eq("id", activityId);

    if (writeErr) setError("저장에 실패했습니다. 다시 시도하세요.");
    else {
      setSavedAt(new Date());
      setDirty(false);
      router.refresh();
    }
    setSaving(false);
  }

  const withPrompt = screens.filter((s) => s.prompt.trim()).length;

  return (
    <div className="flex flex-col gap-4">
      <Back unitId={unitId} unitTitle={unitTitle} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">
          {activityTitle} — 화면 관리
          <span className="ml-2 text-sm font-normal text-zinc-500">
            화면 {screens.length}개 · 기록칸 {withPrompt}개
          </span>
        </h2>
        <div className="flex items-center gap-3">
          <Link
            href={`/teacher/activity/${activityId}/preview`}
            className="text-sm text-blue-600 hover:underline"
          >
            미리보기
          </Link>
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        화면 순서와 <b>질문</b>, 화면 안의 <b>글</b>을 여기서 고칠 수 있습니다. 질문을 비우면 그
        화면에는 기록칸이 뜨지 않습니다. 조작(그래프·슬라이더)은 코드로 되어 있어 여기서 만들거나
        고칠 수는 없고, 화면과 함께 그대로 따라다닙니다.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {savedAt && (
        <p className="text-sm text-green-600">
          ✓ 저장했습니다 ({savedAt.toLocaleTimeString("ko-KR")}). 학생 화면에 바로 반영됩니다.
        </p>
      )}

      <StartScreenStructure activityId={activityId} />

      <ol className="flex flex-col gap-3">
        {screens.map((s, i) => (
          <li
            key={`${s.key}-${i}`}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">
                {i + 1}
              </span>
              <span className="font-medium text-zinc-900">
                {s.heading || <span className="text-zinc-400">제목 없음</span>}
              </span>
              <code className="rounded bg-zinc-50 px-1.5 py-0.5 text-xs text-zinc-500">
                {s.key}
              </code>
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:opacity-30"
                  aria-label="위로"
                >
                  ↑
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === screens.length - 1}
                  className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:opacity-30"
                  aria-label="아래로"
                >
                  ↓
                </button>
                <button
                  onClick={() => setOpenBody(openBody === i ? null : i)}
                  className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600"
                >
                  {openBody === i ? "글 접기" : "글 고치기"}
                </button>
                <button
                  onClick={() => remove(i)}
                  className="rounded border border-red-200 px-2 py-1 text-xs text-red-600"
                >
                  지우기
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-600">
                기록칸 질문 <span className="text-zinc-400">(비우면 기록칸 없음)</span>
              </label>
              <textarea
                rows={2}
                value={s.prompt}
                onChange={(e) => patch(i, { prompt: e.target.value })}
                placeholder="이 화면에서 학생에게 물어볼 것을 적으세요."
                className="rounded-md border border-zinc-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={s.photo}
                  onChange={(e) => patch(i, { photo: e.target.checked })}
                />
                📷 사진(공책 촬영·PDF)으로도 낼 수 있게 하기
              </label>
            </div>

            {openBody === i && (
              <div className="mt-3 flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-600">
                  화면 안의 글 (HTML) — 조작 코드가 쓰는 <code>id</code> 는 지우지 마세요
                </label>
                <textarea
                  rows={14}
                  value={s.body}
                  onChange={(e) => patch(i, { body: e.target.value })}
                  spellCheck={false}
                  className="rounded-md border border-zinc-300 p-2 font-mono text-xs leading-relaxed focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

// 새 구조(화면 행)로 시작하기.
// 화면이 하나라도 생기면 학생 화면은 그때부터 새 재생기를 쓰므로 되돌릴 일을 분명히 알린다.
function StartScreenStructure({ activityId }: { activityId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function start() {
    if (
      !confirm(
        "새 방식(화면 구성)으로 시작할까요?\n\n" +
          "화면을 하나라도 만들면 학생에게는 그 화면들만 보입니다.\n" +
          "지금 활동 HTML 은 지워지지 않지만 학생 화면에는 안 나옵니다.\n" +
          "(화면을 모두 지우면 지금 방식으로 돌아옵니다)"
      )
    )
      return;
    setBusy(true);
    const { error } = await createClient().from("activity_screens").insert({
      activity_id: activityId,
      screen_key: "s1",
      order_index: 0,
      type: "text",
      title: "새 화면",
      config: {},
      questions: [],
    });
    setBusy(false);
    if (error) alert("시작하지 못했습니다. 다시 시도하세요.");
    else router.refresh();
  }

  return (
    <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-4">
      <p className="text-sm font-medium text-zinc-800">화면 구성으로 바꾸기 (새 방식)</p>
      <p className="mt-1 text-sm text-zinc-600">
        화면마다 유형(글·좌표평면·지오지브라·사진·직접 만든 조작)을 고르고, 질문을 버튼으로 붙일 수
        있습니다. 조작 코드도 화면 단위라 한 화면이 깨져도 다른 화면은 멀쩡합니다.
      </p>
      <button
        onClick={start}
        disabled={busy}
        className="mt-3 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
      >
        {busy ? "만드는 중..." : "화면 구성 시작하기"}
      </button>
    </div>
  );
}

function Back({ unitId, unitTitle }: { unitId: string; unitTitle: string }) {
  return (
    <Link href={`/teacher/units/${unitId}`} className="text-sm text-blue-600 hover:underline">
      ← {unitTitle} 소단원 관리
    </Link>
  );
}
