export type Unit = {
  id: string;
  title: string;
  grade: number;
  order_index: number;
  is_published: boolean;
  created_at: string;
};

export type ActivityType = "geogebra" | "content" | "problem" | "image" | "html";

// content(jsonb)의 유형별 형태
// geogebra: { materialId: string, height: number }
// content:  { body: string }
// problem:  { question: string, answer: string, tolerance: number }
// image:    { imagePath: string, caption?: string }
// html:     { html: string, height: number }
// 공통 옵션: { response_prompt?: string } — 있으면 학생 글 작성란 표시
export type Activity = {
  id: string;
  unit_id: string;
  type: ActivityType;
  title: string;
  content: Record<string, unknown>;
  order_index: number;
  is_published: boolean;
  assigned_classes: number[] | null; // null = 학년 전체, 배열 = 지정 반만
  created_at: string;
};

export type StudentRow = {
  grade: number;
  class_no: number;
  student_no: number;
  name: string;
};

// 학번 규칙: 학년(1) + 반(2자리) + 번호(2자리) → 예: 1학년 3반 15번 = 10315
export function toStudentId(s: StudentRow): string {
  return `${s.grade}${String(s.class_no).padStart(2, "0")}${String(
    s.student_no
  ).padStart(2, "0")}`;
}
