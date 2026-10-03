import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasLegacyContent } from "@/lib/client/append-screen";
import HandsOnManager, { type TargetActivity } from "@/components/teacher/hands-on-manager";
import type { Manipulative } from "@/lib/manipulatives";

// 교사용 만져보는 수학
//  - 누구나: 열어 보기 · 링크 복사(학생 기록 없이 쓰기) · 내 소단원에 활동 한 화면으로 추가
//  - 관리자: 자료 만들기·고치기·공개 설정 (만져보는 수학은 사이트 전체가 함께 보는 자료)
export default async function TeacherHandsOnPage() {
  const profile = await requireProfile();
  const isAdmin = profile.role === "admin";
  const supabase = await createClient();

  // 관리자는 비공개 자료까지(RLS manipulatives_admin_all), 교사는 공개된 것만
  const itemsQuery = supabase
    .from("manipulatives")
    .select("*")
    .order("topic")
    .order("order_index");

  const [itemsRes, actsRes, screensRes] = await Promise.all([
    isAdmin ? itemsQuery : itemsQuery.eq("is_published", true),
    // 내 소단원 (RLS 가 내 것만 돌려준다)
    supabase
      .from("activities")
      .select("id, title, type, content, order_index, units(title, order_index)")
      .order("order_index"),
    supabase.from("activity_screens").select("activity_id"),
  ]);

  type Row = {
    id: string;
    title: string;
    type: string;
    content: Record<string, unknown> | null;
    order_index: number;
    units: { title: string; order_index: number } | null;
  };
  const screenCount = new Map<string, number>();
  for (const r of (screensRes.data ?? []) as { activity_id: string }[]) {
    screenCount.set(r.activity_id, (screenCount.get(r.activity_id) ?? 0) + 1);
  }

  // 큰 HTML 을 클라이언트로 보내지 않도록 서버에서 "붙일 수 있는가"만 계산한다
  const targets: TargetActivity[] = ((actsRes.data ?? []) as unknown as Row[])
    .map((a) => ({
      id: a.id,
      title: a.title,
      unit: a.units?.title ?? "단원 없음",
      unitOrder: a.units?.order_index ?? 999,
      order: a.order_index,
      // 화면 구성을 쓰는 소단원이거나, 예전 내용이 없는 빈 소단원이어야 한다
      eligible: (screenCount.get(a.id) ?? 0) > 0 || !hasLegacyContent(a),
    }))
    .sort((x, y) => x.unitOrder - y.unitOrder || x.order - y.order)
    .map(({ id, title, unit, eligible }) => ({ id, title, unit, eligible }));

  return (
    <HandsOnManager
      initialItems={(itemsRes.data as Manipulative[] | null) ?? []}
      loadError={!!itemsRes.error}
      isAdmin={isAdmin}
      targets={targets}
    />
  );
}
