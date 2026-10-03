import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// 체험판 전용 조회 (로그인 없이 열리는 화면에서 쓴다)
//
// 안전 규칙 — 이 파일에서는 절대 벗어나지 않는다.
//  1) 읽기만 한다. INSERT/UPDATE/DELETE 를 하지 않는다.
//  2) 공개된 것만 — 교과·단원·활동이 모두 is_published 여야 한다.
//  3) 정답을 내보내지 않는다 — problem 유형의 answer/tolerance 를 지운다.
//  4) 학생 개인정보(profiles, progress)는 아예 건드리지 않는다.
//  5) 사이트 운영자(가장 먼저 만들어진 관리자)의 자료만 — 누구나 교사로 가입하는 구조라
//     다른 교사의 자료가 체험판에 섞이면 안 된다. (0016 이전엔 owner_id 가 없어 그대로 통과)

export type DemoActivity = {
  id: string;
  title: string;
  type: string;
  unit_id: string;
  order_index: number;
  content: Record<string, unknown>;
};

export type DemoUnit = { id: string; title: string; order_index: number };
export type DemoSubject = { id: string; title: string; grade: number };

// 정답이 클라이언트로 나가지 않도록 걷어낸다
function stripAnswer(content: unknown): Record<string, unknown> {
  const c = (content ?? {}) as Record<string, unknown>;
  const { answer: _a, tolerance: _t, ...safe } = c;
  void _a;
  void _t;
  return safe;
}

// 사이트 운영자 = 가장 먼저 만들어진 관리자 (0016 이 기존 자료를 이 계정에 붙였다)
// profiles 의 role 만 읽는다(개인정보 아님).
async function siteOwnerId(db: ReturnType<typeof createAdminClient>): Promise<string | null> {
  const { data } = await db
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .order("created_at")
    .limit(1)
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

// owner_id 컬럼이 아직 없으면(undefined) 통과, 있으면 운영자 것만
function ownedBySite(row: { owner_id?: string | null }, owner: string | null): boolean {
  return row.owner_id === undefined || row.owner_id === owner;
}

// 체험용으로 보여 줄 교과 하나 (가장 앞선 공개 교과)
export async function getDemoSubject(): Promise<{
  subject: DemoSubject;
  units: DemoUnit[];
  activities: DemoActivity[];
} | null> {
  const db = createAdminClient();
  const owner = await siteOwnerId(db);

  // owner_id 는 0016 이후에만 있으므로 컬럼을 나열하지 않는다
  const { data: subjects } = await db
    .from("subjects")
    .select("*")
    .eq("is_published", true)
    .order("order_index");
  const found = ((subjects ?? []) as (DemoSubject & { owner_id?: string | null })[]).find((x) =>
    ownedBySite(x, owner)
  );
  if (!found) return null;
  const subject: DemoSubject = { id: found.id, title: found.title, grade: found.grade };

  const { data: units } = await db
    .from("units")
    .select("id, title, order_index")
    .eq("subject_id", subject.id)
    .eq("is_published", true)
    .order("order_index");
  const unitList = (units as DemoUnit[] | null) ?? [];
  if (unitList.length === 0) return { subject, units: [], activities: [] };

  const { data: acts } = await db
    .from("activities")
    .select("id, title, type, unit_id, order_index, content")
    .in(
      "unit_id",
      unitList.map((u) => u.id)
    )
    .eq("is_published", true)
    .order("order_index");

  const activities = ((acts as DemoActivity[] | null) ?? []).map((a) => ({
    ...a,
    content: stripAnswer(a.content),
  }));

  return { subject, units: unitList, activities };
}

// 화면 구성이 있는 소단원의 활동 목록 (공개된 것만).
// 질문의 정답(answer·tolerance)은 여기서 걷어낸다 — 체험판은 채점하지 않는다.
export async function getDemoScreens(activityId: string): Promise<DemoScreen[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("activity_screens")
    .select("screen_key, order_index, type, title, config, questions, sheet")
    .eq("activity_id", activityId)
    .order("order_index");

  return ((data as DemoScreen[] | null) ?? []).map((s) => ({
    ...s,
    questions: (s.questions ?? []).map((q) => {
      const { answer: _a, tolerance: _t, ...safe } = q as Record<string, unknown>;
      void _a;
      void _t;
      return safe as DemoScreen["questions"][number];
    }),
  }));
}

export type DemoScreen = {
  screen_key: string;
  order_index: number;
  type: string;
  title: string;
  config: Record<string, unknown>;
  questions: { id: string; type: string; prompt: string; photo?: boolean; choices?: string[] }[];
  sheet: string;
};

// 체험용 활동 하나 (공개된 것만)
export async function getDemoActivity(id: string): Promise<
  | (DemoActivity & { unitTitle: string; subjectTitle: string })
  | null
> {
  const db = createAdminClient();
  const owner = await siteOwnerId(db);

  const { data: a } = await db
    .from("activities")
    .select("*")
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle<DemoActivity & { is_published: boolean; owner_id?: string | null }>();
  if (!a || !ownedBySite(a, owner)) return null;

  const { data: unit } = await db
    .from("units")
    .select("title, subject_id, is_published")
    .eq("id", a.unit_id)
    .maybeSingle<{ title: string; subject_id: string | null; is_published: boolean }>();
  if (!unit?.is_published || !unit.subject_id) return null;

  const { data: subject } = await db
    .from("subjects")
    .select("title, is_published")
    .eq("id", unit.subject_id)
    .maybeSingle<{ title: string; is_published: boolean }>();
  if (!subject?.is_published) return null;

  return {
    id: a.id,
    title: a.title,
    type: a.type,
    unit_id: a.unit_id,
    order_index: a.order_index,
    content: stripAnswer(a.content),
    unitTitle: unit.title,
    subjectTitle: subject.title,
  };
}
