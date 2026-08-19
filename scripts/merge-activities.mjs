// 여러 활동 HTML 을 한 차시 분량으로 합친다 (학습지 흐름 = 활동 하나).
// 실행: node scripts/merge-activities.mjs
//
// 왜 그냥 이어 붙이면 안 되는가
//  - 파일마다 s0, s1, r0 … 같은 id 를 재사용한다 → 합치면 조작이 서로 엉킨다.
//    그래서 파트마다 접두사를 붙여 이름공간을 나눈다.
//  - 파일마다 화면 넘김(스테퍼) 코드가 하나씩 들어 있다 → 하나만 남긴다.
//    (스테퍼 코드는 모든 파일이 완전히 같아서 기계적으로 떼어낼 수 있다)
//  - 자유 기록 화면은 합친 활동의 맨 끝에 하나만 둔다.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "activities");

// ── 합칠 묶음 ────────────────────────────────────────────────────────────────
// keys: 가져올 화면의 data-key (없으면 free 를 뺀 전체)
// blocks: 가져올 스크립트 구획의 주석 라벨 (없으면 전체)
const GROUPS = [
  {
    out: "gongtong2-l1-coordinate-distance.html",
    parts: [
      { file: "gongtong2-00b-bulguksa-coordinate.html" },
      { file: "gongtong2-00-distance-two-points.html" },
      { file: "gongtong2-00c-median-theorem.html" },
    ],
  },
  {
    out: "gongtong2-l3-line-parallel.html",
    parts: [
      { file: "gongtong2-02b-line-equation.html" },
      {
        file: "gongtong2-02-parallel-perpendicular.html",
        keys: ["s1", "s2", "s3", "s4"],           // 도입 · 직선의 결정 · 일반화 · 평행
        blocks: ["화면0", "화면1", "화면3"],       // '접었다 펴는 답'은 수직(s5) 쪽으로 간다
      },
    ],
  },
  {
    out: "gongtong2-l4-perpendicular-distance.html",
    parts: [
      {
        file: "gongtong2-02-parallel-perpendicular.html",
        keys: ["s5", "s6", "ext"],                // 수직 · 정리 · 확장 탐구
        blocks: ["화면4", "접었다", "EXT"],
      },
      { file: "gongtong2-03-point-line-distance.html" },
    ],
  },
];

// ── 파일 뜯어보기 ────────────────────────────────────────────────────────────
const RE_SECTION = /<section class="screen[^"]*"[^>]*>[\s\S]*?<\/section>/g;
const STEPPER_START = 'var screens=[].slice.call(document.querySelectorAll(".screen"))';
const STEPPER_END = "nextBtn.onclick=function(){if(idx<N-1)go(idx+1);};";

function parse(file) {
  const s = readFileSync(join(DIR, file), "utf8");

  const styles = [...s.matchAll(/<style>[\s\S]*?<\/style>/g)].map((m) => m[0]);
  const nav = s.match(/<!-- NAV:START -->[\s\S]*?<!-- NAV:END -->/)?.[0] ?? "";
  const head = s.slice(0, s.indexOf("<style>"));

  // 자유 기록 화면은 파트에서 빼고, 합칠 때 맨 끝에 하나만 붙인다
  const freeBlock = s.match(/<!-- FREE:START -->[\s\S]*?<!-- FREE:END -->/)?.[0] ?? "";
  const body = s.replace(/<!-- FREE:START -->[\s\S]*?<!-- FREE:END -->/, "");
  const sections = (body.match(RE_SECTION) ?? []).map((raw) => ({
    raw,
    key: raw.match(/data-key="([^"]*)"/)?.[1] ?? "",
    prompt: raw.match(/data-prompt="([^"]*)"/)?.[1] ?? "",
    photo: /data-photo="1"/.test(raw),
  }));

  // 마지막 <script> 가 활동 본체 스크립트
  const scripts = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const main = scripts[scripts.length - 1] ?? "";
  const i0 = main.indexOf(STEPPER_START);
  const i1 = main.indexOf(STEPPER_END);
  if (i0 === -1 || i1 === -1) throw new Error(`${file}: 스테퍼 구획을 찾지 못함`);
  const scriptHead = main.slice(0, main.lastIndexOf("// 스테퍼", i0) === -1 ? i0 : main.lastIndexOf("// 스테퍼", i0));
  // 꼬리에는 원래 IIFE 의 닫는 괄호와 go(0) 이 붙어 있다. 새로 감쌀 것이므로 둘 다 떼어낸다.
  const scriptTail = main
    .slice(i1 + STEPPER_END.length)
    .replace(/\s*\}\)\(\);?\s*$/, "")
    .replace(/\s*go\(0\);\s*$/, "");

  return { file, head, styles, nav, sections, freeBlock, scriptHead, scriptTail };
}

// 스크립트 꼬리를 "// 라벨" 단위 구획으로 나눈다.
// 들여쓰기 두 칸짜리 최상위 주석에서만 자른다 — 함수 안쪽 주석에서 자르면 코드가 반토막 난다.
function splitBlocks(tail) {
  const parts = tail.split(/\n(?=  \/[/*])/);
  return parts.map((text) => ({
    label: text.trim().replace(/^(?:\/\/|\/\*)\s*/, "").split(/[\s:·—-]/)[0],
    text,
  }));
}

// 파트 안에서 쓰는 id 를 모두 접두사로 갈아 끼운다 (화면 마크업 + 스크립트 동시에)
function namespace(ids, prefix, ...texts) {
  const sorted = [...ids].sort((a, b) => b.length - a.length);
  return texts.map((t) => {
    for (const id of sorted) {
      t = t.split(`"${id}"`).join(`"${prefix}${id}"`);
    }
    return t;
  });
}

// ── 합치기 ───────────────────────────────────────────────────────────────────
for (const g of GROUPS) {
  const parsed = g.parts.map((p) => ({ ...p, doc: parse(p.file) }));
  const base = parsed[0].doc;

  // 파트별 id 목록 → 두 파트 이상에서 겹치는 id 만 이름을 바꾼다.
  // 전부 바꾸면 getElementById("rv"+k) 처럼 id 를 문자열로 조립하는 코드가 깨진다.
  const idsOf = parsed.map((p) => {
    const secs = p.keys ? p.doc.sections.filter((s) => p.keys.includes(s.key)) : p.doc.sections;
    const set = new Set();
    for (const s of secs) for (const m of s.raw.matchAll(/id="([^"]+)"/g)) set.add(m[1]);
    return set;
  });
  const seen = new Map();
  for (const set of idsOf) for (const id of set) seen.set(id, (seen.get(id) ?? 0) + 1);
  const clashing = new Set([...seen].filter(([, n]) => n > 1).map(([id]) => id));
  if (clashing.size) console.log(`   겹치는 id ${clashing.size}개 → 이름 바꿈: ${[...clashing].join(", ")}`);

  const outSections = [];
  const outScripts = [];
  const outStyles = [...base.styles];

  parsed.forEach((p, i) => {
    const prefix = `g${i}`;
    let secs = p.doc.sections;
    if (p.keys) secs = secs.filter((s) => p.keys.includes(s.key));

    // 이 파트의 id 중 다른 파트와 겹치는 것만 바꾼다
    const ids = new Set([...idsOf[i]].filter((id) => clashing.has(id)));

    // data-* 를 먼저 떼어 낸 뒤 id 를 갈아 끼운다 (질문 문구가 치환에 휘말리지 않도록)
    const stripped = secs.map((s) => ({
      ...s,
      raw: s.raw.replace(/\s+data-(?:key|prompt|photo)="[^"]*"/g, ""),
    }));

    let tail = p.doc.scriptTail;
    if (p.blocks) {
      tail = splitBlocks(tail)
        .filter((b) => p.blocks.some((want) => b.label.startsWith(want) || b.text.includes(want)))
        .map((b) => b.text)
        .join("\n");
    }

    // 화면 그리기 코드가 스테퍼 앞에 있는 파일도 있어서 앞뒤 모두 갈아 끼운다
    const [nsHead, nsTail, ...nsSecs] = namespace(
      ids,
      prefix,
      p.doc.scriptHead,
      tail,
      ...stripped.map((s) => s.raw)
    );

    nsSecs.forEach((raw, j) => {
      outSections.push({
        raw,
        part: prefix,
        prompt: stripped[j].prompt,
        photo: stripped[j].photo,
        wasExt: stripped[j].key === "ext",
      });
    });

    // 파트 코드가 screens[0] 처럼 스테퍼 변수를 쓰는 곳이 있다.
    // 스테퍼는 하나로 합쳐 버렸으므로, 파트마다 "자기 화면 목록"을 다시 만들어 준다.
    const ownScreens =
      `var screens=[].slice.call(document.querySelectorAll('.screen[data-part="${prefix}"]'));`;

    outScripts.push(
      `<script>\n(function(){\n"use strict";\n${ownScreens}\n` +
        nsHead.replace(/^\s*\(function\s*\(\s*\)\s*\{\s*(?:"use strict";)?/, "") +
        `\n${nsTail}\n})();\n<\/script>`
    );
    if (i > 0) outStyles.push(p.doc.styles.filter((x) => !base.styles.includes(x)).join("\n"));
  });

  // 화면키 다시 매기기: 일반 화면은 s1…, 확장 탐구는 ext1…, 자유 기록은 free 하나
  let n = 0, e = 0;
  const extCount = outSections.filter((s) => s.wasExt).length;
  const rendered = outSections.map((s, i) => {
    const key = s.wasExt ? (extCount > 1 ? `ext${++e}` : "ext") : `s${++n}`;
    const attrs =
      ` data-key="${key}" data-part="${s.part}"` +
      (s.prompt ? ` data-prompt="${s.prompt}"` : "") +
      (s.photo ? ` data-photo="1"` : "");
    // 첫 화면만 열려 있어야 한다
    let raw = s.raw.replace(/<section class="screen[^"]*"/, `<section class="screen${i === 0 ? " on" : ""}"${attrs}`);
    return raw;
  });

  const stepper = `<script>
(function(){
  ${STEPPER_START},N=screens.length,idx=0;
  var stepsEl=document.getElementById("steps"),counter=document.getElementById("counter");
  var prevBtn=document.getElementById("prev"),nextBtn=document.getElementById("next");
  for(var i=0;i<N;i++){(function(k){var d=document.createElement("div");d.className="dot";d.textContent=k+1;d.onclick=function(){go(k);};stepsEl.appendChild(d);})(i);}
  var dots=[].slice.call(stepsEl.children);
  function go(k){idx=Math.max(0,Math.min(N-1,k));for(var i=0;i<N;i++){screens[i].classList.toggle("on",i===idx);dots[i].classList.toggle("active",i===idx);dots[i].classList.toggle("done",i<idx);}counter.textContent=(idx+1)+" / "+N;prevBtn.disabled=idx===0;nextBtn.textContent=idx===N-1?"완료 ✓":"다음 »";}
  prevBtn.onclick=function(){go(idx-1);};${STEPPER_END}
  go(0);
})();
<\/script>`;

  const out = [
    base.head.trim(),
    outStyles.join("\n"),
    "",
    base.nav,
    "",
    `<div class="wrap">`,
    `  <div class="steps" id="steps"></div>`,
    "",
    rendered.join("\n\n"),
    "",
    base.freeBlock,
    "",
    `  <div class="nav">`,
    `    <button class="btn" id="prev">&laquo; 이전</button>`,
    `    <span class="tag" id="counter">1 / ${rendered.length + 1}</span>`,
    `    <button class="btn primary" id="next">다음 &raquo;</button>`,
    `  </div>`,
    `</div>`,
    "",
    outScripts.join("\n"),
    stepper,
    "",
  ].join("\n");

  writeFileSync(join(DIR, g.out), out);
  console.log(`✔ ${g.out} — 화면 ${rendered.length + 1}개 (${g.parts.map((p) => p.file.replace(/^gongtong2-|\.html$/g, "")).join(" + ")})`);
}
