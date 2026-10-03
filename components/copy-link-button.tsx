"use client";

import { useState } from "react";

// 이 사이트 안의 경로를 전체 주소로 바꿔 복사한다 (학생에게 링크만 나눠 줄 때)
export default function CopyLinkButton({
  path,
  label = "🔗 링크 복사",
  className = "rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50",
}: {
  path: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // 클립보드 권한이 없으면 직접 복사할 수 있게 보여 준다
      window.prompt("이 주소를 복사하세요", url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button type="button" onClick={copy} className={className}>
      {copied ? "✓ 복사됨" : label}
    </button>
  );
}
