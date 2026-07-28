// .sqrt 가 윗줄(overline)만 그리고 √ 기호가 없던 문제를 고친다 (멱등).
// 실행: node scripts/fix-sqrt-symbol.mjs
//
// 기존:  .sqrt{border-top:...;padding:...}          → ‾a²+b²‾   (√ 없음)
// 수정:  ::before 로 √ 를 왼쪽 바깥에 붙인다        → √‾a²+b²‾
//        (절대 위치라 윗줄이 √ 위를 덮지 않는다)
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, "..", "docs", "activities");

const NEW_RULE = `.sqrt{border-top:1.5px solid currentColor;padding:0 3px;margin-left:.62em;position:relative;white-space:nowrap}
  .sqrt::before{content:"√";position:absolute;left:-.62em;top:-.17em;font-size:1.12em;line-height:1;border:0}`;

// 한 줄짜리 .sqrt 규칙(패딩 값이 파일마다 조금 다름)을 통째로 교체
const OLD_RULE = /\.sqrt\{border-top:1\.5px solid currentColor;padding:0 \d+px\}/;

let changed = 0, already = 0, skipped = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith(".html"))) {
  const path = join(dir, file);
  const html = readFileSync(path, "utf8");

  if (html.includes(".sqrt::before")) { already++; continue; }
  if (!OLD_RULE.test(html)) {
    if (html.includes(".sqrt{")) {
      console.error(`✗ .sqrt 규칙 형태가 달라 건너뜀: ${file}`);
      skipped++;
    }
    continue;
  }

  writeFileSync(path, html.replace(OLD_RULE, NEW_RULE), "utf8");
  console.log(`✔ √ 기호 추가: ${file}`);
  changed++;
}

console.log(`\n완료: ${changed}개 수정, ${already}개 이미 적용됨${skipped ? `, ${skipped}개 확인 필요` : ""}.`);
