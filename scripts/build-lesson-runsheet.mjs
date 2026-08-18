// Ⅰ단원 수업 진행표를 활동 파일에서 직접 뽑아 만든다.
//   활동을 고치면 이 스크립트를 다시 돌리면 된다 — 손으로 옮겨 적을 일이 없다.
//   실행: node scripts/build-lesson-runsheet.mjs [출력경로]
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { UNITS, REG } from "./gongtong2-registry.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ACT = join(__dirname, "..", "docs", "activities");
const OUT = process.argv[2] ?? join(__dirname, "..", "docs", "수업진행표.html");
const BASE = "https://sced9120.github.io/math-platform/activities/";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const MODE = { "t-show": ["조작", "show"], "t-ask": ["발문", "ask"],
               "t-write": ["학습지", "write"], "t-book": ["교과서", "book"] };

// ── 활동 파일에서 화면 정보 읽기 ───────────────────────────────────────────
function screensOf(file) {
  const s = readFileSync(join(ACT, file), "utf8");
  return s.split(/<section class="screen[^"]*"[^>]*>/).slice(1).map((raw) => {
    const c = raw.split('<div class="nav"')[0];
    const h = c.match(/<h1>([\s\S]*?)<\/h1>/);
    const mo = c.match(/class="(t-(?:show|ask|write|book))"/);
    const sh = c.match(/class="t-sheet">📄 ([^<]*)/);
    const tn = c.match(/class="turn"><i>📖<\/i><span>([^<]*)/);
    return {
      title: h ? h[1].replace(/<[^>]+>/g, "").trim() : "(제목 없음)",
      mode: mo ? mo[1] : "t-show",
      sheet: sh ? sh[1].trim() : null,
      turn: tn ? tn[1].trim() : null,
    };
  });
}

const units = UNITS.filter((u) => ["I1", "I2", "I3"].includes(u.key)).map((u) => ({
  title: u.title,
  acts: REG.filter((a) => a.unit === u.key).sort((a, b) => a.order - b.order)
    .map((a) => ({ ...a, screens: screensOf(a.file) })),
}));

const nAct = units.reduce((s, u) => s + u.acts.length, 0);
const nScr = units.reduce((s, u) => s + u.acts.reduce((t, a) => t + a.screens.length, 0), 0);
const nBook = units.reduce((s, u) => s + u.acts.reduce((t, a) =>
  t + a.screens.filter((x) => x.turn).length, 0), 0);

// ── 본문 ───────────────────────────────────────────────────────────────────
const body = units.map((u) => {
  const acts = u.acts.map((a, ai) => {
    const cues = a.screens.map((s, si) => {
      const [label, kind] = MODE[s.mode] ?? MODE["t-show"];
      const n = `${ai + 1}.${si + 1}`;
      if (s.turn) {
        return `        <li class="cue cue--book">
          <span class="n">${n}</span>
          <div class="b">
            <p class="t">${esc(s.title)}</p>
            <p class="turn">${esc(s.turn)}</p>
            ${s.sheet ? `<p class="sh">${esc(s.sheet)}</p>` : ""}
          </div>
        </li>`;
      }
      return `        <li class="cue">
          <span class="n">${n}</span>
          <div class="b">
            <p class="t">${esc(s.title)}<span class="tag tag--${kind}">${label}</span></p>
            ${s.sheet ? `<p class="sh">${esc(s.sheet)}</p>` : ""}
          </div>
        </li>`;
    }).join("\n");

    return `      <article class="act">
        <header class="act-h">
          <span class="act-n">활동 ${ai + 1}</span>
          <h3><a href="${BASE}${encodeURIComponent(a.file)}">${esc(a.title)}</a></h3>
          <p class="act-m">${a.book ? `<span class="pg">교과서 ${esc(a.book)}쪽</span>` : ""}${
            a.sheet ? `<span class="ws">${esc(a.sheet)}</span>` : ""}</p>
        </header>
        <ol class="cues">
${cues}
        </ol>
      </article>`;
  }).join("\n");

  return `    <section class="unit">
      <h2>${esc(u.title)}<span class="cnt">활동 ${u.acts.length}</span></h2>
${acts}
    </section>`;
}).join("\n\n");

const html = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>공통수학2 Ⅰ단원 수업 진행표</title>
<style>
  /* 교탁 위에 올려 두고 곁눈으로 보는 런시트.
     화면 성격을 나타내는 색은 활동 화면의 칩 색과 같게 맞췄다 — 종이와 화면이 같은 말을 하도록. */
  :root{
    --paper:#FCFCFE; --ink:#16181D; --dim:#5C6472; --rule:#DFE2E9;
    --surface:#F4F5F8; --surface-2:#EDEFF4;
    --book:#0E7A5A; --book-bg:#ECF7F2; --book-line:#9AD3BE;
    --sheet:#8F5A10; --ask:#3B3FA8; --show:#5A6472;
    --sans:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard","Malgun Gothic","Segoe UI",sans-serif;
    --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,"Cascadia Mono",monospace;
  }
  @media (prefers-color-scheme:dark){
    :root:not([data-theme="light"]){
      --paper:#101216; --ink:#E6E9EF; --dim:#98A1B2; --rule:#282D37;
      --surface:#171A20; --surface-2:#1D2128;
      --book:#5FD3AC; --book-bg:#12231D; --book-line:#2C5F4E;
      --sheet:#E0A857; --ask:#9AA0F5; --show:#9AA4B4;
    }
  }
  :root[data-theme="dark"]{
    --paper:#101216; --ink:#E6E9EF; --dim:#98A1B2; --rule:#282D37;
    --surface:#171A20; --surface-2:#1D2128;
    --book:#5FD3AC; --book-bg:#12231D; --book-line:#2C5F4E;
    --sheet:#E0A857; --ask:#9AA0F5; --show:#9AA4B4;
  }

  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);
    line-height:1.6;-webkit-font-smoothing:antialiased}
  .wrap{max-width:56rem;margin:0 auto;padding:2.5rem 1.5rem 4rem;
    display:flex;flex-direction:column;gap:2.25rem}
  a{color:inherit}

  /* 표제 */
  .head{display:flex;flex-direction:column;gap:.7rem}
  .eyebrow{font-family:var(--mono);font-size:.72rem;letter-spacing:.16em;color:var(--dim);
    text-transform:uppercase}
  h1{margin:0;font-size:1.95rem;font-weight:800;letter-spacing:-.02em;text-wrap:balance}
  .lede{margin:0;color:var(--dim);font-size:.95rem;max-width:46rem}
  .stats{display:flex;flex-wrap:wrap;gap:.4rem 1.4rem;font-family:var(--mono);
    font-size:.78rem;color:var(--dim);font-variant-numeric:tabular-nums;
    border-top:1px solid var(--rule);padding-top:.7rem;margin-top:.2rem}
  .stats b{color:var(--ink);font-weight:700}

  /* 범례 */
  .legend{display:flex;flex-wrap:wrap;gap:.45rem;align-items:center}
  .tag{display:inline-block;font-family:var(--mono);font-size:.68rem;font-weight:700;
    letter-spacing:.06em;padding:.1rem .5rem;border-radius:.25rem;border:1px solid currentColor;
    margin-left:.5rem;vertical-align:.08em;white-space:nowrap}
  .legend .tag{margin-left:0}
  .tag--show{color:var(--show)} .tag--ask{color:var(--ask)} .tag--write{color:var(--sheet)}
  .tag--book{color:var(--book)}
  .legend .k{font-size:.8rem;color:var(--dim)}

  /* 중단원 */
  .unit{display:flex;flex-direction:column;gap:1.1rem}
  .unit>h2{position:sticky;top:0;z-index:2;margin:0;padding:.75rem 0 .6rem;
    background:var(--paper);border-bottom:2px solid var(--ink);
    font-size:1.15rem;font-weight:800;letter-spacing:-.01em;
    display:flex;align-items:baseline;justify-content:space-between;gap:1rem}
  .cnt{font-family:var(--mono);font-size:.72rem;font-weight:600;color:var(--dim);letter-spacing:.06em}

  /* 활동 */
  .act{display:flex;flex-direction:column;gap:.55rem;break-inside:avoid}
  .act-h{display:grid;grid-template-columns:auto 1fr;gap:.15rem .7rem;align-items:baseline}
  .act-n{font-family:var(--mono);font-size:.72rem;font-weight:700;color:var(--dim);
    letter-spacing:.08em;font-variant-numeric:tabular-nums}
  .act-h h3{margin:0;font-size:1.08rem;font-weight:700;letter-spacing:-.01em}
  .act-h h3 a{text-decoration:none;border-bottom:1.5px solid var(--rule);padding-bottom:.05em}
  .act-h h3 a:hover,.act-h h3 a:focus-visible{border-bottom-color:currentColor}
  .act-m{grid-column:2;margin:0;display:flex;flex-wrap:wrap;gap:.4rem;
    font-size:.76rem;letter-spacing:.01em;font-variant-numeric:tabular-nums}
  .pg{color:var(--book);border:1px solid var(--book-line);border-radius:.25rem;padding:.05rem .45rem}
  .ws{color:var(--sheet);opacity:.95}

  /* 큐 목록 — 왼쪽 모노 레일 */
  .cues{list-style:none;margin:0;padding:0 0 0 .1rem;display:flex;flex-direction:column}
  .cue{display:grid;grid-template-columns:3.1rem 1fr;align-items:start;
    padding:.42rem 0;border-left:1px solid var(--rule);position:relative}
  .cue .n{font-family:var(--mono);font-size:.72rem;color:var(--dim);
    font-variant-numeric:tabular-nums;padding-left:.75rem;padding-top:.1rem}
  .cue .b{min-width:0}
  .cue .t{margin:0;font-size:.94rem;font-weight:600;text-wrap:pretty}
  .cue .sh{margin:.1rem 0 0;font-size:.8rem;color:var(--sheet);
    font-variant-numeric:tabular-nums}

  /* 종이로 넘어가는 순간 — 레일을 끊고 폭 전체를 먹는다 */
  .cue--book{border-left:3px solid var(--book);background:var(--book-bg);
    border-radius:0 .4rem .4rem 0;margin:.3rem 0;padding:.6rem 0 .65rem}
  .cue--book .n{color:var(--book);font-weight:700;padding-left:.6rem}
  .cue--book .t{padding-right:.9rem}
  .cue--book .turn{margin:.2rem .9rem 0 0;font-size:.88rem;font-weight:700;color:var(--book);
    text-wrap:pretty}
  .cue--book .turn::before{content:"📖 ";font-weight:400}

  footer{border-top:1px solid var(--rule);padding-top:1rem;font-size:.8rem;color:var(--dim)}

  @media (max-width:34rem){
    .cue{grid-template-columns:2.5rem 1fr}
    .act-h{grid-template-columns:1fr}
    .act-m,.act-h h3{grid-column:1}
  }
  @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}

  @media print{
    :root{--paper:#fff;--ink:#000;--dim:#444;--rule:#bbb;--book-bg:#eef7f3}
    body{font-size:10.5pt}
    .wrap{max-width:none;padding:0;gap:1.4rem}
    .unit>h2{position:static}
    .act{page-break-inside:avoid}
    .act-h h3 a{border:0}
  }
</style>

<div class="wrap">
  <header class="head">
    <p class="eyebrow">공통수학2 · 2022 개정 · 전인태</p>
    <h1>Ⅰ. 도형의 방정식 &mdash; 수업 진행표</h1>
    <p class="lede">활동 화면과 교과서만으로 수업을 진행하기 위한 표입니다.
      화면 번호는 활동 안의 <b>스텝 점 번호</b>와 같습니다. 초록으로 끊긴 줄이
      <b>교과서를 펴는 지점</b>이고, 무엇을 볼지까지 적혀 있습니다.
      활동 제목을 누르면 그 활동이 열립니다.</p>
    <p class="legend">
      <span class="k">화면 성격</span>
      <span class="tag tag--show">조작</span>
      <span class="tag tag--ask">발문</span>
      <span class="tag tag--write">학습지</span>
      <span class="tag tag--book">교과서</span>
    </p>
    <p class="stats">
      <span>활동 <b>${nAct}</b></span>
      <span>화면 <b>${nScr}</b></span>
      <span>교과서 전환 <b>${nBook}</b>회</span>
      <span>학습지 <b>1 · 2 · 3</b></span>
    </p>
  </header>

${body}

  <footer>학습지 1(도형의 방정식) · 2(원의 방정식) · 3(도형의 이동) 과 1:1 로 대응합니다.
    활동을 고친 뒤에는 <code>node scripts/build-lesson-runsheet.mjs</code> 로 이 표를 다시 만드세요.</footer>
</div>
`;

writeFileSync(OUT, html, "utf8");
console.log(`✔ ${OUT}\n  활동 ${nAct} · 화면 ${nScr} · 교과서 전환 ${nBook}회`);
