// 활동 화면마다 '수업 진행 칩'과 '교과서 전환 배너'를 넣는다.
//
//   화면만 보고도 지금 무엇을 해야 하는지 알 수 있게 하는 것이 목적이다.
//     🖥 보여주며 조작 / 💬 발문 / ✍️ 학습지 / 📖 교과서
//   교과서를 실제로 펴야 하는 화면에는 칩 대신 초록 배너를 크게 띄운다.
//
//   TEACH:START ~ TEACH:END 사이만 갈아 끼우므로 몇 번을 돌려도 결과가 같다.
//   기존의 노란 학습지 배지(span.sheet)는 칩으로 흡수한다.
//
//   실행: node scripts/add-teaching-strip.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs", "activities");

// mode : show(보여주며 조작) / ask(발문) / write(학습지에 적기) / book(교과서)
// sheet: 학습지 어디인지        book : 참고할 교과서 쪽
// turn : 교과서를 실제로 펴야 하는 화면 → 초록 배너
const PLAN = {
  // ══════════ Ⅰ-1. 평면좌표와 직선의 방정식 ══════════
  "gongtong2-00b-bulguksa-coordinate": [
    { mode: "ask",  sheet: "1-01 [생각 틔우기] Q1" },
    { mode: "show", sheet: "1-01 [생각 틔우기] Q2" },
    { mode: "show", sheet: "1-01 [생각 틔우기] Q3·Q4",
      turn: "교과서 13쪽 — 불국사 배치도 그림을 함께 보며 대웅전까지의 거리를 재어 봅니다." },
    { mode: "show", sheet: "1-01 [생각 틔우기] Q5" },
    { mode: "write", sheet: "1-01 [학습 목표 유추하기]" },
    { mode: "show" },
  ],
  "gongtong2-00-distance-two-points": [
    { mode: "show", sheet: "1-01 [일반화하기] Q1" },
    { mode: "show", sheet: "1-01 [일반화하기] Q2" },
    { mode: "show", sheet: "1-01 (스스로 정리하기) 삼각형의 종류" },
    { mode: "show" },
    { mode: "write", sheet: "1-01 [연습하기] Q1·Q2",
      turn: "교과서 14쪽 — [예제 1] 을 함께 풀고 [스스로 익히기] 로 넘어갑니다." },
    { mode: "show" },
  ],
  "gongtong2-00c-median-theorem": [
    { mode: "show" },
    { mode: "ask",  sheet: "1-01 [증명하기] 좌표를 어디에 놓을까" },
    { mode: "write", sheet: "1-01 [증명하기]",
      turn: "교과서 14쪽 — 중선 정리 증명의 빈칸을 학생들과 함께 채웁니다." },
    { mode: "ask" },
    { mode: "show" },
  ],
  "gongtong2-01-segment-division": [
    { mode: "show", sheet: "1-01 [탐구] 내분과 등분 · 받침점 찾기" },
    { mode: "show", sheet: "1-01 [탐구] Q1~Q3 등분과 내분의 표기" },
    { mode: "show", sheet: "1-01 [탐구] 수직선 위에서 내분 Q1~Q3" },
    { mode: "show", sheet: "1-01 [탐구] 좌표평면 위에서 내분 Q1~Q3" },
    { mode: "write", sheet: "1-01 [일반화] Q4·Q5 내분점 공식" },
    { mode: "write", sheet: "1-01 [예제] 삼각형의 무게중심",
      turn: "교과서 16쪽 — 삼각형의 무게중심 [예제] 를 함께 풀고, 17쪽 [스스로 익히기] 로 마무리합니다." },
    { mode: "show" },
    { mode: "show" },
  ],
  "gongtong2-02b-line-equation": [
    { mode: "ask",  sheet: "1-02 [생각 틔우기] Q2·Q3" },
    { mode: "show", sheet: "1-02 [생각 틔우기] Q5 (1)",
      turn: "교과서 18쪽 — 한 점과 기울기로 직선의 방정식을 세우는 부분을 함께 봅니다." },
    { mode: "show", sheet: "1-02 [생각 틔우기] Q5 (2)" },
    { mode: "show", sheet: "1-02 [생각 틔우기] Q5 (3) 두 점 (2,1)·(2,5)" },
    { mode: "write",
      turn: "교과서 19쪽 — [스스로 익히기] 문제를 해결합니다." },
    { mode: "show" },
  ],
  "gongtong2-02-parallel-perpendicular": [
    { mode: "ask",  sheet: "1-02 [중학교 개념 확장하기] Q1 평행선 공준" },
    { mode: "show" },
    { mode: "show" },
    { mode: "show", sheet: "1-02 평행 조건 Q2·Q3",
      turn: "교과서 20쪽 — 두 직선의 평행·일치 조건을 정리하고, 21쪽 [스스로 익히기] 를 풉니다." },
    { mode: "show", sheet: "1-02 [수직의 조건]",
      turn: "교과서 22쪽 — 수직 조건과 [예제 1] 을 함께 다루고, 23쪽 [스스로 익히기] 를 풉니다." },
    { mode: "write", sheet: "1-02 [스피드 연습문제]" },
    { mode: "show" },
  ],
  "gongtong2-03-point-line-distance": [
    { mode: "ask",  sheet: "1-02 [점과 직선 사이의 거리] Q2·Q3" },
    { mode: "show" },
    { mode: "show", sheet: "1-02 [점과 직선 사이의 거리] Q4" },
    { mode: "show", sheet: "1-02 Q5 [증명해보기]",
      turn: "교과서 24쪽 — 점과 직선 사이의 거리 공식의 증명을 함께 따라갑니다." },
    { mode: "write" },
    { mode: "show" },
    { mode: "show" },
  ],

  // ══════════ Ⅰ-2. 원의 방정식 ══════════
  "gongtong2-04-circle-equation": [
    { mode: "ask",  sheet: "2-01 [생각 틔우기] Q1 작도에 쓴 도구" },
    { mode: "show", sheet: "2-01 [생각 틔우기] Q1 작도 과정" },
    { mode: "ask",  sheet: "2-01 [생각 틔우기] Q2·Q3 원의 정의를 식으로" },
    { mode: "show", sheet: "2-01 Q4 [스스로 정리하기] 원의 방정식" },
    { mode: "write", sheet: "2-01 Q5 [예제 1] 지름의 양 끝점" },
    { mode: "show", sheet: "2-01 Q6 일반형과 C 의 값" },
    { mode: "write",
      turn: "교과서 33쪽 — [스스로 익히기] 문제를 해결합니다." },
    { mode: "show", sheet: "2-01 +Q5 좌표축에 접하는 원" },
    { mode: "show" },
    { mode: "show" },
  ],
  "gongtong2-04b-circle-three-points": [
    { mode: "ask",  sheet: "2-01 +Q3 원을 결정지으려면?" },
    { mode: "show", sheet: "2-01 +Q4 [실생활] 용접 로봇" },
    { mode: "write", sheet: "2-01 Q2 [예제 3] 세 점을 지나는 원" },
    { mode: "show" },
  ],

  // ══════════ Ⅰ-2. 원과 직선 ══════════
  "gongtong2-05c-circle-line-lab": [
    { mode: "show", sheet: "2-02 [생각 틔우기] Q2 (1)~(4)" },
    { mode: "ask",  sheet: "2-02 [생각 틔우기] Q2 (7)" },
    { mode: "write", sheet: "2-02 [생각 틔우기] Q2 (4)(5)(6)" },
    { mode: "write", sheet: "2-02 Q3 [예제 1] 거리로 판단" },
    { mode: "write", sheet: "2-02 Q4 [예제 2] 판별식으로 범위" },
    { mode: "write", sheet: "2-02 Q5 [스스로 정리하기]",
      turn: "교과서 36쪽 — [스스로 익히기] 문제를 해결합니다." },
    { mode: "show" },
  ],
  "gongtong2-05-circle-line": [
    { mode: "show", sheet: "2-02 [생각 틔우기] Q1 세 경우를 직접 만들기" },
    { mode: "show", sheet: "2-02 Q5 [스스로 정리하기] 판정표" },
    { mode: "write", sheet: "2-02 [스스로 익히기] 앞 연습" },
    { mode: "show" },
  ],
  "gongtong2-05b-circle-tangent": [
    { mode: "ask",  sheet: "2-02 [접선의 방정식] Q1~Q3 접선의 개수" },
    { mode: "show", sheet: "2-02 [접선의 방정식] (1) 기울기가 주어진 경우",
      turn: "교과서 37쪽 — 접선의 방정식을 세우는 두 가지 길을 함께 봅니다." },
    { mode: "show", sheet: "2-02 [접선의 방정식] (2) 원 위의 한 점" },
    { mode: "write", sheet: "2-02 Q4 [예제 1] 원 밖의 점 (5, 0)" },
    { mode: "write", sheet: "2-02 [개념 탐구] 놓친 접선",
      turn: "교과서 40쪽 — [개념 탐구] 의 물음에 답하며 왜 접선을 놓쳤는지 확인합니다." },
    { mode: "write",
      turn: "교과서 39쪽 — [스스로 익히기] 문제를 해결합니다." },
    { mode: "show" },
  ],

  // ══════════ Ⅰ-3. 도형의 이동 ══════════
  "gongtong2-06-translation": [
    { mode: "show", sheet: "3-01 [생각 틔우기] Q1 점의 평행이동" },
    { mode: "show", sheet: "3-01 Q3 포물선의 평행이동" },
    { mode: "show", sheet: "3-01 Q2 원의 평행이동" },
    { mode: "show", sheet: "3-01 Q4 도형의 평행이동",
      turn: "교과서 46쪽 — f(x, y) = 0 의 평행이동이 왜 f(x−a, y−b) = 0 이 되는지 논리 전개를 함께 봅니다." },
    { mode: "write", sheet: "3-01 Q5 [예제 1]",
      turn: "교과서 47쪽 — [스스로 익히기] 문제를 해결합니다." },
    { mode: "show" },
  ],
  "gongtong2-06b-star-translation": [
    { mode: "show" },
    { mode: "show", sheet: "3-01 Q4 도형의 평행이동" },
    { mode: "show", sheet: "3-01 Q3 포물선의 평행이동" },
    { mode: "show", sheet: "3-01 Q2 원의 평행이동" },
    { mode: "write" },
    { mode: "show" },
  ],
  "gongtong2-07-reflection": [
    { mode: "ask",  sheet: "3-02 [생각 틔우기] Q1·Q2 대칭 퀴즈와 데칼코마니" },
    { mode: "show", sheet: "3-02 [생각 틔우기] Q3 점의 대칭이동 · ▶ 움직이지 않는 점" },
    { mode: "ask",  sheet: "3-02 Q4 y = x 에 대한 대칭이동",
      turn: "교과서 48쪽 — (x, y) 가 (y, x) 로 옮겨지는 이유를 함께 증명합니다." },
    { mode: "show", sheet: "3-02 Q5 도형의 대칭이동" },
    { mode: "show", sheet: "3-02 Q5 도형의 대칭이동 규칙" },
    { mode: "write", sheet: "3-02 Q8 [도형의 대칭이동 정리]" },
    { mode: "show" },
  ],
  "gongtong2-07b-star-reflection": [
    { mode: "show", sheet: "3-02 [생각 틔우기] Q3" },
    { mode: "show", sheet: "3-02 Q5 도형의 대칭이동" },
    { mode: "show", sheet: "3-02 핵심질문 · 여러 번 겹치면?" },
    { mode: "show", sheet: "3-02 Q6 원의 대칭이동" },
    { mode: "show", sheet: "3-02 Q7 포물선의 대칭이동" },
    { mode: "show", sheet: "3-02 [생각 키우기] 순서를 바꾸면?" },
    { mode: "write" },
    { mode: "show" },
  ],
  "gongtong2-07d-shortest-path": [
    { mode: "show", sheet: "3-02 Q10 [생각 키우기] (1)" },
    { mode: "show", sheet: "3-02 Q10 (2)(3)" },
    { mode: "show" },
    { mode: "show", sheet: "3-02 Q10 (5) 강 건너편이라면?" },
    { mode: "write", sheet: "3-02 Q10 (4) 최단 거리",
      turn: "교과서 51쪽 — [스스로 익히기] 문제를 해결합니다." },
    { mode: "show" },
  ],
  "gongtong2-07c-tessellation": [
    { mode: "show", sheet: "3-01 [실생활] (1) 빈틈없이 덮으려면" },
    { mode: "show", sheet: "3-01 [실생활] (3) — 대칭은 다음 차시에 다시 봅니다" },
    { mode: "show" },
    { mode: "show", sheet: "3-01 [실생활] (2)(4)" },
    { mode: "write" },
    { mode: "show" },
  ],
};

const MODE = {
  show:  ["t-show", "🖥 보여주며 조작"],
  ask:   ["t-ask",  "💬 발문 — 학생 의견 듣기"],
  write: ["t-write", "✍️ 학습지에 적기"],
  book:  ["t-book", "📖 교과서"],
};

const CSS = `
  .teach{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:7px 0 2px}
  .teach span{border-radius:999px;padding:3px 11px;font-size:12px;font-weight:700;line-height:1.55;white-space:nowrap}
  .t-show{background:#f4f4f5;border:1px solid #e4e4e7;color:#52525b}
  .t-ask{background:#eef2ff;border:1px solid #c7d2fe;color:#3730a3}
  .t-write{background:#fef3c7;border:1px solid #fcd34d;color:#92400e}
  .t-book{background:#ecfdf5;border:1px solid #6ee7b7;color:#065f46}
  .t-sheet{background:#fffbeb;border:1px solid #fde68a;color:#92400e;white-space:normal}
  .turn{display:flex;gap:9px;align-items:flex-start;background:#ecfdf5;border:1px solid #6ee7b7;
    border-left:4px solid #059669;border-radius:10px;padding:11px 14px;margin:11px 0;
    font-size:14px;color:#065f46;font-weight:600;line-height:1.55}
  .turn i{font-style:normal;font-size:17px;line-height:1.3}`;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

let touched = 0, screensDone = 0, warn = [];

for (const [name, plan] of Object.entries(PLAN)) {
  const file = path.join(DIR, name + ".html");
  if (!fs.existsSync(file)) { warn.push(`${name}: 파일 없음`); continue; }
  let html = fs.readFileSync(file, "utf8");

  // 1) 스타일 (한 번만)
  if (!html.includes("/* TEACH:CSS */")) {
    html = html.replace(/<\/style>/, `/* TEACH:CSS */${CSS}\n</style>`);
  }

  // 2) 화면별 칩
  const parts = html.split(/(<section class="screen[^"]*">)/);
  // parts = [머리, 태그1, 본문1, 태그2, 본문2, ...]
  const count = (parts.length - 1) / 2;
  if (count !== plan.length) {
    warn.push(`${name}: 화면 ${count}개인데 계획은 ${plan.length}개 — 건너뜀`);
    continue;
  }

  for (let i = 0; i < count; i++) {
    const bi = 2 + i * 2;                       // 본문 위치
    let body = parts[bi];

    // 기존 삽입물·노란 배지 제거 (다시 돌려도 같은 결과가 되도록)
    body = body.replace(/<!--TEACH:START-->[\s\S]*?<!--TEACH:END-->\s*/g, "");
    body = body.replace(/\s*<span class="sheet">[\s\S]*?<\/span>/g, "");

    const p = plan[i];
    const chips = [];
    const [cls, label] = MODE[p.turn ? "book" : p.mode] ?? MODE.show;
    chips.push(`<span class="${cls}">${p.turn ? "📖 교과서를 펴는 화면" : label}</span>`);
    if (p.sheet) chips.push(`<span class="t-sheet">📄 학습지 ${esc(p.sheet)}</span>`);
    if (p.book && !p.turn) chips.push(`<span class="t-book">📖 교과서 ${esc(p.book)}쪽</span>`);

    let block = `<!--TEACH:START-->\n    <div class="teach">${chips.join("")}</div>`;
    if (p.turn) block += `\n    <div class="turn"><i>📖</i><span>${esc(p.turn)}</span></div>`;
    block += `\n<!--TEACH:END-->`;

    // kicker 바로 뒤에 넣는다. kicker 가 없으면 화면 맨 앞.
    const k = body.match(/<div class="kicker">[\s\S]*?<\/div>\s*/);
    if (k) body = body.slice(0, k.index + k[0].length) + block + "\n    " + body.slice(k.index + k[0].length);
    else   body = "\n    " + block + "\n" + body;

    parts[bi] = body;
    screensDone++;
  }

  const out = parts.join("");
  if (out !== fs.readFileSync(file, "utf8")) { fs.writeFileSync(file, out); touched++; }
}

console.log(`✔ 활동 ${touched}개 파일, 화면 ${screensDone}개에 수업 진행 칩을 넣었습니다.`);
if (warn.length) { console.log("\n⚠ 확인 필요"); warn.forEach((w) => console.log("   " + w)); }
