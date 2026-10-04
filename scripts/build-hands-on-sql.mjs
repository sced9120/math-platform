// 만져보는 수학 — HTML 로 만든 자료(content/hands-on/*.html)를 SQL 로 바꾼다.
//
//   node scripts/build-hands-on-sql.mjs
//
// supabase/hands-on.sql 을 다시 만든다. Supabase SQL Editor 에 붙여넣어 실행하면
//  - 없는 자료는 새로 넣고(공개 상태로)
//  - 이미 있는 자료는 HTML(config)만 바꾼다 — 관리자가 화면에서 고친 제목·설명·학교급·공개 여부는 그대로 둔다.
// HTML 을 고친 뒤 이 스크립트를 돌리고 hands-on.sql 을 실행하면 사이트에 반영된다.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// school_level: elementary(초등학교) · middle(중학교) · high(고등학교)
export const HANDS_ON = [
  {
    slug: "compass-straightedge",
    file: "content/hands-on/compass-straightedge.html",
    title: "자유 작도 — 눈금 없는 자와 컴퍼스",
    summary:
      "자를 고정해 가장자리로 곧은 선을, 컴퍼스 침을 고정하고 연필을 돌려 원을 그립니다. 끝없이 넓은 종이에서 확대·축소하며 작도해 보세요.",
    topic: "작도",
    school_level: "middle",
    order_index: 1,
    height: 660,
  },
];

const TAG = "$hands_on$";

function quote(text) {
  return "'" + text.replace(/'/g, "''") + "'";
}

export function upsertSql(item) {
  const html = readFileSync(join(ROOT, item.file), "utf8");
  if (html.includes(TAG)) throw new Error(`${item.file} 안에 ${TAG} 가 들어 있어 SQL 로 감쌀 수 없습니다`);
  return `insert into public.manipulatives
  (slug, title, summary, topic, school_level, order_index, type, config, is_published, owner_id)
values (
  ${quote(item.slug)},
  ${quote(item.title)},
  ${quote(item.summary)},
  ${quote(item.topic)}, ${quote(item.school_level)}, ${item.order_index}, 'html',
  jsonb_build_object('height', ${item.height}, 'html', ${TAG}${html}${TAG}::text),
  true, null
)
on conflict (slug) do update
  set type = excluded.type, config = excluded.config, updated_at = now();
`;
}

export function handsOnSql() {
  return HANDS_ON.map(
    (item) => `-- ${item.title}  (원본: ${item.file})\n${upsertSql(item)}`
  ).join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = `-- ============================================================
-- 만져보는 수학 HTML 자료 넣기·고치기 (scripts/build-hands-on-sql.mjs 가 만든 파일 — 손으로 고치지 마세요)
-- 0018 까지 실행한 데이터베이스의 SQL Editor 에서 실행합니다. 여러 번 실행해도 됩니다.
--  - 없는 자료는 공개 상태로 새로 넣고, 있는 자료는 HTML(config)만 바꿉니다.
-- ============================================================

${handsOnSql()}`;
  writeFileSync(join(ROOT, "supabase/hands-on.sql"), out);
  console.log(`supabase/hands-on.sql — ${HANDS_ON.length}개 자료`);
}
