// 활동 첫 화면에 "학습지 1-01 [생각 틔우기]" 배지를 넣는다 (멱등).
// 실행: node scripts/add-worksheet-badge.mjs
//
// 어떤 활동이 수업 학습지의 어느 항목과 이어지는지 학생이 바로 알 수 있게 한다.
// 문구는 scripts/gongtong2-registry.mjs 의 sheet 값 하나로 관리한다.
//
// 규칙
//  - 첫 번째 <div class="kicker"> 바로 뒤에 <span class="sheet"> 를 놓는다.
//  - 이미 그 자리에 배지가 있으면 문구만 갈아 끼운다(중복 생성 없음).
//  - 두 번째 이후 화면에 손으로 넣어 둔 배지는 건드리지 않는다.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { REG } from "./gongtong2-registry.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, "..", "docs", "activities");

const CSS =
  '  .sheet{display:inline-block;background:#fef3c7;border:1px solid #fcd34d;color:#92400e;' +
  'border-radius:999px;padding:2px 11px;font-size:12px;font-weight:700;margin-bottom:6px}\n';

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

let changed = 0, skipped = 0, nosheet = 0;

for (const a of REG) {
  if (!a.sheet) { nosheet++; continue; }
  const path = join(dir, a.file);
  if (!existsSync(path)) { console.error(`✗ 파일 없음: ${a.file}`); skipped++; continue; }

  let html = readFileSync(path, "utf8");
  const badge = `<span class="sheet">📄 ${esc(a.sheet)}</span>`;

  // 1) CSS 보장
  if (!/\.sheet\s*\{/.test(html)) {
    const at = html.indexOf("</style>");
    if (at === -1) { console.error(`✗ <style> 를 찾지 못함: ${a.file}`); skipped++; continue; }
    html = html.slice(0, at) + CSS + html.slice(at);
  }

  // 2) 첫 kicker 다음 자리에 배지
  const k = html.indexOf('<div class="kicker">');
  if (k === -1) { console.error(`✗ .kicker 를 찾지 못함: ${a.file}`); skipped++; continue; }
  const kEnd = html.indexOf("</div>", k);
  if (kEnd === -1) { console.error(`✗ .kicker 가 닫히지 않음: ${a.file}`); skipped++; continue; }
  const after = kEnd + "</div>".length;

  // 바로 뒤(공백 무시)에 이미 배지가 있으면 그것만 교체한다
  const tail = html.slice(after);
  const existing = tail.match(/^(\s*)<span class="sheet">[\s\S]*?<\/span>/);
  html = existing
    ? html.slice(0, after) + existing[1] + badge + tail.slice(existing[0].length)
    : html.slice(0, after) + "\n    " + badge + tail;

  writeFileSync(path, html, "utf8");
  console.log(`✔ ${a.title} — ${a.sheet}`);
  changed++;
}

console.log(
  `\n완료: ${changed}개 배지 반영` +
  (nosheet ? `, ${nosheet}개는 학습지 연계 없음(Ⅱ·Ⅲ 단원)` : "") +
  (skipped ? `, ${skipped}개 건너뜀` : "")
);
