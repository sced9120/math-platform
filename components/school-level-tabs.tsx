import Link from "next/link";
import { SCHOOL_LEVELS, type SchoolLevel } from "@/lib/manipulatives";

// 만져보는 수학의 학교급 메뉴 (초등학교 · 중학교 · 고등학교)
//  - 공개 목록(서버)은 hrefFor 로 링크를, 교사 화면·가져오기 창(클라이언트)은 onSelect 로 버튼을 쓴다
export default function SchoolLevelTabs({
  current,
  counts,
  hrefFor,
  onSelect,
  size = "md",
}: {
  current: SchoolLevel;
  counts: Record<SchoolLevel, number>;
  hrefFor?: (level: SchoolLevel) => string;
  onSelect?: (level: SchoolLevel) => void;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-2 text-sm";
  return (
    <nav className="flex flex-wrap gap-1 rounded-xl bg-zinc-100 p-1" aria-label="학교급">
      {SCHOOL_LEVELS.map(({ key, label }) => {
        const on = key === current;
        const cls = `rounded-lg font-medium transition-colors ${pad} ${
          on ? "bg-white text-blue-700 shadow-sm" : "text-zinc-600 hover:text-zinc-900"
        }`;
        const body = (
          <>
            {label}
            <span className={`ml-1.5 text-xs ${on ? "text-blue-400" : "text-zinc-400"}`}>
              {counts[key]}
            </span>
          </>
        );
        return hrefFor ? (
          <Link key={key} href={hrefFor(key)} className={cls} aria-current={on ? "page" : undefined}>
            {body}
          </Link>
        ) : (
          <button key={key} type="button" onClick={() => onSelect?.(key)} className={cls} aria-pressed={on}>
            {body}
          </button>
        );
      })}
    </nav>
  );
}
