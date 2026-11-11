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
  {
    slug: "calc2-series-stacking",
    file: "content/hands-on/calc2-series-stacking.html",
    title: "막대 이어 붙이기 — 무한히 더하면 어디까지 갈까",
    summary:
      "항 aₙ을 길이 막대로 하나씩 자 위에 이어 붙이며 부분합 Sₙ 깃발이 어디로 가는지 보고, 급수의 수렴·발산이 '항'이 아니라 '부분합 수열'로 정해진다는 것과 \"aₙ→0 이어도 발산할 수 있다\"를 직접 확인한다.",
    topic: "미적분Ⅱ · 수열의 극한",
    school_level: "high",
    order_index: 4,
    height: 660,
  },
  {
    slug: "calc2-geometric-self-similar",
    file: "content/hands-on/calc2-geometric-self-similar.html",
    title: "닮은 꼴 접어 넣기 — 전체 안에 전체가 들어 있다",
    summary:
      "첫 조각 a 옆에 '전체 그림을 r배로 줄인 복사본'을 끌어다 끼워 넣으며, 등비급수의 합 S가 S = a + rS 를 만족한다는 것을 눈으로 확인하고 S = a/(1−r) 를 이끌어 낸 뒤 순환소수·튀는 공 문제에 활용한다.",
    topic: "미적분Ⅱ · 수열의 극한",
    school_level: "high",
    order_index: 5,
    height: 660,
  },
  {
    slug: "calc2-find-e-slope",
    file: "content/hands-on/calc2-find-e-slope.html",
    title: "기울기가 높이와 같아지는 밑 — e 를 손으로 찾기",
    summary:
      "지수함수 위의 점을 끌어 보면 접선의 기울기가 언제나 높이의 일정한 배수예요. 밑을 바꿔 그 배수가 1이 되는 밑을 찾으면, 그것이 e 입니다.",
    topic: "미적분Ⅱ · 지수함수와 로그함수의 미분",
    school_level: "high",
    order_index: 6,
    height: 660,
  },
  {
    slug: "calc2-angle-addition-frame",
    file: "content/hands-on/calc2-angle-addition-frame.html",
    title: "돌린 판 위에서 또 돌리기 — 덧셈정리를 눈으로 쪼개기",
    summary:
      "단위원 위에서 투명 판을 α만큼 돌리고, 그 판 위에서 점을 β만큼 더 돌려 보세요. 점의 x좌표가 cos α cos β 와 sin α sin β 두 조각의 차로 쪼개지는 것을 보며 cos(α+β), sin(α+β) 공식을 직접 확인합니다.",
    topic: "미적분Ⅱ · 삼각함수의 덧셈정리",
    school_level: "high",
    order_index: 7,
    height: 660,
  },
  {
    slug: "calc2-arc-chord-sine",
    file: "content/hands-on/calc2-arc-chord-sine.html",
    title: "활과 줄을 맞대 보기 — sin x / x → 1 에서 (sin x)′ = cos x 까지",
    summary:
      "단위원 위의 점을 끌어 각을 줄여 보세요. 높이 sin x 와 호의 길이 x 가 거의 같아지는 것을 보고, 그 사실 하나로 사인 그래프의 접선 기울기가 cos x 가 되는 것까지 이어 봅니다.",
    topic: "미적분Ⅱ · 삼각함수의 극한과 미분",
    school_level: "high",
    order_index: 8,
    height: 660,
  },
  {
    slug: "calc2-quotient-rectangle",
    file: "content/hands-on/calc2-quotient-rectangle.html",
    title: "넓이를 지키는 직사각형 — f = q·g 로 몫의 미분법 끌어내기",
    summary:
      "넓이가 f(x), 가로가 g(x)인 직사각형의 세로는 몫 f(x)/g(x)입니다. x 를 조금 움직이면 넓이와 가로가 바뀌고, 세로가 어떻게 따라 바뀌는지 조각 넓이로 따져 몫의 미분법을 만들어 봅니다.",
    topic: "미적분Ⅱ · 함수의 몫의 미분",
    school_level: "high",
    order_index: 9,
    height: 660,
  },
  {
    slug: "calc2-chain-stretch",
    file: "content/hands-on/calc2-chain-stretch.html",
    title: "늘림 두 번 — 합성함수의 미분법",
    summary:
      "x 에서 짧은 구간을 잡아 u = g(x), y = f(u) 두 번 옮겨 봅니다. 구간이 두 번 늘거나 줄어드는 비율을 곱하면 전체 비율이 되고, 구간을 줄이면 (f∘g)′ = f′(g(x))·g′(x) 이 보입니다.",
    topic: "미적분Ⅱ · 합성함수의 미분",
    school_level: "high",
    order_index: 10,
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
