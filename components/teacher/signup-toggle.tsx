"use client";

import { useState } from "react";
import CopyLinkButton from "@/components/copy-link-button";

// 관리자: 누구나 교사로 가입할 수 있게 열고 닫는다
export default function SignupToggle({ initialOpen }: { initialOpen: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !open;
    if (
      next &&
      !confirm(
        "누구나 교사로 가입할 수 있게 엽니다.\n\n" +
          "가입한 교사는 자기 자료·자기 학생만 봅니다(선생님 자료와 학생은 보이지 않음).\n" +
          "다만 그 교사의 학생도 AI 문답·첨삭을 쓰므로, 등록한 AI 키의 사용량이 늘 수 있습니다.\n" +
          "(학생 1명당 하루 한도는 'AI 키·모델'에서 정한 값이 그대로 적용됩니다)"
      )
    )
      return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/site-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openSignup: next }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) setError(data?.error ?? "저장하지 못했습니다.");
    else setOpen(!!data.openSignup);
    setBusy(false);
  }

  return (
    <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-zinc-900">누구나 교사 가입</h3>
          <p className="mt-1 text-sm text-zinc-500">
            {open
              ? "열림 — 누구나 /signup 에서 교사 계정을 만들어 자기 학급을 꾸릴 수 있습니다."
              : "닫힘 — 교사 계정은 아래에서 관리자가 직접 만듭니다."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {open && <CopyLinkButton path="/signup" label="🔗 가입 링크 복사" />}
          <button
            onClick={toggle}
            disabled={busy}
            className={`rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-50 ${
              open ? "bg-green-600 text-white hover:bg-green-700" : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
            }`}
          >
            {open ? "열림" : "닫힘"}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
