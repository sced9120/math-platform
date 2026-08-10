// 공개 아카이브 목차(docs/index.html) 생성 — GitHub Pages 용
// 실행: node scripts/build-archive-index.mjs
//
// docs/ 를 GitHub Pages 소스로 지정하면
//   /                                   → 이 목차
//   /activities/gongtong2-....html      → 활동(로그인 없이 바로 조작 가능)
// 활동 HTML 은 외부 의존성이 없어 그대로 열면 동작한다.
import { writeFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SUBJECT, UNITS, REG } from "./gongtong2-registry.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const docs = join(__dirname, "..", "docs");
const REPO = "https://github.com/sced9120/math-platform";
// 배포된 플랫폼의 체험판 주소 (로그인 없이 둘러보는 읽기 전용 화면)
const DEMO_URL = "https://math.hsorbit.uk/demo";

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

let total = 0, missing = 0;
const sections = UNITS.map((u) => {
  const list = REG.filter((a) => a.unit === u.key).sort((a, b) => a.order - b.order);
  const items = list
    .map((a, i) => {
      const ok = existsSync(join(docs, "activities", a.file));
      if (!ok) { missing++; return ""; }
      total++;
      const kb = (statSync(join(docs, "activities", a.file)).size / 1024).toFixed(0);
      return `        <li class="card">
          <a href="activities/${esc(a.file)}">
            <span class="no">${i + 1}</span>
            <span class="body">
              <span class="t">${esc(a.title)}</span>
              <span class="d">${esc(a.desc ?? "")}</span>
              ${a.sheet ? `<span class="sh">📄 ${esc(a.sheet)}</span>` : ""}
            </span>
            <span class="go">열기 →</span>
          </a>
          <span class="meta">${kb}KB · 단일 HTML</span>
        </li>`;
    })
    .filter(Boolean)
    .join("\n");
  return `      <section class="unit">
        <h2>${esc(u.title)} <span class="cnt">활동 ${list.length}개</span></h2>
        <ul class="cards">
${items}
        </ul>
      </section>`;
}).join("\n\n");

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(SUBJECT.title)} 수학 활동 아카이브</title>
<meta name="description" content="고등학교 ${esc(SUBJECT.title)} 수업용 인터랙티브 수학 활동 ${total}개. 설치 없이 브라우저에서 바로 조작해 볼 수 있습니다." />
<meta property="og:title" content="${esc(SUBJECT.title)} 수학 활동 아카이브" />
<meta property="og:description" content="브라우저에서 바로 조작하는 인터랙티브 수학 활동 ${total}개" />
<style>
  :root{--bg:#fafafa;--card:#fff;--ink:#27272a;--muted:#52525b;--line:#e4e4e7;--blue:#2563eb;--soft:#eff6ff}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Segoe UI","Malgun Gothic","Noto Sans KR",sans-serif;
       background:var(--bg);color:var(--ink);line-height:1.65;-webkit-font-smoothing:antialiased}
  .wrap{max-width:860px;margin:0 auto;padding:40px 20px 60px}
  header h1{font-size:28px;margin:0 0 6px;letter-spacing:-.02em}
  header .sub{color:var(--muted);margin:0 0 18px}
  .lead{background:var(--soft);border:1px solid #bfdbfe;border-radius:14px;padding:16px 18px;margin:0 0 10px;font-size:15px}
  .lead b{color:#1d4ed8}
  .hint{font-size:13px;color:var(--muted);margin:10px 0 14px}
  .guidelink{margin:0 0 30px;font-size:14px}
  .guidelink a{color:var(--blue);font-weight:600;text-decoration:none}
  .guidelink a:hover{text-decoration:underline}
  .guidelink span{display:block;color:var(--muted);font-size:13px;margin-top:2px}
  .unit{margin:0 0 34px}
  .unit h2{font-size:18px;margin:0 0 12px;display:flex;align-items:baseline;gap:10px}
  .unit h2::before{content:"";width:4px;height:18px;background:var(--blue);border-radius:2px;display:inline-block}
  .cnt{font-size:13px;font-weight:400;color:var(--muted)}
  .cards{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;transition:border-color .15s}
  .card:hover{border-color:var(--blue)}
  .card a{display:flex;align-items:center;gap:14px;padding:14px 16px;text-decoration:none;color:inherit}
  .no{flex:none;width:26px;height:26px;border-radius:999px;background:var(--soft);color:var(--blue);
      font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center}
  .body{flex:1;min-width:0}
  .t{display:block;font-weight:600}
  .d{display:block;font-size:13.5px;color:var(--muted);margin-top:2px}
  .sh{display:inline-block;margin-top:5px;background:#fef3c7;border:1px solid #fcd34d;color:#92400e;
      border-radius:999px;padding:1px 9px;font-size:11.5px;font-weight:700}
  .go{flex:none;font-size:13px;color:var(--blue);font-weight:600}
  .meta{display:block;padding:0 16px 10px;font-size:11.5px;color:#a1a1aa}
  footer{margin-top:44px;padding-top:22px;border-top:1px solid var(--line);font-size:14px;color:var(--muted)}
  footer a{color:var(--blue)}
  footer h3{font-size:15px;color:var(--ink);margin:0 0 8px}
  footer ul{margin:6px 0 18px;padding-left:20px}
  footer li{margin:3px 0}
  @media (max-width:520px){ .go{display:none} .wrap{padding:28px 16px 48px} header h1{font-size:23px} }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>${esc(SUBJECT.title)} 수학 활동 아카이브</h1>
      <p class="sub">고등학교 1학년 · 2022 개정 교육과정 · 인터랙티브 활동 ${total}개</p>
    </header>

    <p class="lead">
      각 활동은 <b>설치도 로그인도 없이</b> 브라우저에서 바로 열립니다.
      점을 끌어 보고 슬라이더를 움직이면 값과 식이 실시간으로 바뀝니다.
      수업 중 화면에 띄우거나, 학생에게 링크를 그대로 보내 주셔도 됩니다.
    </p>
    <p class="hint">
      모든 활동은 외부 라이브러리 없이 순수 HTML·SVG·JavaScript 로 만든 <b>단일 파일</b>입니다.
      파일 하나만 내려받아도 오프라인에서 그대로 동작합니다.
    </p>
    <p class="guidelink">
      <a href="guide.html">📘 활동 가져다 쓰기 · 새로 만들기 안내서 →</a>
      <span>내 수업·내 플랫폼에 넣는 방법과, 새 활동을 만들어 추가하는 방법</span>
    </p>
    <p class="guidelink">
      <a href="${DEMO_URL}">🎬 학습 플랫폼 체험해 보기 →</a>
      <span>학생이 보는 화면을 로그인 없이 둘러봅니다 (저장되지 않는 체험판)</span>
    </p>

${sections}

    <footer>
      <h3>이 자료에 대하여</h3>
      <ul>
        <li>교과서(전인태 「공통수학2」) 목차와 <b>2022 개정 교육과정 성취기준</b>에 맞춰 구성했습니다.</li>
        <li>각 활동의 마지막에는 <b>확장 탐구</b> 화면이 있습니다 — 다른 분야와의 연결(수평 확장),
            더 근본적인 원리(수직 확장), 그리고 도전 질문.</li>
        <li>원 소재는 Desmos(Amplify Classroom) 활동이며, 세션 코드 없이 혼자서도 학습할 수 있도록 다시 만들었습니다.</li>
      </ul>
      <h3>가져다 쓰기</h3>
      <ul>
        <li>수업에 자유롭게 쓰셔도 됩니다. 고쳐 쓰실 분은 저장소를 복사(fork)하세요.</li>
        <li>소스와 제작 과정: <a href="${REPO}">${REPO.replace("https://", "")}</a></li>
        <li>학생 진도·서술 답변까지 관리하려면 저장소의 학습 플랫폼을 함께 배포하면 됩니다.</li>
      </ul>
      <p style="font-size:12.5px;color:#a1a1aa">이 목차는 <code>scripts/build-archive-index.mjs</code> 가 자동으로 만듭니다.</p>
    </footer>
  </div>
</body>
</html>
`;

writeFileSync(join(docs, "index.html"), html, "utf8");
// Jekyll 이 밑줄(_)로 시작하는 파일을 무시하지 않도록 끈다
writeFileSync(join(docs, ".nojekyll"), "", "utf8");

console.log(`✔ docs/index.html 생성 — 활동 ${total}개${missing ? `, 파일 없음 ${missing}개` : ""}`);
console.log("✔ docs/.nojekyll 생성 (Jekyll 처리 끄기)");
