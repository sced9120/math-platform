"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AiConsent from "@/components/student/ai-consent";
import ModelPicker from "@/components/student/model-picker";
import type { AiModelOption } from "@/components/student/activity-runner";

type ChatMessage = { role: "user" | "assistant"; content: string };

type SavedConversation = {
  id: string;
  title: string;
  activity_title: string;
  created_at: string;
  messages: ChatMessage[];
};

// 소크라테스 챗봇. 대화는 화면(메모리)에만 유지되고 DB에 저장되지 않는다.
export default function SocraticChat({
  activityId,
  consented,
  onConsent,
  models,
}: {
  activityId: string;
  consented: boolean;
  onConsent: () => void;
  models: AiModelOption[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedConversation[] | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [model, setModel] = useState(models[0]?.model_id ?? "");
  const bottomRef = useRef<HTMLDivElement>(null);

  if (!consented) {
    return <AiConsent onConsent={onConsent} />;
  }

  // ---------- 대화 저장 (최대 5개 — DB에서 강제) ----------

  async function loadSaved(): Promise<SavedConversation[]> {
    const { data } = await createClient()
      .from("ai_conversations")
      .select("id, title, activity_title, created_at, messages")
      .order("created_at", { ascending: false });
    const list = (data as SavedConversation[]) ?? [];
    setSaved(list);
    return list;
  }

  async function toggleSavedList() {
    if (!showSaved && saved === null) await loadSaved();
    setShowSaved(!showSaved);
  }

  async function handleSaveConversation() {
    setSaveNotice(null);
    const title =
      messages.find((m) => m.role === "user")?.content.slice(0, 40) ?? "대화";
    const { error } = await createClient().rpc("save_conversation", {
      p_activity_id: activityId,
      p_title: title,
      p_messages: messages,
    });
    if (error) {
      if (error.message.includes("limit")) {
        setSaveNotice(
          "저장은 최대 5개까지 가능해요. 아래 목록에서 대화를 삭제한 뒤 다시 저장하세요."
        );
        await loadSaved();
        setShowSaved(true);
      } else {
        setSaveNotice("저장에 실패했습니다. 다시 시도하세요.");
      }
      return;
    }
    await loadSaved();
    setShowSaved(true);
    setSaveNotice("대화가 저장되었습니다.");
  }

  async function handleDeleteConversation(id: string) {
    if (!confirm("저장된 대화를 삭제할까요?")) return;
    await createClient().from("ai_conversations").delete().eq("id", id);
    await loadSaved();
  }

  function handleLoadConversation(c: SavedConversation) {
    setMessages(c.messages);
    setShowSaved(false);
    setSaveNotice(null);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);

    const res = await fetch("/api/ai/socratic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityId, messages: next, model }),
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setError(data?.error ?? "요청에 실패했습니다.");
      setMessages(messages); // 실패한 입력 롤백
      setInput(text);
    } else {
      setMessages([...next, { role: "assistant", content: data.reply }]);
      setRemaining(data.remaining);
      requestAnimationFrame(() =>
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
      );
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="max-h-96 min-h-40 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <p className="text-sm text-zinc-500">
              문제를 풀다 막힌 지점을 이야기해 보세요. AI 튜터가 정답 대신,
              스스로 풀 수 있도록 질문으로 도와줍니다.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "self-end bg-blue-600 text-white"
                      : "self-start bg-zinc-100 text-zinc-800"
                  }`}
                >
                  {m.content}
                </div>
              ))}
              {loading && (
                <div className="self-start rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-400">
                  생각 중...
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={2000}
          placeholder="막힌 부분을 이야기해 보세요"
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          보내기
        </button>
      </form>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-xs text-zinc-400">
            {remaining !== null
              ? `오늘 남은 질문 횟수: ${remaining}회`
              : "일일 한도: 20회"}
          </p>
          <ModelPicker models={models} value={model} onChange={setModel} />
        </div>
        <div className="flex gap-2">
          {messages.length >= 2 && (
            <button
              onClick={handleSaveConversation}
              className="rounded-md border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
            >
              💾 대화 저장
            </button>
          )}
          <button
            onClick={toggleSavedList}
            className="rounded-md border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
          >
            저장된 대화 {saved !== null ? `(${saved.length}/5)` : "보기"}
          </button>
        </div>
      </div>

      {saveNotice && (
        <p
          className={`text-sm ${
            saveNotice.includes("저장되었습니다") ? "text-green-600" : "text-amber-600"
          }`}
        >
          {saveNotice}
        </p>
      )}

      {showSaved && saved !== null && (
        <div className="rounded-lg border border-zinc-200 bg-white p-3">
          <p className="mb-2 text-xs font-medium text-zinc-500">
            저장된 대화 ({saved.length}/5) — 저장은 최대 5개, 초과 시 삭제 후 저장
          </p>
          {saved.length === 0 ? (
            <p className="text-sm text-zinc-400">저장된 대화가 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {saved.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-zinc-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-zinc-800">{c.title}</p>
                    <p className="text-xs text-zinc-400">
                      {c.activity_title && `${c.activity_title} · `}
                      {new Date(c.created_at).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                  <button
                    onClick={() => handleLoadConversation(c)}
                    className="shrink-0 text-xs text-blue-600 hover:underline"
                  >
                    불러오기
                  </button>
                  <button
                    onClick={() => handleDeleteConversation(c.id)}
                    className="shrink-0 text-xs text-red-500 hover:underline"
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
