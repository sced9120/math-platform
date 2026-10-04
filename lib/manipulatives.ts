import type { ScreenConfig, ScreenType } from "@/lib/screens";

// 만져보는 수학 — 로그인 없이 누구나 여는 조작 자료 (마이그레이션 0017)
// config 는 활동 화면(activity_screens.config)과 같은 모양이라
// 교사가 자기 소단원에 그대로 복사해 넣을 수 있다.
export type Manipulative = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  topic: string;
  school_level: SchoolLevel; // 0018
  order_index: number;
  type: Exclude<ScreenType, "legacy">;
  config: ScreenConfig;
  is_published: boolean;
  created_at?: string;
};

export const MANIPULATIVE_TYPES: Manipulative["type"][] = [
  "plane",
  "html",
  "geogebra",
  "text",
  "image",
];

// 학교급 메뉴 (0018) — 목록·교사 화면·가져오기 창이 모두 이 순서로 나눈다
export type SchoolLevel = "elementary" | "middle" | "high";

export const SCHOOL_LEVELS: { key: SchoolLevel; label: string }[] = [
  { key: "elementary", label: "초등학교" },
  { key: "middle", label: "중학교" },
  { key: "high", label: "고등학교" },
];

export function schoolLevelLabel(level: SchoolLevel): string {
  return SCHOOL_LEVELS.find((l) => l.key === level)?.label ?? level;
}

export function isSchoolLevel(v: unknown): v is SchoolLevel {
  return SCHOOL_LEVELS.some((l) => l.key === v);
}

// 처음 열 학교급: 자료가 있는 첫 학교급 (아무것도 없으면 중학교)
export function firstLevelWithItems(items: Pick<Manipulative, "school_level">[]): SchoolLevel {
  return SCHOOL_LEVELS.find((l) => items.some((m) => m.school_level === l.key))?.key ?? "middle";
}

export function countByLevel(items: Pick<Manipulative, "school_level">[]): Record<SchoolLevel, number> {
  const c: Record<SchoolLevel, number> = { elementary: 0, middle: 0, high: 0 };
  for (const m of items) if (m.school_level in c) c[m.school_level]++;
  return c;
}

// 한 학교급 안에서 분류(topic)별로 묶는다 — 들어온 순서(분류·순서 정렬)를 지킨다
export function groupByTopic<T extends Pick<Manipulative, "topic">>(items: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const m of items) {
    const k = m.topic || "기타";
    groups.set(k, [...(groups.get(k) ?? []), m]);
  }
  return [...groups.entries()];
}

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,59}$/;

// 공개 주소 (학생에게 링크만 나눠 줄 때)
export function manipulativePath(slug: string): string {
  return `/hands-on/${slug}`;
}
