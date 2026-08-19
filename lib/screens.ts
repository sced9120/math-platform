// 활동 안의 "화면" 구조 (docs/07_SCREEN_ARCHITECTURE.md)
//
// 화면 = 유형 + 설정 + 질문[]
// 유형에 따라 플랫폼이 렌더러를 고른다. iframe 은 html·legacy 에서만 쓴다.

export type ScreenType = "text" | "plane" | "geogebra" | "image" | "html" | "legacy";

export const SCREEN_TYPE_LABEL: Record<ScreenType, string> = {
  text: "글",
  plane: "좌표평면",
  geogebra: "지오지브라",
  image: "사진",
  html: "직접 만든 조작 (HTML)",
  legacy: "예전 활동 통째",
};

// 유형별 설정 — 저장은 jsonb 하나라 필요한 것만 채운다
export type ScreenConfig = {
  body?: string; // text: 본문 HTML
  materialId?: string; // geogebra: 자료 ID
  height?: number; // geogebra/html/image: 높이(px)
  imagePath?: string; // image: activity-files 버킷 경로
  caption?: string; // image: 설명
  html?: string; // html: 이 화면만의 HTML+JS
  plane?: PlaneConfig; // plane: 좌표평면 설정
};

// 좌표평면 화면 — 코드 없이 설정만으로 만든다
export type PlaneConfig = {
  min: number; // 가로·세로 공통 범위
  max: number;
  grid: boolean;
  points: { name: string; x: number; y: number; draggable: boolean; color?: string }[];
  segments: { from: string; to: string; color?: string; label?: boolean }[];
  lines: { m: number; n: number; color?: string }[]; // y = mx + n
  circles: { center: string; r: number; color?: string }[];
  readouts: ("distance" | "slope" | "midpoint")[]; // 오른쪽에 실시간으로 보여 줄 값
};

export const DEFAULT_PLANE: PlaneConfig = {
  min: -7,
  max: 7,
  grid: true,
  points: [
    { name: "A", x: -2, y: -1, draggable: true },
    { name: "B", x: 3, y: 3, draggable: true },
  ],
  segments: [{ from: "A", to: "B", label: true }],
  lines: [],
  circles: [],
  readouts: ["distance"],
};

// 질문 — 화면당 여러 개. 정답(answer·tolerance)은 학생에게 내려가지 않는다.
export type Question =
  | { id: string; type: "text"; prompt: string; photo?: boolean }
  | { id: string; type: "short"; prompt: string; answer?: string; tolerance?: number }
  | { id: string; type: "choice"; prompt: string; choices: string[]; answer?: string };

export const QUESTION_TYPE_LABEL: Record<Question["type"], string> = {
  text: "서술형",
  short: "단답형 (자동 채점)",
  choice: "선택형",
};

export type Screen = {
  id?: string;
  screen_key: string;
  order_index: number;
  type: ScreenType;
  title: string;
  config: ScreenConfig;
  questions: Question[];
  sheet: string;
  teach: Record<string, unknown>;
};

// 화면키는 학생 기록이 붙는 값이라 한번 정하면 바꾸지 않는다.
// 새로 만들 때만 쓰는 생성기 — 이미 있는 키를 피한다.
export function nextScreenKey(existing: string[]): string {
  const used = new Set(existing);
  for (let i = 1; i < 1000; i++) {
    const k = `s${i}`;
    if (!used.has(k)) return k;
  }
  return `s${Date.now()}`;
}

export function newQuestionId(existing: string[]): string {
  const used = new Set(existing);
  for (let i = 1; i < 1000; i++) {
    const k = `q${i}`;
    if (!used.has(k)) return k;
  }
  return `q${Date.now()}`;
}

export function emptyQuestion(type: Question["type"], id: string): Question {
  if (type === "short") return { id, type, prompt: "", answer: "" };
  if (type === "choice") return { id, type, prompt: "", choices: ["", ""], answer: "0" };
  return { id, type: "text", prompt: "", photo: false };
}
