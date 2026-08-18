// 화면별 기록(screen_responses)을 교사 화면·엑셀로 옮길 때 쓰는 공통 규칙.
// 학생/교사 양쪽에서 같은 문구가 나오도록 여기 한 곳에만 둔다.

export const ATTACHMENT_NOTE = "첨부파일 참고";

// 학생이 올린 사진이 담기는 비공개 버킷
export const UPLOAD_BUCKET = "student-uploads";

export type ScreenAnswer = {
  key: string;
  prompt: string;
  text: string;
  images: string[];
  updatedAt?: string;
};

// 화면키 → 사람이 읽는 짧은 이름 (s1, s2 … / ext / free)
export function screenLabel(key: string): string {
  if (key === "free") return "자유 기록";
  if (key === "ext") return "개념확장 탐구";
  const m = /^s(\d+)$/.exec(key);
  if (m) return `${m[1]}번 화면`;
  return key;
}

// 한 화면의 기록을 한 줄 문장으로.
// 사진으로 낸 칸은 글 대신(또는 글과 함께) "첨부파일 참고" 를 남긴다.
export function answerText(a: ScreenAnswer): string {
  const text = (a.text ?? "").trim();
  const count = a.images?.length ?? 0;
  if (count === 0) return text;
  const note = `${ATTACHMENT_NOTE}(사진 ${count}장)`;
  return text ? `${text} / ${note}` : note;
}

// 활동 하나에 달린 화면 기록 전부 → 엑셀 한 칸
export function screensToCell(list: ScreenAnswer[]): string {
  return list
    .map((a) => {
      const body = answerText(a);
      return body ? `[${screenLabel(a.key)}] ${body}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

// 화면키 정렬: s1, s2 … → ext → free (숫자는 숫자 순서로)
export function compareScreenKeys(a: string, b: string): number {
  const rank = (k: string) => (k === "free" ? 3 : k === "ext" ? 2 : 1);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  const na = Number(/^s(\d+)$/.exec(a)?.[1] ?? NaN);
  const nb = Number(/^s(\d+)$/.exec(b)?.[1] ?? NaN);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return a.localeCompare(b);
}
