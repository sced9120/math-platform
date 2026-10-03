// 학급 코드 — 학번(10101)은 학교마다 겹치므로, 교사마다 코드를 하나씩 둔다.
//
//  - 관리자(사이트 운영자)의 학생: 코드 없음 → 학번만으로 로그인 (예전 그대로)
//  - 그 밖의 교사의 학생:        "학번 + 학급 코드"로 로그인
//
// 내부 가상 이메일 규칙 (실제 이메일은 받지 않는다)
//  - 교사·관리자:  {아이디}@school.local          (아이디는 영문으로 시작, 점 없음)
//  - 학생(코드 없음): {학번}@school.local
//  - 학생(코드 있음): {학번}.{학급코드}@school.local
// 교사 아이디에는 점이 없으므로 세 가지가 서로 겹치지 않는다.

export const CLASS_CODE_RE = /^[a-z0-9]{4,12}$/;

// 헷갈리는 글자(0/o, 1/l/i)를 뺀 6자리 — DB 의 new_class_code() 와 같은 규칙
const CODE_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";

export function generateClassCode(len = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

export function normalizeClassCode(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

export function studentEmail(studentId: string, classCode?: string | null): string {
  const code = normalizeClassCode(classCode);
  return code ? `${studentId}.${code}@school.local` : `${studentId}@school.local`;
}

// 로그인 창에 적은 아이디를 내부 이메일로 바꾼다.
//  숫자만 → 학생 (학급 코드가 있으면 붙인다), 그 밖 → 교사 아이디
export function loginEmail(id: string, classCode?: string | null): string {
  const v = id.trim();
  if (/^\d+$/.test(v)) return studentEmail(v, classCode);
  return `${v.toLowerCase()}@school.local`;
}

// 학생에게 나눠 줄 로그인 주소 (학급 코드가 미리 채워진다)
export function classLoginPath(classCode: string | null | undefined): string {
  const code = normalizeClassCode(classCode);
  return code ? `/login?c=${encodeURIComponent(code)}` : "/login";
}
