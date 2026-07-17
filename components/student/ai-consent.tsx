"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// AI 사용 전 고지·동의 게이트 (서버도 동의 여부를 별도로 강제한다)
export default function AiConsent({ onConsent }: { onConsent: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAgree() {
    setBusy(true);
    setError(null);
    const { error } = await createClient().rpc("accept_ai_consent");
    if (error) {
      setError("처리에 실패했습니다. 다시 시도하세요.");
      setBusy(false);
      return;
    }
    onConsent();
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
      <h3 className="mb-2 font-semibold text-zinc-900">AI 기능 사용 안내</h3>
      <ul className="mb-4 list-disc pl-5 text-sm leading-relaxed text-zinc-700">
        <li>
          질문·풀이 내용이 외부 AI 서비스(OpenAI 등)로 전송되어 답변 생성에
          사용됩니다.
        </li>
        <li>이름, 학번 등 개인정보는 전송되지 않습니다.</li>
        <li>AI는 정답을 직접 알려주지 않고, 스스로 풀도록 돕기만 합니다.</li>
        <li>하루 사용 횟수에 한도가 있습니다 (질문 20회, 첨삭 10회).</li>
      </ul>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <button
        onClick={handleAgree}
        disabled={busy}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? "처리 중..." : "동의하고 시작하기"}
      </button>
    </div>
  );
}
