// 폐기·교체 전에 학생 기록이 몇 건 있는지 세어 본다.
//   node --env-file=.env.local scripts/count-before-retire.mjs
// 지우기 전에 반드시 이 스크립트를 먼저 돌린다.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없습니다.");
  process.exit(1);
}
const s = createClient(url, key, { auth: { persistSession: false } });

// 이번에 손대는 활동들
const TITLES = ["유리함수", "무리함수", "🕵️ 가짜 해를 찾아라"];

const { data: acts, error } = await s
  .from("activities")
  .select("id, title, unit_id, is_published")
  .in("title", TITLES);
if (error) { console.error(error); process.exit(1); }

if (!acts.length) {
  console.log("해당 제목의 활동이 DB 에 없습니다.");
  process.exit(0);
}

let total = 0;
for (const a of acts) {
  const { count, error: e2 } = await s
    .from("screen_responses")
    .select("*", { count: "exact", head: true })
    .eq("activity_id", a.id);
  if (e2) { console.error(e2); process.exit(1); }
  total += count ?? 0;
  console.log(
    `${(count ?? 0) === 0 ? "🟢" : "🔴"} ${a.title.padEnd(18)} 기록 ${String(count ?? 0).padStart(4)} 건   (${a.is_published ? "공개" : "비공개"}, id ${a.id})`
  );
}
console.log(`\n합계 ${total} 건`);
console.log(total === 0
  ? "→ 기록이 없으므로 교체·폐기해도 잃는 것이 없습니다."
  : "→ ⚠️ 기록이 있습니다. 지우기 전에 선생님께 반드시 알릴 것.");
