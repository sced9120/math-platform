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
  {
    slug: "calc2-sequence-band",
    file: "content/hands-on/calc2-sequence-band.html",
    title: "띠 안에 가두기 — 수열은 어디로 다가갈까",
    summary:
      "수열의 점들 위에 '가로 띠'를 직접 끌어 놓고 좁혀 보며, 어떤 값 L 둘레의 띠 안에 결국 모든 항이 들어오는지로 수렴과 발산을 판정해 본다.",
    topic: "미적분Ⅱ · 수열의 극한",
    school_level: "high",
    order_index: 1,
    height: 660,
  },
  {
    slug: "calc2-limit-assembler",
    file: "content/hands-on/calc2-limit-assembler.html",
    title: "극한 조립기 — 수렴하는 수열을 더하고 곱하고 나누면",
    summary:
      "수열 카드 두 장을 연산 기계에 끼워 넣어 합·차·실수배·곱·몫의 극한이 각 극한의 합·차·실수배·곱·몫이 되는지 확인하고, ∞/∞ 꼴은 분모의 최고차항으로 나누어 '수렴하는 조각'으로 쪼갠 뒤 조립해 본다.",
    topic: "미적분Ⅱ · 수열의 극한",
    school_level: "high",
    order_index: 2,
    height: 660,
  },
  {
    slug: "calc2-ratio-map",
    file: "content/hands-on/calc2-ratio-map.html",
    title: "공비 지도 칠하기 — rⁿ은 어디로 갈까",
    summary:
      "수직선 위의 공비 r을 손으로 끌어 막대가 r배씩 늘고 줄고 뒤집히는 모습을 보고, 시험한 r마다 수직선에 결과를 칠해 등비수열 rⁿ의 수렴·발산 지도를 직접 완성한다.",
    topic: "미적분Ⅱ · 수열의 극한",
    school_level: "high",
    order_index: 3,
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
