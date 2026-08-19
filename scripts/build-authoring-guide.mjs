// 아카이브에 쌓인 활동에서 '집 규칙'을 뽑아 AI 제작 지침으로 만든다.
//   → lib/ai/authoring-guide.ts
//
// 왜 활동 HTML 을 통째로 주지 않는가
//   29개를 다 넣으면 60만 자가 넘어 매 호출이 비싸고, 모델이 예시를 그대로 베낀다.
//   실제로 필요한 것은 '뼈대와 약속'이다 — 클래스 이름, 화면 구조, Plane 헬퍼,
//   그리고 잘 만든 예시 하나. 그것만 추려 넣는다.
//
// 실행: node scripts/build-authoring-guide.mjs
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "docs", "activities");
const OUT = join(ROOT, "lib", "ai", "authoring-guide.ts");

const files = readdirSync(DIR).filter((f) => f.endsWith(".html"));

// ── 1) 공용 CSS 클래스 — 여러 활동이 함께 쓰는 것만 '집 스타일'로 본다 ──────
const classCount = new Map();
for (const f of files) {
  const s = readFileSync(join(DIR, f), "utf8");
  const style = s.slice(0, s.indexOf("</style>"));
  const seen = new Set();
  for (const m of style.matchAll(/^\s*\.([a-z][\w-]*)(?:[.,:{\s])/gim)) seen.add(m[1]);
  for (const c of seen) classCount.set(c, (classCount.get(c) ?? 0) + 1);
}
const common = [...classCount.entries()]
  .filter(([, n]) => n >= files.length / 2)
  .sort((a, b) => b[1] - a[1])
  .map(([c]) => c);

// ── 2) Plane 헬퍼가 제공하는 메서드 (가장 많이 쓰이는 구현 하나에서) ────────
const planeFile = files.find((f) => readFileSync(join(DIR, f), "utf8").includes("function Plane(svg,lo,hi)"));
const planeSrc = planeFile ? readFileSync(join(DIR, planeFile), "utf8") : "";
const planeBody = planeSrc.slice(planeSrc.indexOf("function Plane(svg,lo,hi)"));
const planeMethods = [...planeBody.slice(0, planeBody.indexOf("\n  }")).matchAll(/^\s{6}(\w+):function\(([^)]*)\)/gm)]
  .map((m) => `${m[1]}(${m[2]})`);

// ── 3) 예시 — 화면 하나가 짧고 조작이 분명한 것을 고른다 ────────────────────
function sampleScreen() {
  for (const f of ["gongtong2-l5-circle-line.html", "gongtong2-04-circle-equation.html"]) {
    const s = readFileSync(join(DIR, f), "utf8");
    const sec = [...s.matchAll(/<section class="screen[^"]*"[^>]*>[\s\S]*?<\/section>/g)]
      .map((m) => m[0])
      .find((x) => x.includes("<svg") && x.length < 1600);
    if (sec) return sec;
  }
  return "";
}

const guide = `// 자동 생성 — scripts/build-authoring-guide.mjs 로 다시 만든다. 직접 고치지 말 것.
// 아카이브 활동 ${files.length}개에서 뽑은 '집 규칙'이다.

export const HOUSE_CLASSES = ${JSON.stringify(common)};

export const PLANE_METHODS = ${JSON.stringify(planeMethods)};

export const SAMPLE_SCREEN = ${JSON.stringify(sampleScreen())};

export const ARCHIVE_COUNT = ${files.length};
`;

writeFileSync(OUT, guide, "utf8");
console.log(`✔ ${OUT.replace(ROOT + "/", "")}`);
console.log(`  활동 ${files.length}개 · 공용 클래스 ${common.length}개 · Plane 메서드 ${planeMethods.length}개`);
console.log(`  ${common.slice(0, 18).join(" ")} …`);
