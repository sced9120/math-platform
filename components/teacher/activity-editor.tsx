"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ScreenBody from "@/components/student/screen-body";
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

// 소단원 안의 활동을 만드는 화면.
// 왼쪽에서 고치면 오른쪽에서 바로 보인다(데스모스처럼).
export default function ActivityEditor({
  unitActivityId,
  unitActivityTitle,
  unitId,
  unitTitle,
  initialScreens,
  otherUnitActivities,
}: {
  unitActivityId: string;
  unitActivityTitle: string;
  unitId: string;
  unitTitle: string;
  initialScreens: Screen[];
  otherUnitActivities: { id: string; title: string }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [screens, setScreens] = useState<Screen[]>(initialScreens);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const cur = screens[selected];
  // 타자 칠 때마다 저장하지 않도록 잠깐 모았다 보낸다
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function edit(v: Partial<Screen>) {
    if (!cur) return;
    const next = { ...cur, ...v };
    setScreens((prev) => prev.map((s, i) => (i === selected ? next : s)));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const { error } = await supabase
        .from("activity_screens")
        .update({
          title: next.title,
          sheet: next.sheet,
          config: next.config,
          questions: next.questions,
        })
        .eq("id", next.id!);
      if (error) setError("저장에 실패했습니다.");
      else {
        setError(null);
        setSavedAt(new Date());
      }
    }, 600);
  }

  async function add(type: ScreenType) {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase
      .from("activity_screens")
      .insert({
        activity_id: unitActivityId,
        screen_key: nextScreenKey(screens.map((s) => s.screen_key)),
        order_index: screens.length,
        type,
        title: SCREEN_TYPE_LABEL[type],
        config: type === "plane" ? { plane: DEFAULT_PLANE } : {},
        questions: [],
      })
      .select("*")
      .single<Screen>();
    setBusy(false);
    if (error) return setError("활동을 추가하지 못했습니다.");
    setScreens((prev) => [...prev, data]);
    setSelected(screens.length);
    router.refresh();
  }

  async function move(dir: -1 | 1) {
    const j = selected + dir;
    if (j < 0 || j >= screens.length) return;
    setBusy(true);
    const next = [...screens];
    [next[selected], next[j]] = [next[j], next[selected]];
    setScreens(next);
    setSelected(j);
    for (let k = 0; k < next.length; k++) {
      await supabase.from("activity_screens").update({ order_index: k }).eq("id", next[k].id!);
    }
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    if (!cur) return;
    if (!confirm(`‘${cur.title || cur.screen_key}’ 활동을 지울까요?`)) return;
    setBusy(true);
    const { error } = await supabase.from("activity_screens").delete().eq("id", cur.id!);
    setBusy(false);
    if (error) return setError("지우지 못했습니다.");
    setScreens((prev) => prev.filter((_, i) => i !== selected));
    setSelected((i) => Math.max(0, i - 1));
    router.refresh();
  }

  async function moveTo(targetId: string) {
    if (!cur || !targetId) return;
    const t = otherUnitActivities.find((a) => a.id === targetId);
    if (!confirm(`‘${cur.title || cur.screen_key}’ 활동을 「${t?.title}」 소단원으로 옮길까요?`))
      return;
    setBusy(true);
    const { error } = await supabase
      .from("activity_screens")
      .update({ activity_id: targetId, order_index: 999 })
      .eq("id", cur.id!);
    setBusy(false);
    if (error) return setError("옮기지 못했습니다.");
    setScreens((prev) => prev.filter((_, i) => i !== selected));
    setSelected((i) => Math.max(0, i - 1));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/teacher/units/${unitId}`} className="text-sm text-blue-600 hover:underline">
        ← {unitTitle} 소단원 관리
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">
          {unitActivityTitle}
          <span className="ml-2 text-sm font-normal text-zinc-500">활동 {screens.length}개</span>
        </h2>
        <div className="flex items-center gap-3 text-sm">
          {error ? (
            <span className="text-red-600">{error}</span>
          ) : savedAt ? (
            <span className="text-green-600">✓ 자동 저장됨 {savedAt.toLocaleTimeString("ko-KR")}</span>
          ) : (
            <span className="text-zinc-400">고치면 자동으로 저장됩니다</span>
          )}
          <Link
            href={`/teacher/activity/${unitActivityId}/preview`}
            className="text-blue-600 hover:underline"
          >
            학생 화면으로 보기
          </Link>
        </div>
      </div>

      {/* 활동 목록 (탭처럼) */}
      <div className="flex flex-wrap items-center gap-2">
        {screens.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setSelected(i)}
            className={`rounded-full border px-3 py-1 text-sm ${
              i === selected
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-zinc-300 bg-white text-zinc-700"
            }`}
          >
            {i + 1}. {s.title || SCREEN_TYPE_LABEL[s.type]}
          </button>
        ))}
      </div>

      {/* 활동 추가 — 유형을 고르면 바로 만들어지고 오른쪽에 보인다 */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white p-3">
        <span className="text-sm font-medium text-zinc-700">활동 추가</span>
        {(["plane", "geogebra", "text", "image", "html"] as ScreenType[]).map((t) => (
          <button
            key={t}
            onClick={() => add(t)}
            disabled={busy}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            + {SCREEN_TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {!cur ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
          위에서 유형을 골라 첫 활동을 만들어 보세요.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* 왼쪽: 설정 */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                {SCREEN_TYPE_LABEL[cur.type]}
              </span>
              <div className="ml-auto flex gap-1">
                <button
                  onClick={() => move(-1)}
                  disabled={busy || selected === 0}
                  className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:opacity-30"
                >
                  ←
                </button>
                <button
                  onClick={() => move(1)}
                  disabled={busy || selected === screens.length - 1}
                  className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:opacity-30"
                >
                  →
                </button>
                <button
                  onClick={remove}
                  className="rounded border border-red-200 px-2 py-1 text-xs text-red-600"
                >
                  지우기
                </button>
              </div>
            </div>

            <Field label="활동 이름">
              <input
                value={cur.title}
                onChange={(e) => edit({ title: e.target.value })}
                className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </Field>
            <Field label="학습지 배지 (비우면 안 보임)">
              <input
                value={cur.sheet}
                onChange={(e) => edit({ sheet: e.target.value })}
                placeholder="학습지 1-01 [생각 틔우기] Q1"
                className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </Field>

            <ConfigFields screen={cur} onChange={(config) => edit({ config })} />

            <QuestionsEditor
              questions={cur.questions}
              onChange={(questions) => edit({ questions })}
            />

            {otherUnitActivities.length > 0 && (
              <Field label="다른 소단원으로 옮기기">
                <select
                  value=""
                  onChange={(e) => moveTo(e.target.value)}
                  className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                >
                  <option value="">— 옮길 소단원 선택 —</option>
                  {otherUnitActivities.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          {/* 오른쪽: 학생이 보게 될 모습 */}
          <div className="flex flex-col gap-3">
            <div className="sticky top-4 flex flex-col gap-3">
              <p className="text-xs font-semibold text-zinc-500">미리보기 — 학생이 보는 그대로</p>
              {cur.sheet && (
                <span className="self-start rounded-full border border-amber-300 bg-amber-50 px-3 py-0.5 text-xs font-bold text-amber-800">
                  📄 {cur.sheet}
                </span>
              )}
              {cur.title && (
                <h3 className="text-lg font-semibold text-zinc-900">{cur.title}</h3>
              )}
              <ScreenBody screen={cur} fallbackTitle={unitActivityTitle} />
              {cur.questions.map((q) => (
                <div
                  key={q.id}
                  className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"
                >
                  <p className="font-medium text-zinc-900">✏️ {q.prompt || "(질문 없음)"}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {QUESTION_TYPE_LABEL[q.type]}
                    {q.type === "text" && q.photo ? " · 사진 첨부 가능" : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
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

function ConfigFields({
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
          rows={10}
          value={c.body ?? ""}
          onChange={(e) => set({ body: e.target.value })}
          placeholder="<p>설명을 적으세요.</p>"
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
            placeholder="주소 뒤의 자료 ID (예: xy12ab34)"
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
      <Field label="이 활동의 HTML + JS (이 활동에서만 돕니다)">
        <textarea
          rows={14}
          value={c.html ?? ""}
          onChange={(e) => set({ html: e.target.value })}
          spellCheck={false}
          className="rounded-md border border-zinc-300 p-2 font-mono text-xs"
        />
      </Field>
    );

  if (screen.type === "plane") {
    const p = c.plane ?? DEFAULT_PLANE;
    const setP = (v: Partial<typeof p>) => set({ plane: { ...p, ...v } });
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-3">
          <Field label="범위 최소">
            <input
              type="number"
              value={p.min}
              onChange={(e) => setP({ min: Number(e.target.value) })}
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="범위 최대">
            <input
              type="number"
              value={p.max}
              onChange={(e) => setP({ max: Number(e.target.value) })}
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </Field>
          <label className="mt-5 flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={p.grid}
              onChange={(e) => setP({ grid: e.target.checked })}
            />
            격자
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-zinc-600">점</span>
          {p.points.map((pt, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                value={pt.name}
                onChange={(e) => {
                  const points = [...p.points];
                  points[i] = { ...pt, name: e.target.value };
                  setP({ points });
                }}
                className="w-12 rounded-md border border-zinc-300 px-2 py-1 text-sm"
              />
              {(["x", "y"] as const).map((k) => (
                <input
                  key={k}
                  type="number"
                  value={pt[k]}
                  onChange={(e) => {
                    const points = [...p.points];
                    points[i] = { ...pt, [k]: Number(e.target.value) };
                    setP({ points });
                  }}
                  className="w-16 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                />
              ))}
              <label className="flex items-center gap-1 text-xs text-zinc-600">
                <input
                  type="checkbox"
                  checked={pt.draggable}
                  onChange={(e) => {
                    const points = [...p.points];
                    points[i] = { ...pt, draggable: e.target.checked };
                    setP({ points });
                  }}
                />
                끌기
              </label>
              <button
                onClick={() => setP({ points: p.points.filter((_, j) => j !== i) })}
                className="text-xs text-red-600"
              >
                빼기
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              setP({
                points: [
                  ...p.points,
                  {
                    name: String.fromCharCode(65 + p.points.length),
                    x: 0,
                    y: 0,
                    draggable: true,
                  },
                ],
              })
            }
            className="self-start rounded-md border border-zinc-300 px-2 py-1 text-xs"
          >
            + 점 추가
          </button>
        </div>

        <Field label="선분 (점 두 개를 쉼표로, 여러 개는 띄어쓰기 — 예: A,B B,C)">
          <input
            value={p.segments.map((s) => `${s.from},${s.to}`).join(" ")}
            onChange={(e) =>
              setP({
                segments: e.target.value
                  .split(/\s+/)
                  .filter(Boolean)
                  .map((pair) => {
                    const [from, to] = pair.split(",");
                    return { from, to: to ?? "", label: true };
                  }),
              })
            }
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </Field>

        <Field label="옆에 보여 줄 값">
          <div className="flex gap-3 text-sm text-zinc-700">
            {(["distance", "slope", "midpoint"] as const).map((r) => (
              <label key={r} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={p.readouts.includes(r)}
                  onChange={(e) =>
                    setP({
                      readouts: e.target.checked
                        ? [...p.readouts, r]
                        : p.readouts.filter((x) => x !== r),
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

  return <p className="text-sm text-zinc-500">이 유형은 고칠 설정이 없습니다.</p>;
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
        <p className="text-xs text-zinc-500">질문이 없으면 이 활동에는 기록칸이 뜨지 않습니다.</p>
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
