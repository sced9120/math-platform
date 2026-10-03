import type { SupabaseClient } from "@supabase/supabase-js";
import { nextScreenKey, type Question, type Screen, type ScreenType } from "@/lib/screens";

// 소단원 끝에 활동(화면) 하나를 붙인다.
// 조작 활동 만들기·만져보는 수학·다른 활동에서 가져오기가 같은 규칙을 쓰도록 한 곳에 모은다.
// 쓰기 권한은 activity_screens 의 RLS(내 소단원만)가 DB 에서 막아 준다.
export async function appendScreen(
  supabase: SupabaseClient,
  activityId: string,
  s: {
    type: ScreenType;
    title: string;
    config: Screen["config"];
    questions?: Question[];
    sheet?: string;
    teach?: Screen["teach"];
  }
): Promise<Screen> {
  // 화면키는 학생 기록이 붙는 값이다. 지금 있는 화면뿐 아니라
  // 지워진 화면의 기록이 남아 있는 키까지 피해야 옛 답이 새 화면에 붙지 않는다.
  // (docs/07_SCREEN_ARCHITECTURE.md — "화면키를 바꾸거나 재사용하지 않는다")
  const [{ data: rows, error: readErr }, { data: used }] = await Promise.all([
    supabase
      .from("activity_screens")
      .select("screen_key, order_index")
      .eq("activity_id", activityId),
    supabase.from("screen_responses").select("screen_key").eq("activity_id", activityId),
  ]);
  if (readErr) throw new Error(readErr.message);

  const existing = (rows ?? []) as { screen_key: string; order_index: number }[];
  const taken = [
    ...existing.map((r) => r.screen_key),
    ...((used ?? []) as { screen_key: string }[]).map((r) => r.screen_key),
  ];

  const { data, error } = await supabase
    .from("activity_screens")
    .insert({
      activity_id: activityId,
      screen_key: nextScreenKey(taken),
      order_index: existing.reduce((m, r) => Math.max(m, r.order_index + 1), 0),
      type: s.type,
      title: s.title,
      config: s.config ?? {},
      questions: s.questions ?? [],
      sheet: s.sheet ?? "",
      teach: s.teach ?? {},
    })
    .select("*")
    .single<Screen>();
  if (error || !data) throw new Error(error?.message ?? "저장하지 못했습니다.");
  return data;
}

// 예전 방식(HTML 한 덩어리 등) 내용이 들어 있는 소단원인가.
// 이런 소단원에 화면을 하나라도 붙이면 학생 화면이 새 방식으로 바뀌면서
// 예전 내용이 학생에게 안 보이게 된다. 그래서 바로 붙이지 않고 막아 둔다.
export function hasLegacyContent(a: {
  type: string;
  content: Record<string, unknown> | null;
}): boolean {
  const c = a.content ?? {};
  const filled = (k: string) => typeof c[k] === "string" && (c[k] as string).trim().length > 0;
  switch (a.type) {
    case "html":
      return filled("html");
    case "content":
      return filled("body");
    case "geogebra":
      return filled("materialId");
    case "image":
      return filled("imagePath");
    case "problem":
      return filled("question");
    default:
      return false;
  }
}
