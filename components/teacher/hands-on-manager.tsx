"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ScreenBody from "@/components/student/screen-body";
import CopyLinkButton from "@/components/copy-link-button";
import { ConfigFields } from "@/components/teacher/activity-editor";
import { appendScreen } from "@/lib/client/append-screen";
import { DEFAULT_PLANE, SCREEN_TYPE_LABEL, type Screen } from "@/lib/screens";
import {
  MANIPULATIVE_TYPES,
  SLUG_RE,
  manipulativePath,
  type Manipulative,
} from "@/lib/manipulatives";

export type TargetActivity = { id: string; title: string; unit: string; eligible: boolean };

type Draft = Omit<Manipulative, "id" | "created_at"> & { id?: string };

const EMPTY_DRAFT: Draft = {
  slug: "",
  title: "",
  summary: "",
  topic: "",
  order_index: 0,
  type: "plane",
  config: { plane: DEFAULT_PLANE },
  is_published: false,
};

export default function HandsOnManager({
  initialItems,
  loadError,
  isAdmin,
  targets,
}: {
  initialItems: Manipulative[];
  loadError: boolean;
  isAdmin: boolean;
  targets: TargetActivity[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<Manipulative[]>(initialItems);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [addingFor, setAddingFor] = useState<string | null>(null); // 소단원에 추가 중인 자료 id
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string; href?: string } | null>(null);

  const groups = new Map<string, Manipulative[]>();
  for (const m of items) {
    const k = m.topic || "기타";
    groups.set(k, [...(groups.get(k) ?? []), m]);
  }
  const eligibleTargets = targets.filter((t) => t.eligible);
  const blockedCount = targets.length - eligibleTargets.length;

  async function reload() {
    const { data } = await createClient()
      .from("manipulatives")
      .select("*")
      .order("topic")
      .order("order_index");
    setItems((data as Manipulative[]) ?? []);
  }

  // 내 소단원 끝에 활동 한 화면으로 복사
  async function addTo(m: Manipulative) {
    if (!target) return;
    setBusy(true);
    setNotice(null);
    try {
      await appendScreen(createClient(), target, {
        type: m.type,
        title: m.title,
        config: m.config,
      });
      const t = targets.find((x) => x.id === target);
      setNotice({
        ok: true,
        text: `‘${m.title}’ 을(를) 「${t?.title}」 소단원의 마지막 활동으로 넣었습니다.`,
        href: `/teacher/activity/${target}/screens`,
      });
      setAddingFor(null);
      setTarget("");
      router.refresh();
    } catch {
      setNotice({ ok: false, text: "소단원에 넣지 못했습니다. 다시 시도하세요." });
    } finally {
      setBusy(false);
    }
  }

  // ── 관리자: 자료 저장·공개·삭제 ─────────────────────────────
  async function saveDraft() {
    if (!draft) return;
    const slug = draft.slug.trim().toLowerCase();
    if (!draft.title.trim()) return setNotice({ ok: false, text: "제목을 입력하세요." });
    if (!SLUG_RE.test(slug))
      return setNotice({
        ok: false,
        text: "주소 이름은 영문 소문자·숫자·하이픈(-) 2~60자로 입력하세요. (예: circle-tangent)",
      });
    setBusy(true);
    setNotice(null);
    const record = {
      slug,
      title: draft.title.trim(),
      summary: draft.summary.trim(),
      topic: draft.topic.trim(),
      order_index: draft.order_index,
      type: draft.type,
      config: draft.config,
      is_published: draft.is_published,
      updated_at: new Date().toISOString(),
    };
    const supabase = createClient();
    const { error } = draft.id
      ? await supabase.from("manipulatives").update(record).eq("id", draft.id)
      : await supabase.from("manipulatives").insert(record);
    setBusy(false);
    if (error) {
      return setNotice({
        ok: false,
        text: error.message.includes("slug")
          ? "이미 쓰이는 주소 이름입니다. 다른 이름을 고르세요."
          : "저장하지 못했습니다.",
      });
    }
    setDraft(null);
    setNotice({ ok: true, text: "저장했습니다." });
    await reload();
  }

  async function togglePublish(m: Manipulative) {
    await createClient()
      .from("manipulatives")
      .update({ is_published: !m.is_published })
      .eq("id", m.id);
    await reload();
  }

  async function remove(m: Manipulative) {
    if (!confirm(`‘${m.title}’ 을(를) 만져보는 수학에서 지울까요?\n(이미 소단원에 넣은 복사본은 그대로 남습니다)`))
      return;
    await createClient().from("manipulatives").delete().eq("id", m.id);
    await reload();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">🖐 만져보는 수학</h2>
          <p className="mt-1 text-sm text-zinc-500">
            학생 기록이 필요 없으면 <b>링크만</b> 나눠 주세요 (로그인 없이 열림). 기록을 모으려면{" "}
            <b>내 소단원에 추가</b>해 활동 한 화면으로 쓰세요.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/hands-on"
            target="_blank"
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            공개 화면 보기 ↗
          </Link>
          {isAdmin && !draft && (
            <button
              onClick={() => setDraft({ ...EMPTY_DRAFT })}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              + 새 자료
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          만져보는 수학 목록을 불러오지 못했습니다. 데이터베이스에 마이그레이션 0017 을 실행했는지
          확인하세요.
        </p>
      )}

      {notice && (
        <p
          className={`rounded-lg border p-3 text-sm ${
            notice.ok
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {notice.text}{" "}
          {notice.href && (
            <Link href={notice.href} className="font-medium underline">
              소단원에서 확인 →
            </Link>
          )}
        </p>
      )}

      {isAdmin && draft && (
        <DraftEditor
          draft={draft}
          onChange={setDraft}
          onSave={saveDraft}
          onCancel={() => setDraft(null)}
          busy={busy}
        />
      )}

      {items.length === 0 && !loadError ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
          아직 자료가 없습니다.
        </p>
      ) : (
        [...groups.entries()].map(([topic, list]) => (
          <section key={topic}>
            <h3 className="mb-2 text-sm font-semibold text-zinc-500">{topic}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {list.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-zinc-900">{m.title}</h4>
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                        {SCREEN_TYPE_LABEL[m.type]}
                      </span>
                      {isAdmin && (
                        <button
                          onClick={() => togglePublish(m)}
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            m.is_published
                              ? "bg-green-100 text-green-700"
                              : "bg-zinc-100 text-zinc-500"
                          }`}
                        >
                          {m.is_published ? "공개" : "비공개"}
                        </button>
                      )}
                    </div>
                    {m.summary && <p className="mt-1 text-sm text-zinc-600">{m.summary}</p>}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Link
                      href={manipulativePath(m.slug)}
                      target="_blank"
                      className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-700 hover:bg-zinc-50"
                    >
                      열어 보기 ↗
                    </Link>
                    {m.is_published && <CopyLinkButton path={manipulativePath(m.slug)} />}
                    <button
                      onClick={() => {
                        setAddingFor(addingFor === m.id ? null : m.id);
                        setTarget("");
                      }}
                      className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-100"
                    >
                      + 내 소단원에 추가
                    </button>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => setDraft({ ...m })}
                          className="text-xs text-zinc-600 hover:underline"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => remove(m)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          삭제
                        </button>
                      </>
                    )}
                  </div>

                  {addingFor === m.id && (
                    <div className="flex flex-col gap-2 rounded-lg bg-blue-50 p-3">
                      {eligibleTargets.length === 0 ? (
                        <p className="text-sm text-zinc-600">
                          넣을 수 있는 소단원이 없습니다.{" "}
                          <Link href="/teacher/units" className="text-blue-600 underline">
                            단원·소단원 관리
                          </Link>
                          에서 소단원을 먼저 만드세요.
                        </p>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                            className="max-w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                          >
                            <option value="">— 넣을 소단원 선택 —</option>
                            {eligibleTargets.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.unit} › {t.title}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => addTo(m)}
                            disabled={!target || busy}
                            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {busy ? "넣는 중..." : "추가"}
                          </button>
                        </div>
                      )}
                      {blockedCount > 0 && (
                        <p className="text-xs text-zinc-500">
                          예전 방식(HTML 한 덩어리)으로 만든 소단원 {blockedCount}개는 목록에서
                          뺐습니다 — 넣으면 학생에게 예전 내용이 안 보이게 되기 때문입니다. 소단원
                          편집 화면에서 ‘화면 구성 시작하기’를 한 뒤 넣을 수 있습니다.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

// 관리자용 자료 편집 — 왼쪽 설정, 오른쪽 미리보기 (활동 편집기와 같은 입력칸을 쓴다)
function DraftEditor({
  draft,
  onChange,
  onSave,
  onCancel,
  busy,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const set = (v: Partial<Draft>) => onChange({ ...draft, ...v });
  // ConfigFields 는 활동 화면 모양을 받는다
  const asScreen: Screen = {
    screen_key: "",
    order_index: 0,
    type: draft.type,
    title: draft.title,
    config: draft.config,
    questions: [],
    sheet: "",
    teach: {},
  };
  const input = "rounded-md border border-zinc-300 px-2 py-1.5 text-sm";

  return (
    <section className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 font-semibold text-zinc-900">
        {draft.id ? "자료 고치기" : "새 자료 만들기"}
      </h3>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-600">제목</span>
            <input value={draft.title} onChange={(e) => set({ title: e.target.value })} className={input} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-600">주소 이름 (/hands-on/…)</span>
              <input
                value={draft.slug}
                onChange={(e) => set({ slug: e.target.value.toLowerCase() })}
                placeholder="circle-tangent"
                className={`${input} font-mono`}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-600">분류</span>
              <input
                value={draft.topic}
                onChange={(e) => set({ topic: e.target.value })}
                placeholder="도형의 방정식"
                className={input}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-600">한 줄 설명</span>
            <input value={draft.summary} onChange={(e) => set({ summary: e.target.value })} className={input} />
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-600">유형</span>
              <select
                value={draft.type}
                onChange={(e) => {
                  const type = e.target.value as Draft["type"];
                  set({ type, config: type === "plane" ? { plane: DEFAULT_PLANE } : {} });
                }}
                className={input}
              >
                {MANIPULATIVE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {SCREEN_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-600">순서</span>
              <input
                type="number"
                value={draft.order_index}
                onChange={(e) => set({ order_index: Number(e.target.value) })}
                className={`${input} w-20`}
              />
            </label>
            <label className="flex items-center gap-2 pb-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={draft.is_published}
                onChange={(e) => set({ is_published: e.target.checked })}
              />
              공개 (누구나 보임)
            </label>
          </div>

          <ConfigFields screen={asScreen} onChange={(config) => set({ config })} />

          <div className="flex gap-2">
            <button
              onClick={onSave}
              disabled={busy}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? "저장 중..." : "저장"}
            </button>
            <button
              onClick={onCancel}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
            >
              취소
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-zinc-500">미리보기</p>
          <ScreenBody screen={asScreen} />
        </div>
      </div>
    </section>
  );
}
