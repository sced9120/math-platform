"use client";

import { useRef, useState } from "react";
import AiConsent from "@/components/student/ai-consent";

type ChatMessage = { role: "user" | "assistant"; content: string };

// 소크라테스 챗봇. 대화는 화면(메모리)에만 유지되고 DB에 저장되지 않는다.
export default function SocraticChat({
  activityId,
  consented,
  onConsent,
}: {
  activityId: string;
  consented: boolean;
  onConsent: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  if (!consented) {
    return <AiConsent onConsent={onConsent} />;
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
      body: JSON.stringify({ activityId, messages: next }),
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

      <p className="text-xs text-zinc-400">
        {remaining !== null
          ? `오늘 남은 질문 횟수: ${remaining}회`
          : "일일 한도: 20회 · 대화 내용은 저장되지 않습니다."}
      </p>
    </div>
  );
}
