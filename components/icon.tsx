// 플랫폼에서 쓰는 선 아이콘 한 벌.
//   원본  Lucian Icons v2.0.13 — MIT (c) 2026 Lucian
//         https://lucianlabs.dev/icons/
//   내려받은 뒤 "선(line) 모드" 로 바꿨다. 아이콘마다 박혀 있던 강조색과
//   면을 채우던 틴트를 지워서, 획이 전부 둘레 글자색(currentColor)을 따른다.
//   움직이지 않는다 — 원본은 웹컴포넌트로 애니메이션이 붙지만
//   수업 화면에서 튀지 않도록 정지된 인라인 SVG 로만 쓴다.
//
// 쓰는 법
//   <Icon name="edit" />              글자 옆 16px (기본)
//   <Icon name="chart" size={18} />   내비게이션
//   <Icon name="chevron" className={open ? "rotate-180" : ""} />
//   label 을 주면 스크린리더가 읽고, 안 주면 장식으로 보아 건너뛴다.
//   (글자가 바로 옆에 있으면 label 을 주지 않는 쪽이 맞다)
import type { SVGProps } from "react";

const PATHS = {
  edit: <><g><path fill="none" d="M15.5 4.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4z"/><path d="m13.5 6.5 3 3"/></g><path d="M12.5 20h8"/></>,
  menu: <><path d="M4 6.5h16"/><path d="M4 12h16"/><path d="M4 17.5h16"/></>,
  close: <><path d="M6 6l12 12M18 6 6 18"/></>,
  chevron: <><path d="m6 9 6 6 6-6"/></>,
  alert: <><path fill="none" d="M10.3 4.2 2.9 17.2a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.2a1.95 1.95 0 0 0-3.4 0z"/><path d="M12 9.5v4.25"/><path d="M12 16.75h.01"/></>,
  keyboard: <><rect fill="none" x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M9 9.75h.01M18 9.75h.01M10.5 12.5h.01"/><g><path d="M6 9.75h.01"/></g><g><path d="M13.5 12.5h.01"/></g><g><path d="M12 9.75h.01"/></g><g><path d="M7.5 12.5h.01"/></g><g><path d="M15 9.75h.01"/></g><g><path d="M16.5 12.5h.01"/></g><g><path d="M8.5 15.25h7"/></g></>,
  help: <><circle fill="none" cx="12" cy="12" r="8.75"/><g><path d="M9.5 9.5a2.5 2.5 0 0 1 4.85.85c0 1.65-2.35 2.15-2.35 3.4"/><path d="M12 16.75h.01"/></g></>,
  arrow: <><g><path d="M4.5 12h15"/><path d="m13.5 6 6 6-6 6"/></g></>,
  cursor: <><path fill="none" d="m9 9 11.5 4.6-5 1.9-1.9 5z"/><path d="M9 3v2.4M3 9h2.4M4.75 4.75l1.7 1.7M13.25 4.75l-1.2 1.2"/></>,
  users: <><g><path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M17.5 14.6c2.4.6 4 2.6 4 5.9"/></g><g><path fill="none" d="M2.5 20.5c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle fill="none" cx="9" cy="8" r="3.5"/></g></>,
  graduation: <><path fill="none" d="M12 4.5 22 9l-10 4.5L2 9z"/><path d="M6.5 11v4.25c0 1.5 2.5 2.75 5.5 2.75s5.5-1.25 5.5-2.75V11"/><path d="M12 9h8"/><g><path d="M20 9v5"/><path fill="currentColor" stroke="none" d="M19.15 14h1.7v2.5a.85.85 0 0 1-1.7 0z"/></g></>,
  book: <><path fill="none" d="M12 6.5C10.5 5.3 8.3 4.75 5.5 4.75H3.75v13h1.75c2.8 0 5 .55 6.5 1.75"/><path fill="none" d="M12 6.5c1.5-1.2 3.7-1.75 6.5-1.75h1.75v13H18.5c-2.8 0-5 .55-6.5 1.75z"/><path d="M12 6.5v13"/></>,
  layers: <><path d="m3 16.25 9 4.75 9-4.75"/><path d="m3 12 9 4.75L21 12"/><path fill="none" d="m12 3 9 4.75-9 4.75-9-4.75z"/></>,
  chart: <><path d="M3 20.5h18"/><rect fill="none" x="4.5" y="12.5" width="4" height="6.5" rx="1"/><rect fill="none" x="10" y="8.5" width="4" height="10.5" rx="1"/><g><rect fill="currentColor" stroke="none" x="15.5" y="4.5" width="4" height="14.5" rx="1"/><rect x="15.5" y="4.5" width="4" height="14.5" rx="1"/></g></>,
  download: <><path fill="none" d="M3.75 14.5v3.25A2.25 2.25 0 0 0 6 20h12a2.25 2.25 0 0 0 2.25-2.25V14.5"/><path d="M12 3.5v10.5"/><path d="m7.75 9.75 4.25 4.25 4.25-4.25"/><g transform="translate(12 9) scale(0.6) translate(-12 -9)" opacity="0"><path d="M12 4.5v5.25"/><path d="M12 13h.01"/></g></>,
  camera: <><path fill="none" d="M4.5 7.5h2.6l1.5-2.25A1.5 1.5 0 0 1 9.85 4.5h4.3a1.5 1.5 0 0 1 1.25.75l1.5 2.25h2.6a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2z"/><circle cx="12" cy="13.25" r="3.75"/><circle fill="currentColor" stroke="none" cx="12" cy="13.25" r="1.6"/></>,
  chat: <><path fill="none" d="M7.5 17.5 4 20.5V7a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 20 7v8a2.5 2.5 0 0 1-2.5 2.5z"/><circle fill="currentColor" stroke="none" cx="8.5" cy="11" r="1.15"/><circle fill="currentColor" stroke="none" cx="12" cy="11" r="1.15"/><circle fill="currentColor" stroke="none" cx="15.5" cy="11" r="1.15"/></>,
  key: <><circle fill="none" cx="7.75" cy="16.25" r="4.25"/><circle fill="currentColor" stroke="none" cx="7.25" cy="16.75" r="1.2"/><path d="m10.75 13.25 9-9M16.75 7.25l2.5 2.5M14.25 9.75l2 2"/></>,
  wrench: <><path fill="none" d="M6.35 19.85L12.98 13.21A5 5 0 0 0 19.8 6.68L16.91 9.56L14.44 7.09L17.32 4.2A5 5 0 0 0 10.79 11.02L4.15 17.65A1.55 1.55 0 0 0 6.35 19.85z"/><circle fill="currentColor" stroke="none" cx="5.25" cy="18.75" r=".85"/></>,
  save: <><path fill="none" d="M5 3.5h11.5l4 4V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5z"/><path d="M7.5 3.5v4a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-4"/><path d="M13 5.25v1.5"/><path d="M7 20.5V14a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v6.5"/></>,
  document: <><path fill="none" d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M8.5 12.5h7"/><path d="M8.5 16h4.5"/></>,
  bulb: <><path fill="none" d="M10 17.75V15.75C10 15.15 9.79 14.52 9.1 13.94A4.5 4.5 0 1 1 14.9 13.94C14.21 14.52 14 15.15 14 15.75V17.75z"/><path d="M10.25 20.5h3.5"/></>,
  link: <><path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.54 3.54 0 0 0-5-5l-1 1"/><path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.54 3.54 0 0 0 5 5l1-1"/></>,
  search: <><g><circle fill="none" cx="10.5" cy="10.5" r="6.75"/><path d="m15.4 15.4 5.1 5.1"/></g></>,
  sparkle: <><path fill="none" d="M10 4c.55 4.3 2.2 5.95 6.5 6.5-4.3.55-5.95 2.2-6.5 6.5-.55-4.3-2.2-5.95-6.5-6.5C7.8 9.95 9.45 8.3 10 4z"/><path fill="currentColor" stroke="none" d="M18 13.5c.3 2.1 1.1 2.9 3.2 3.2-2.1.3-2.9 1.1-3.2 3.2-.3-2.1-1.1-2.9-3.2-3.2 2.1-.3 2.9-1.1 3.2-3.2z"/><path d="M18.5 4.5h.01"/></>,
  check: <><path d="m4.75 12.5 4.5 4.5 10-10"/></>,
  info: <><circle fill="none" cx="12" cy="12" r="9"/><circle fill="currentColor" stroke="none" cx="12" cy="7.75" r="1.25"/><path d="M10.75 11H12v5.75M10.5 16.75h3"/></>,
} as const;

export type IconName = keyof typeof PATHS;

/** 이름 → 우리말. aria-label 을 따로 안 줄 때 참고용. */
export const ICON_LABELS: Record<IconName, string> = {
  edit: "연필",
  menu: "메뉴",
  close: "닫기",
  chevron: "펼침",
  alert: "경고",
  keyboard: "키보드",
  help: "도움말",
  arrow: "화살표",
  cursor: "조작",
  users: "사람들",
  graduation: "학생",
  book: "책",
  layers: "겹",
  chart: "막대 차트",
  download: "내려받기",
  camera: "사진",
  chat: "말풍선",
  key: "열쇠",
  wrench: "공구",
  save: "저장",
  document: "문서",
  bulb: "전구",
  link: "링크",
  search: "돋보기",
  sparkle: "반짝임",
  check: "확인",
  info: "정보"
};

export default function Icon({
  name,
  size = 16,
  label,
  className = "",
  ...rest
}: {
  name: IconName;
  size?: number;
  label?: string;
  className?: string;
} & Omit<SVGProps<SVGSVGElement>, "name" | "ref">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block shrink-0 align-[-0.18em] ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
