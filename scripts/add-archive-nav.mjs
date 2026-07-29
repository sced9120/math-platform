// 활동 맨 위에 "← 활동 목록" 링크를 넣는다 (멱등).
// 실행: node scripts/add-archive-nav.mjs
//
// 중요: 이 링크는 아카이브(GitHub Pages)에서 파일을 직접 열었을 때만 보여야 한다.
// 학습 플랫폼은 활동을 iframe(srcDoc)으로 띄우므로 그 안에서는 목록이 존재하지 않는다.
// → window.top !== window.self 이면(= iframe 안이면) 스스로 숨는다.
//   (sandbox="allow-scripts" 라 window.top 비교는 허용되고 예외도 나지 않는다)
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, "..", "docs", "activities");

const START = "<!-- NAV:START -->";
const END = "<!-- NAV:END -->";

const BLOCK = `${START}
<div id="archiveNav" style="display:none">
  <a href="../index.html">← 활동 목록</a>
</div>
<style>
  #archiveNav{padding:10px 20px;border-bottom:1px solid #e4e4e7;background:#fafafa;
    font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Segoe UI","Malgun Gothic",sans-serif}
  #archiveNav a{color:#2563eb;text-decoration:none;font-size:14px;font-weight:600}
  #archiveNav a:hover{text-decoration:underline}
</style>
<script>
  // 플랫폼 안(iframe)에서는 목록이 없으므로 감춘다. 단독으로 열었을 때만 보인다.
  (function () {
    var inFrame = true;
    try { inFrame = window.top !== window.self; } catch (e) { inFrame = true; }
    if (!inFrame) document.getElementById("archiveNav").style.display = "block";
  })();
<\/script>
${END}`;

let changed = 0, skipped = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith(".html"))) {
  const path = join(dir, file);
  let html = readFileSync(path, "utf8");

  // 이미 넣은 블록은 걷어내고 새로 넣는다
  const s = html.indexOf(START);
  if (s !== -1) {
    const e = html.indexOf(END);
    if (e === -1) { console.error(`✗ 마커 손상: ${file}`); skipped++; continue; }
    html = html.slice(0, s) + html.slice(e + END.length);
  }

  // 본문 맨 앞(.wrap 바로 앞)에 삽입
  const at = html.indexOf('<div class="wrap">');
  if (at === -1) { console.error(`✗ .wrap 을 찾지 못함: ${file}`); skipped++; continue; }
  html = html.slice(0, at) + BLOCK + "\n\n" + html.slice(at);

  writeFileSync(path, html, "utf8");
  console.log(`✔ 목록 링크 추가: ${file}`);
  changed++;
}

console.log(`\n완료: ${changed}개 수정${skipped ? `, ${skipped}개 건너뜀` : ""}.`);
