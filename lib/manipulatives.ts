import type { ScreenConfig, ScreenType } from "@/lib/screens";

// 만져보는 수학 — 로그인 없이 누구나 여는 조작 자료 (마이그레이션 0016)
// config 는 활동 화면(activity_screens.config)과 같은 모양이라
// 교사가 자기 소단원에 그대로 복사해 넣을 수 있다.
export type Manipulative = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  topic: string;
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

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,59}$/;

// 공개 주소 (학생에게 링크만 나눠 줄 때)
export function manipulativePath(slug: string): string {
  return `/hands-on/${slug}`;
}
