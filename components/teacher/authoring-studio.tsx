"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { nextScreenKey } from "@/lib/screens";

// 조작 활동 만들기 — 왼쪽 챗봇 / 오른쪽 코드·미리보기 탭.
//
// 코드는 편집할 수 있고, 고치면 미리보기가 곧바로 따라온다.
// 즉 챗봇에게 말로 시켜도 되고, 오른쪽에서 직접 손봐도 된다.
type Msg = { role: "user" | "assistant"; content: string };
type Model = { model_id: string; label: string };
type ActivityOpt = { id: string; title: string; unit: string };

const EXAMPLES = [
  "이차함수 y = a(x−p)² + q 에서 a, p, q 를 슬라이더로 바꾸면 그래프와 꼭짓점이 따라오는 화면",
  "두 점을 끌면 기울기와 직선의 방정식이 실시간으로 바뀌는 화면",
  "원 밖의 점에서 그은 접선 두 개를 점을 끌어 가며 보는 화면",
];

// AI 답변에서 ```html … ``` 을 꺼낸다. 여러 개면 마지막 것(가장 최신 수정본).
function extractHtml(text: string): string | null {
  const blocks = [...text.matchAll(/```(?:html)?\n([\s\S]*?)```/g)].map((m) => m[1]);
  return blocks.length ? blocks[blocks.length - 1].trim() : null;
}

// 저장할 때 쓸 기본 제목 — 만든 화면의 <h1> 을 그대로 가져온다
function guessTitle(html: string): string {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  return m ? m[1].replace(/<[^>]+>/g, "").trim().slice(0, 60) : "새 화면";
}

// 화면이 여러 개면 한 행에 몰아넣게 되므로 미리 알려 준다
function countScreens(html: string): number {
  return (html.match(/<section class="screen/g) ?? []).length;
}

// 코드블록을 걷어낸 설명만 — 대화창에는 이것만 보인다(코드는 오른쪽에 있으므로)
function stripCode(text: string): string {
  const t = text.replace(/```(?:html)?\n[\s\S]*?```/g, "").trim();
  return t || "오른쪽 미리보기를 확인해 주세요.";
}

export default function AuthoringStudio({
  aiConsented,
  models,
  dailyLimit,
  activities,
}: {
  aiConsented: boolean;
  models: Model[];
  dailyLimit: number;
  activities: ActivityOpt[];
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [model, setModel] = useState(models[0]?.model_id ?? "");
  const [tab, setTab] = useState<"code" | "preview">("preview");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveTo, setSaveTo] = useState(activities[0]?.id ?? "");
  const [saveTitle, setSaveTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ id: string; title: string } | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [msgs, busy]);

  // 미리보기는 타이핑이 멈춘 뒤에 갱신한다(글자마다 iframe 을 새로 그리지 않도록)
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(code), 350);
    return () => clearTimeout(t);
  }, [code]);

  const srcDoc = useMemo(() => {
    if (!debounced.trim()) return "";
    return `<!doctype html><meta charset="utf-8">
<style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;
color:#27272a;line-height:1.6}.screen{display:none}.screen.on{display:block}</style>
${debounced}
<script>
// 미리보기에서는 화면 넘김을 여기서 붙여 준다 (플랫폼이 하는 일과 같다)
(function(){var s=document.querySelectorAll(".screen");
if(s.length&&![].some.call(s,function(x){return x.classList.contains("on");}))s[0].classList.add("on");})();
<\/script>`;
  }, [debounced]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: text.trim() }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/ai/authoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, model }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "요청에 실패했습니다.");
        setMsgs(msgs); // 실패한 턴은 되돌린다
        return;
      }
      setMsgs([...next, { role: "assistant", content: data.reply }]);
      if (typeof data.remaining === "number") setRemaining(data.remaining);
      const html = extractHtml(data.reply);
      if (html) {
        setCode(html);
        setTab("preview");
        setSaveTitle(guessTitle(html));
        setSaved(null);
        setSaveErr(null);
      }
    } catch {
      setErr("네트워크 오류가 발생했습니다.");
      setMsgs(msgs);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // 만든 화면을 활동에 붙인다.
  // 쓰기 권한은 activity_screens 의 RLS(is_teacher)가 DB 에서 막아 준다.
  async function save() {
    if (!saveTo || !code.trim() || saving) return;
    setSaving(true);
    setSaveErr(null);
    const supabase = createClient();
    try {
      // 화면키는 학생 기록이 붙는 값이다. 지금 있는 화면뿐 아니라
      // 지워진 화면의 기록이 남아 있는 키까지 피해야 옛 답이 새 화면에 붙지 않는다.
      // (docs/07_SCREEN_ARCHITECTURE.md — "화면키를 바꾸거나 재사용하지 않는다")
      const [{ data: rows, error: readErr }, { data: used }] = await Promise.all([
        supabase
          .from("activity_screens")
          .select("screen_key, order_index")
          .eq("activity_id", saveTo),
        supabase
          .from("screen_responses")
          .select("screen_key")
          .eq("activity_id", saveTo),
      ]);
      if (readErr) throw new Error(readErr.message);

      const existing = (rows ?? []) as { screen_key: string; order_index: number }[];
      const taken = [
        ...existing.map((r) => r.screen_key),
        ...((used ?? []) as { screen_key: string }[]).map((r) => r.screen_key),
      ];
      const { error } = await supabase.from("activity_screens").insert({
        activity_id: saveTo,
        screen_key: nextScreenKey(taken),
        order_index: existing.reduce((m, r) => Math.max(m, r.order_index + 1), 0),
        type: "html",
        title: saveTitle.trim() || guessTitle(code),
        config: { html: code },
        questions: [],
      });
      if (error) throw new Error(error.message);

      const act = activities.find((a) => a.id === saveTo);
      setSaved({ id: saveTo, title: act?.title ?? "활동" });
      setSaveOpen(false);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (!aiConsented) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        AI 기능 사용에 먼저 동의해 주세요. 학생 화면의 AI 기능에서 동의하면 여기서도 쓸 수 있습니다.
      </div>
    );
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
      {/* ── 왼쪽: 챗봇 ─────────────────────────────────────────── */}
      <section className="flex min-h-0 flex-col rounded-xl border border-zinc-200 bg-white">
        <header className="flex items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2">
          <span className="text-sm font-semibold text-zinc-700">제작 도우미</span>
          <div className="flex items-center gap-2">
            {remaining !== null && (
              <span className="text-xs text-zinc-400">
                오늘 {remaining} / {dailyLimit}회 남음
              </span>
            )}
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="rounded-lg border border-zinc-200 px-2 py-1 text-xs"
            >
              {models.map((m) => (
                <option key={m.model_id} value={m.model_id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </header>

        <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {msgs.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-zinc-500">
                만들고 싶은 화면을 설명해 보세요. 예를 들면:
              </p>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => send(ex)}
                  className="block w-full rounded-lg border border-zinc-200 px-3 py-2 text-left text-sm text-zinc-600 hover:border-blue-400 hover:text-blue-700"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
          {msgs.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "ml-8 rounded-xl bg-blue-600 px-3 py-2 text-sm text-white"
                  : "mr-8 rounded-xl bg-zinc-100 px-3 py-2 text-sm whitespace-pre-wrap text-zinc-800"
              }
            >
              {m.role === "user" ? m.content : stripCode(m.content)}
            </div>
          ))}
          {busy && (
            <div className="mr-8 rounded-xl bg-zinc-100 px-3 py-2 text-sm text-zinc-500">
              만드는 중…
            </div>
          )}
          {err && (
            <div className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {err}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2 border-t border-zinc-200 p-3"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={2}
            placeholder={
              msgs.length ? "고칠 점을 말해 주세요 (예: 슬라이더 범위를 −5~5 로)" : "만들고 싶은 화면을 설명하세요"
            }
            className="min-h-0 flex-1 resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="shrink-0 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-40"
          >
            보내기
          </button>
        </form>
      </section>

      {/* ── 오른쪽: 코드 / 미리보기 ──────────────────────────────── */}
      <section className="flex min-h-0 flex-col rounded-xl border border-zinc-200 bg-white">
        <header className="flex items-center justify-between border-b border-zinc-200 px-3 py-2">
          <div className="flex gap-1">
            {(["preview", "code"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={
                  "rounded-lg px-3 py-1 text-sm font-semibold " +
                  (tab === t ? "bg-blue-600 text-white" : "text-zinc-500 hover:text-zinc-800")
                }
              >
                {t === "preview" ? "미리보기" : "HTML"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copy}
              disabled={!code}
              className="rounded-lg border border-zinc-200 px-3 py-1 text-sm font-semibold text-zinc-700 disabled:opacity-40"
            >
              {copied ? "복사됨 ✓" : "복사"}
            </button>
            <button
              onClick={() => {
                setSaveOpen((v) => !v);
                setSaved(null);
                setSaveErr(null);
              }}
              disabled={!code || activities.length === 0}
              className="rounded-lg bg-emerald-600 px-3 py-1 text-sm font-semibold text-white disabled:opacity-40"
            >
              이 활동의 화면으로 저장
            </button>
          </div>
        </header>

        {/* 저장 패널 */}
        {saveOpen && (
          <div className="space-y-2 border-b border-zinc-200 bg-emerald-50/60 p-3">
            <label className="block text-xs font-semibold text-zinc-600">
              어느 활동에 붙일까요?
              <select
                value={saveTo}
                onChange={(e) => setSaveTo(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm font-normal"
              >
                {activities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.unit} · {a.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-zinc-600">
              화면 제목
              <input
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                placeholder={guessTitle(code)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm font-normal"
              />
            </label>
            {countScreens(code) > 1 && (
              <p className="rounded-lg bg-amber-100 px-2 py-1.5 text-xs text-amber-900">
                이 코드에는 화면이 {countScreens(code)}개 들어 있습니다. 한 화면으로 통째 저장됩니다.
                화면을 따로 두려면 왼쪽에서 &ldquo;한 화면씩 만들어 줘&rdquo;라고 요청하세요.
              </p>
            )}
            <p className="text-xs text-zinc-500">
              활동 맨 뒤에 새 화면으로 붙습니다. 질문은 화면 관리에서 붙일 수 있습니다.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={save}
                disabled={saving || !saveTo}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {saving ? "저장 중…" : "저장"}
              </button>
              <button
                onClick={() => setSaveOpen(false)}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {saved && (
          <div className="flex flex-wrap items-center gap-2 border-b border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <span>
              <b>{saved.title}</b> 에 화면을 추가했습니다.
            </span>
            <a
              href={`/teacher/activity/${saved.id}/screens`}
              className="font-semibold underline"
            >
              화면 관리로 이동 →
            </a>
          </div>
        )}
        {saveErr && (
          <div className="border-b border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            저장하지 못했습니다 — {saveErr}
          </div>
        )}

        {!code ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-zinc-400">
            왼쪽에서 만들고 싶은 화면을 설명하면
            <br />
            여기에 결과가 나타납니다.
          </div>
        ) : tab === "code" ? (
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            className="min-h-0 flex-1 resize-none rounded-b-xl p-3 font-mono text-xs leading-relaxed text-zinc-800 outline-none"
          />
        ) : (
          <iframe
            title="활동 미리보기"
            srcDoc={srcDoc}
            sandbox="allow-scripts"
            className="min-h-0 flex-1 rounded-b-xl bg-white"
          />
        )}
      </section>
    </div>
  );
}
