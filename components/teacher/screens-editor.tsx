"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_PLANE,
  QUESTION_TYPE_LABEL,
  SCREEN_TYPE_LABEL,
  emptyQuestion,
  newQuestionId,
  nextScreenKey,
  type Question,
  type Screen,
  type ScreenType,
} from "@/lib/screens";

// 화면 구성 편집기 — 화면을 행으로 두고 유형·설정·질문을 고친다.
// 조작 코드는 화면 단위(html 유형)라 한 화면이 깨져도 다른 화면은 멀쩡하다.
export default function ScreensEditor({
  activityId,
  activityTitle,
  unitId,
  unitTitle,
  initialScreens,
  otherActivities,
}: {
  activityId: string;
  activityTitle: string;
  unitId: string;
  unitTitle: string;
  initialScreens: Screen[];
  otherActivities: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [screens, setScreens] = useState<Screen[]>(initialScreens);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  function fail(e: unknown, what: string) {
    console.error(e);
    setError(`${what}에 실패했습니다. 다시 시도하세요.`);
    setBusy(false);
  }

  async function addScreen(type: ScreenType) {
    setBusy(true);
    setError(null);
    const key = nextScreenKey(screens.map((s) => s.screen_key));
    const row = {
      activity_id: activityId,
      screen_key: key,
      order_index: screens.length,
      type,
      title: "",
      config: type === "plane" ? { plane: DEFAULT_PLANE } : {},
      questions: [],
      sheet: "",
    };
    const { data, error } = await supabase
      .from("activity_screens")
      .insert(row)
      .select("*")
      .single<Screen>();
    if (error) return fail(error, "화면 추가");
    setScreens((prev) => [...prev, data]);
    setOpenId(data.id ?? null);
    setBusy(false);
    router.refresh();
  }

  async function patch(s: Screen, v: Partial<Screen>) {
    setScreens((prev) => prev.map((x) => (x.id === s.id ? { ...x, ...v } : x)));
    const { error } = await supabase.from("activity_screens").update(v).eq("id", s.id!);
    if (error) fail(error, "저장");
    else setError(null);
  }

  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= screens.length) return;
    setBusy(true);
    const next = [...screens];
    [next[i], next[j]] = [next[j], next[i]];
    setScreens(next);
    // 순서 값은 화면 배열 그대로 다시 매긴다
    for (let k = 0; k < next.length; k++) {
      const { error } = await supabase
        .from("activity_screens")
        .update({ order_index: k })
        .eq("id", next[k].id!);
      if (error) return fail(error, "순서 저장");
    }
    setBusy(false);
    router.refresh();
  }

  async function remove(s: Screen) {
    if (
      !confirm(
        `‘${s.title || s.screen_key}’ 화면을 지울까요?\n이 화면에 학생이 남긴 기록은 남아 있지만 화면에서는 보이지 않게 됩니다.`
      )
    )
      return;
    setBusy(true);
    const { error } = await supabase.from("activity_screens").delete().eq("id", s.id!);
    if (error) return fail(error, "삭제");
    setScreens((prev) => prev.filter((x) => x.id !== s.id));
    setBusy(false);
    router.refresh();
  }

  async function moveToActivity(s: Screen, targetId: string) {
    if (!targetId) return;
    const target = otherActivities.find((a) => a.id === targetId);
    if (!confirm(`‘${s.title || s.screen_key}’ 화면을 「${target?.title}」 로 옮길까요?`)) return;
    setBusy(true);
    const { error } = await supabase
      .from("activity_screens")
      .update({ activity_id: targetId, order_index: 999 })
      .eq("id", s.id!);
    if (error) return fail(error, "화면 옮기기");
    setScreens((prev) => prev.filter((x) => x.id !== s.id));
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/teacher/units/${unitId}`} className="text-sm text-blue-600 hover:underline">
        ← {unitTitle} 활동 관리
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">
          {activityTitle} — 화면 구성
          <span className="ml-2 text-sm font-normal text-zinc-500">화면 {screens.length}개</span>
        </h2>
        <Link
          href={`/teacher/activity/${activityId}/preview`}
          className="text-sm text-blue-600 hover:underline"
        >
          미리보기
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <ol className="flex flex-col gap-3">
        {screens.map((s, i) => (
          <li key={s.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">
                {i + 1}
              </span>
              <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                {SCREEN_TYPE_LABEL[s.type]}
              </span>
              <span className="font-medium text-zinc-900">
                {s.title || <span className="text-zinc-400">제목 없음</span>}
              </span>
              <code className="rounded bg-zinc-50 px-1.5 py-0.5 text-xs text-zinc-500">
                {s.screen_key}
              </code>
              {s.questions.length > 0 && (
                <span className="text-xs text-zinc-500">질문 {s.questions.length}개</span>
              )}
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => move(i, -1)}
                  disabled={busy || i === 0}
                  className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={busy || i === screens.length - 1}
                  className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  onClick={() => setOpenId(openId === s.id ? null : (s.id ?? null))}
                  className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600"
                >
                  {openId === s.id ? "접기" : "고치기"}
                </button>
                <button
                  onClick={() => remove(s)}
                  className="rounded border border-red-200 px-2 py-1 text-xs text-red-600"
                >
                  지우기
                </button>
              </div>
            </div>

            {openId === s.id && (
              <div className="mt-4 flex flex-col gap-4 border-t border-zinc-100 pt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="화면 제목">
                    <input
                      value={s.title}
                      onChange={(e) => patch(s, { title: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                    />
                  </Field>
                  <Field label="학습지 배지 (비우면 안 보임)">
                    <input
                      value={s.sheet}
                      onChange={(e) => patch(s, { sheet: e.target.value })}
                      placeholder="학습지 1-01 [생각 틔우기] Q1"
                      className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                    />
                  </Field>
                </div>

                <ConfigEditor screen={s} onChange={(config) => patch(s, { config })} />

                <QuestionsEditor
                  questions={s.questions}
                  onChange={(questions) => patch(s, { questions })}
                />

                {otherActivities.length > 0 && (
                  <Field label="다른 활동으로 옮기기">
                    <select
                      defaultValue=""
                      onChange={(e) => moveToActivity(s, e.target.value)}
                      className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">— 옮길 활동 선택 —</option>
                      {otherActivities.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.title}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>

      <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-4">
        <p className="mb-2 text-sm font-medium text-zinc-700">화면 추가</p>
        <div className="flex flex-wrap gap-2">
          {(["text", "plane", "geogebra", "image", "html"] as ScreenType[]).map((t) => (
            <button
              key={t}
              onClick={() => addScreen(t)}
              disabled={busy}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              + {SCREEN_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-600">{label}</span>
      {children}
    </label>
  );
}

function ConfigEditor({
  screen,
  onChange,
}: {
  screen: Screen;
  onChange: (config: Screen["config"]) => void;
}) {
  const c = screen.config ?? {};
  const set = (v: Partial<Screen["config"]>) => onChange({ ...c, ...v });

  if (screen.type === "text")
    return (
      <Field label="본문 (HTML)">
        <textarea
          rows={8}
          value={c.body ?? ""}
          onChange={(e) => set({ body: e.target.value })}
          className="rounded-md border border-zinc-300 p-2 font-mono text-xs"
        />
      </Field>
    );

  if (screen.type === "geogebra")
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="지오지브라 자료 ID">
          <input
            value={c.materialId ?? ""}
            onChange={(e) => set({ materialId: e.target.value })}
            placeholder="예: abc123de"
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="높이(px)">
          <input
            type="number"
            value={c.height ?? 600}
            onChange={(e) => set({ height: Number(e.target.value) })}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </Field>
      </div>
    );

  if (screen.type === "image")
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="이미지 경로 (activity-files 버킷)">
          <input
            value={c.imagePath ?? ""}
            onChange={(e) => set({ imagePath: e.target.value })}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="설명">
          <input
            value={c.caption ?? ""}
            onChange={(e) => set({ caption: e.target.value })}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </Field>
      </div>
    );

  if (screen.type === "html")
    return (
      <Field label="이 화면의 HTML + JS (이 화면에서만 돕니다)">
        <textarea
          rows={12}
          value={c.html ?? ""}
          onChange={(e) => set({ html: e.target.value })}
          spellCheck={false}
          className="rounded-md border border-zinc-300 p-2 font-mono text-xs"
        />
      </Field>
    );

  if (screen.type === "plane") {
    const p = c.plane ?? DEFAULT_PLANE;
    return (
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="범위 최소">
            <input
              type="number"
              value={p.min}
              onChange={(e) => set({ plane: { ...p, min: Number(e.target.value) } })}
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="범위 최대">
            <input
              type="number"
              value={p.max}
              onChange={(e) => set({ plane: { ...p, max: Number(e.target.value) } })}
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </Field>
          <label className="mt-5 flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={p.grid}
              onChange={(e) => set({ plane: { ...p, grid: e.target.checked } })}
            />
            격자 보이기
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-zinc-600">점</span>
          {p.points.map((pt, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                value={pt.name}
                onChange={(e) => {
                  const pts = [...p.points];
                  pts[i] = { ...pt, name: e.target.value };
                  set({ plane: { ...p, points: pts } });
                }}
                className="w-14 rounded-md border border-zinc-300 px-2 py-1 text-sm"
              />
              {(["x", "y"] as const).map((k) => (
                <input
                  key={k}
                  type="number"
                  value={pt[k]}
                  onChange={(e) => {
                    const pts = [...p.points];
                    pts[i] = { ...pt, [k]: Number(e.target.value) };
                    set({ plane: { ...p, points: pts } });
                  }}
                  className="w-20 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                />
              ))}
              <label className="flex items-center gap-1 text-xs text-zinc-600">
                <input
                  type="checkbox"
                  checked={pt.draggable}
                  onChange={(e) => {
                    const pts = [...p.points];
                    pts[i] = { ...pt, draggable: e.target.checked };
                    set({ plane: { ...p, points: pts } });
                  }}
                />
                끌 수 있음
              </label>
              <button
                onClick={() =>
                  set({ plane: { ...p, points: p.points.filter((_, j) => j !== i) } })
                }
                className="text-xs text-red-600"
              >
                빼기
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              set({
                plane: {
                  ...p,
                  points: [
                    ...p.points,
                    { name: String.fromCharCode(65 + p.points.length), x: 0, y: 0, draggable: true },
                  ],
                },
              })
            }
            className="self-start rounded-md border border-zinc-300 px-2 py-1 text-xs"
          >
            + 점 추가
          </button>
        </div>

        <Field label="선분 (점 이름을 쉼표로 — 예: A,B)">
          <input
            value={p.segments.map((s) => `${s.from},${s.to}`).join(" ")}
            onChange={(e) =>
              set({
                plane: {
                  ...p,
                  segments: e.target.value
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((pair) => {
                      const [from, to] = pair.split(",");
                      return { from, to: to ?? "", label: true };
                    }),
                },
              })
            }
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </Field>

        <Field label="오른쪽에 보여 줄 값">
          <div className="flex gap-3 text-sm text-zinc-700">
            {(["distance", "slope", "midpoint"] as const).map((r) => (
              <label key={r} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={p.readouts.includes(r)}
                  onChange={(e) =>
                    set({
                      plane: {
                        ...p,
                        readouts: e.target.checked
                          ? [...p.readouts, r]
                          : p.readouts.filter((x) => x !== r),
                      },
                    })
                  }
                />
                {r === "distance" ? "거리" : r === "slope" ? "기울기" : "중점"}
              </label>
            ))}
          </div>
        </Field>
      </div>
    );
  }

  return (
    <p className="text-sm text-zinc-500">
      이 유형은 여기서 고칠 설정이 없습니다.
    </p>
  );
}

function QuestionsEditor({
  questions,
  onChange,
}: {
  questions: Question[];
  onChange: (q: Question[]) => void;
}) {
  const add = (type: Question["type"]) =>
    onChange([...questions, emptyQuestion(type, newQuestionId(questions.map((q) => q.id)))]);
  const set = (i: number, v: Partial<Question>) =>
    onChange(questions.map((q, j) => (j === i ? ({ ...q, ...v } as Question) : q)));

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
      <span className="text-xs font-semibold text-blue-900">질문</span>

      {questions.length === 0 && (
        <p className="text-xs text-zinc-500">질문이 없으면 이 화면에는 기록칸이 뜨지 않습니다.</p>
      )}

      {questions.map((q, i) => (
        <div key={q.id} className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
              {QUESTION_TYPE_LABEL[q.type]}
            </span>
            <button
              onClick={() => onChange(questions.filter((_, j) => j !== i))}
              className="ml-auto text-xs text-red-600"
            >
              빼기
            </button>
          </div>
          <textarea
            rows={2}
            value={q.prompt}
            onChange={(e) => set(i, { prompt: e.target.value })}
            placeholder="학생에게 물어볼 것"
            className="rounded-md border border-zinc-300 p-2 text-sm"
          />

          {q.type === "text" && (
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={!!q.photo}
                onChange={(e) => set(i, { photo: e.target.checked })}
              />
              📷 사진으로도 낼 수 있게 하기
            </label>
          )}

          {q.type === "short" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="정답 (학생에게 안 보임)">
                <input
                  value={q.answer ?? ""}
                  onChange={(e) => set(i, { answer: e.target.value })}
                  className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                />
              </Field>
              <Field label="허용오차">
                <input
                  type="number"
                  step="any"
                  value={q.tolerance ?? 0}
                  onChange={(e) => set(i, { tolerance: Number(e.target.value) })}
                  className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                />
              </Field>
            </div>
          )}

          {q.type === "choice" && (
            <div className="flex flex-col gap-2">
              {q.choices.map((c, k) => (
                <div key={k} className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={q.answer === String(k)}
                    onChange={() => set(i, { answer: String(k) })}
                    title="정답으로 지정"
                  />
                  <input
                    value={c}
                    onChange={(e) => {
                      const choices = [...q.choices];
                      choices[k] = e.target.value;
                      set(i, { choices });
                    }}
                    className="flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                  <button
                    onClick={() => set(i, { choices: q.choices.filter((_, j) => j !== k) })}
                    className="text-xs text-red-600"
                  >
                    빼기
                  </button>
                </div>
              ))}
              <button
                onClick={() => set(i, { choices: [...q.choices, ""] })}
                className="self-start rounded-md border border-zinc-300 px-2 py-1 text-xs"
              >
                + 보기 추가
              </button>
              <p className="text-xs text-zinc-500">왼쪽 동그라미가 정답입니다.</p>
            </div>
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        {(["text", "short", "choice"] as Question["type"][]).map((t) => (
          <button
            key={t}
            onClick={() => add(t)}
            className="rounded-md border border-blue-300 bg-white px-3 py-1.5 text-sm font-medium text-blue-700"
          >
            + {QUESTION_TYPE_LABEL[t]}
          </button>
        ))}
      </div>
    </div>
  );
}
