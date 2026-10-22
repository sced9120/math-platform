// 실시간 수업 — 교사와 학생이 같은 채널에 모여 서로의 상태를 본다.
//
// 새 테이블이 없다. 전부 Supabase Realtime 의 Presence 로만 돈다.
//   - 수업은 휘발성이다. 끝나면 남길 것이 없다(기록은 원래대로 screen_responses 에 쌓인다).
//   - Presence 는 늦게 들어온 사람에게도 현재 상태를 그대로 넘겨 준다.
//     그래서 '지각 접속' 처리를 따로 하지 않아도 된다.
//
// 교사의 상태(가리기·같이 넘기기)도 교사의 presence 안에 담는다.
// broadcast 를 쓰지 않는 이유 — broadcast 는 그 순간 접속해 있던 사람만 받는다.

export const lessonChannel = (activityId: string) => `lesson:${activityId}`;

export type StudentPresence = {
  role: "student";
  userId: string;
  name: string;
  /** 지금 보고 있는 화면 (0부터) */
  screenIndex: number;
  screenTotal: number;
  screenTitle: string;
  /** 손들기 — 누른 시각으로 줄을 세운다 */
  handAt: number | null;
  /** 활동을 끝까지 마친 시각 */
  doneAt: number | null;
};

export type TeacherPresence = {
  role: "teacher";
  userId: string;
  name: string;
  /** 화면 가리기 — 켜면 학생은 보지도 만지지도 못한다 */
  blank: boolean;
  /** 같이 넘기기 */
  gotoIndex: number | null;
  /**
   * 같은 화면으로 다시 부를 수 있어야 하므로 번호만으로는 모자란다.
   * seq 가 늘어날 때만 학생이 따라간다 — 한 번 따라간 뒤에는
   * 스스로 다른 화면으로 가도 도로 끌려오지 않는다.
   */
  gotoSeq: number;
};

export type LessonPresence = StudentPresence | TeacherPresence;

export function isTeacher(p: LessonPresence): p is TeacherPresence {
  return p.role === "teacher";
}
export function isStudent(p: LessonPresence): p is StudentPresence {
  return p.role === "student";
}

/** presence 상태(키 → 항목 배열)를 납작하게 편다. */
export function flatten(
  state: Record<string, unknown[]>
): LessonPresence[] {
  const out: LessonPresence[] = [];
  for (const list of Object.values(state ?? {})) {
    for (const item of list ?? []) {
      const p = item as Partial<LessonPresence>;
      if (p && (p.role === "student" || p.role === "teacher") && p.userId) {
        out.push(p as LessonPresence);
      }
    }
  }
  return out;
}

/** 손든 학생을 누른 순서대로. */
export function handQueue(students: StudentPresence[]): StudentPresence[] {
  return students
    .filter((s) => s.handAt != null)
    .sort((a, b) => (a.handAt ?? 0) - (b.handAt ?? 0));
}

/** 이름 → 번호가 앞에 붙어 있으면 숫자로, 아니면 이름순. */
export function byRoster(a: { name: string }, b: { name: string }) {
  const na = parseInt(a.name, 10);
  const nb = parseInt(b.name, 10);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return a.name.localeCompare(b.name, "ko");
}
