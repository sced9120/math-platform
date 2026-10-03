"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminHoldings } from "@/lib/admin-handover";

// 관리자: 내 학생·자료·AI 설정을 교사 계정 하나로 넘긴다.
// 넘긴 뒤 관리자 메뉴는 교사 관리·만져보는 수학만 남는다.
export default function HandoverPanel({
  holdings,
  teachers,
}: {
  holdings: AdminHoldings;
  teachers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const total = holdings.students + holdings.subjects + holdings.units + holdings.activities;
  if (total === 0 && !done) return null;

  async function handover() {
    const t = teachers.find((x) => x.id === to);
    if (!t) return;
    if (
      !confirm(
        `내 학생 ${holdings.students}명과 교과 ${holdings.subjects}·단원 ${holdings.units}·소단원 ${holdings.activities}개,\n` +
          `그리고 AI 키·모델·한도·프롬프트를 「${t.name}」 교사 계정으로 넘길까요?\n\n` +
          "· 학생은 지금처럼 학번만으로 로그인합니다 (학급 코드 없음)\n" +
          "· 학생 기록(진도·서술·사진)은 그대로이고, 이제 그 교사 계정에서 보입니다\n" +
          "· 넘긴 뒤 이 관리자 계정에는 교사 관리·만져보는 수학만 남습니다"
      )
    )
      return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/handover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return setError(data?.error ?? "넘기지 못했습니다.");
    const r = data.result as {
      students: number;
      subjects: number;
      units: number;
      activities: number;
      codeless: boolean;
    };
    setDone(
      `「${t.name}」 계정으로 학생 ${r.students}명, 교과 ${r.subjects}·단원 ${r.units}·소단원 ${r.activities}개를 넘겼습니다.` +
        (r.codeless ? " 이 교사의 학생은 앞으로도 학급 코드 없이 학번만으로 로그인합니다." : "")
    );
    router.refresh();
  }

  return (
    <section
      id="handover"
      className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm"
    >
      <h3 className="font-semibold text-zinc-900">내 학생·자료 넘기기</h3>
      {done ? (
        <p className="mt-2 text-sm text-green-800">✓ {done}</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-amber-900">
            관리자 계정은 이제 교사 계정만 관리합니다. 이 계정에 있는{" "}
            <b>
              학생 {holdings.students}명 · 교과 {holdings.subjects} · 단원 {holdings.units} · 소단원{" "}
              {holdings.activities}
            </b>
            과 AI 키·모델·한도·프롬프트를 수업용 교사 계정으로 옮기세요.
            학생은 <b>지금처럼 학번만으로</b> 로그인합니다.
          </p>
          {teachers.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-700">
              먼저 아래 <b>교사 계정 만들기</b>에서 선생님이 수업에 쓸 교사 계정을 만드세요.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              >
                <option value="">— 받을 교사 계정 —</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handover}
                disabled={!to || busy}
                className="rounded-md bg-amber-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {busy ? "넘기는 중..." : "넘기기"}
              </button>
            </div>
          )}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </>
      )}
    </section>
  );
}
