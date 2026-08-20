// 화면 구성(DB) → 공개 아카이브용 정적 HTML + 목록(JSON) 만들기.
//
// 이 파일에는 DB 접근도, Next 전용 코드도 넣지 않는다.
// "데이터를 주면 파일 내용을 돌려주는" 순수 함수만 둔다. 그래야
//   - scripts/export-archive.mjs (명령줄)
//   - app/api/teacher/archive/route.ts (교사 화면의 버튼)
// 두 곳이 같은 결과를 만든다.

export type ExportQuestion = {
  id: string;
  type: string;
  prompt: string;
  photo?: boolean;
  choices?: string[];
};

export type ExportScreen = {
  screen_key: string;
  order_index: number;
  type: string;
  title: string;
  config: Record<string, unknown>;
  questions: ExportQuestion[];
  sheet: string;
};

export type ExportActivity = {
  id: string;
  title: string;
  unit: string;
  subject: string;
  grade: number;
};

export const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// 파일 이름 — 제목을 그대로 쓰면 주소가 지저분해지므로 소단원 id 앞 8자를 쓴다
export const archiveFileName = (activityId: string) => `screens-${activityId.slice(0, 8)}.html`;

// 질문에서 정답을 걷어낸다. 아카이브는 공개물이라 절대 나가면 안 된다.
export function stripAnswers(questions: unknown): ExportQuestion[] {
  return (Array.isArray(questions) ? questions : []).map((q) => {
    const { answer: _a, tolerance: _t, ...safe } = (q ?? {}) as Record<string, unknown>;
    void _a;
    void _t;
    return safe as ExportQuestion;
  });
}

// 정적 페이지에서는 React 를 못 쓴다. PlaneCanvas 와 같은 그림을 그리는 순수 JS.
const PLANE_JS = String.raw`
function drawPlane(host, cfg) {
  var S = 400, PAD = 28, NS = "http://www.w3.org/2000/svg";
  var pts = {};
  (cfg.points || []).forEach(function (p) { pts[p.name] = { x: p.x, y: p.y }; });
  var sc = (S - 2 * PAD) / (cfg.max - cfg.min);
  function px(x) { return PAD + (x - cfg.min) * sc; }
  function py(y) { return S - PAD - (y - cfg.min) * sc; }
  function fmt(v) { var r = Math.round(v * 100) / 100; return r === 0 ? 0 : r; }
  function at(n) { return pts[n] || { x: 0, y: 0 }; }
  function dist(a, b) { return Math.hypot(at(a).x - at(b).x, at(a).y - at(b).y); }
  function el(n, a) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); return e; }

  var wrap = document.createElement("div"); wrap.className = "lab";
  var svg = el("svg", { viewBox: "0 0 " + S + " " + S });
  var side = document.createElement("div"); side.className = "controls";
  var read = document.createElement("div"); read.className = "readout";
  side.appendChild(read); wrap.appendChild(svg); wrap.appendChild(side); host.appendChild(wrap);

  var dragging = null;
  function draw() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (cfg.grid !== false) {
      for (var g = Math.ceil(cfg.min); g <= cfg.max; g++) {
        svg.appendChild(el("line", { x1: px(g), y1: py(cfg.min), x2: px(g), y2: py(cfg.max), stroke: "#f1f5f9" }));
        svg.appendChild(el("line", { x1: px(cfg.min), y1: py(g), x2: px(cfg.max), y2: py(g), stroke: "#f1f5f9" }));
      }
    }
    svg.appendChild(el("line", { x1: px(cfg.min), y1: py(0), x2: px(cfg.max), y2: py(0), stroke: "#cbd5e1", "stroke-width": 1.5 }));
    svg.appendChild(el("line", { x1: px(0), y1: py(cfg.min), x2: px(0), y2: py(cfg.max), stroke: "#cbd5e1", "stroke-width": 1.5 }));

    (cfg.lines || []).forEach(function (l) {
      svg.appendChild(el("line", { x1: px(cfg.min), y1: py(l.m * cfg.min + l.n), x2: px(cfg.max), y2: py(l.m * cfg.max + l.n), stroke: l.color || "#2563eb", "stroke-width": 2.5 }));
    });
    (cfg.circles || []).forEach(function (c) {
      svg.appendChild(el("circle", { cx: px(at(c.center).x), cy: py(at(c.center).y), r: c.r * sc, fill: "none", stroke: c.color || "#7c3aed", "stroke-width": 2.5 }));
    });
    (cfg.segments || []).forEach(function (g) {
      svg.appendChild(el("line", { x1: px(at(g.from).x), y1: py(at(g.from).y), x2: px(at(g.to).x), y2: py(at(g.to).y), stroke: g.color || "#2563eb", "stroke-width": 3, "stroke-linecap": "round" }));
      if (g.label) {
        var t = el("text", { x: (px(at(g.from).x) + px(at(g.to).x)) / 2, y: (py(at(g.from).y) + py(at(g.to).y)) / 2 - 8, "font-size": 12.5, "font-weight": 700, fill: g.color || "#2563eb", "text-anchor": "middle" });
        t.textContent = fmt(dist(g.from, g.to)); svg.appendChild(t);
      }
    });
    (cfg.points || []).forEach(function (p) {
      var c = at(p.name);
      if (p.draggable) {
        var h = el("circle", { cx: px(c.x), cy: py(c.y), r: 12, fill: p.color || "#2563eb", "fill-opacity": .18, stroke: p.color || "#2563eb", "stroke-width": 2, class: "handle" });
        h.setAttribute("data-name", p.name); svg.appendChild(h);
      }
      svg.appendChild(el("circle", { cx: px(c.x), cy: py(c.y), r: 4.5, fill: p.color || "#2563eb" }));
      var t = el("text", { x: px(c.x) + 9, y: py(c.y) - 8, "font-size": 12.5, "font-weight": 700, fill: p.color || "#2563eb" });
      t.textContent = p.name + "(" + fmt(c.x) + ", " + fmt(c.y) + ")"; svg.appendChild(t);
    });

    var out = "";
    (cfg.readouts || []).forEach(function (r) {
      (cfg.segments || []).forEach(function (g) {
        if (r === "distance") out += g.from + g.to + " = <b>" + fmt(dist(g.from, g.to)) + "</b><br>";
        if (r === "slope") { var dx = at(g.to).x - at(g.from).x, dy = at(g.to).y - at(g.from).y;
          out += g.from + g.to + " 기울기 = <b>" + (dx === 0 ? "없음" : fmt(dy / dx)) + "</b><br>"; }
        if (r === "midpoint") out += g.from + g.to + " 중점 = <b>(" + fmt((at(g.from).x + at(g.to).x) / 2) + ", " + fmt((at(g.from).y + at(g.to).y) / 2) + ")</b><br>";
      });
    });
    read.innerHTML = out || "<span class='hint'>점을 끌어 움직여 보세요.</span>";
  }

  svg.addEventListener("pointerdown", function (e) {
    var t = e.target;
    if (t && t.getAttribute && t.getAttribute("class") === "handle") { dragging = t.getAttribute("data-name"); svg.setPointerCapture(e.pointerId); }
  });
  svg.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    var r = svg.getBoundingClientRect();
    var sx = (e.clientX - r.left) / r.width * S, sy = (e.clientY - r.top) / r.height * S;
    var x = Math.round(cfg.min + (sx - PAD) / sc), y = Math.round(cfg.min + (S - PAD - sy) / sc);
    pts[dragging] = { x: Math.max(cfg.min, Math.min(cfg.max, x)), y: Math.max(cfg.min, Math.min(cfg.max, y)) };
    draw();
  });
  svg.addEventListener("pointerup", function () { dragging = null; });
  svg.addEventListener("pointerleave", function () { dragging = null; });
  draw();
}`;

const CSS = `
  :root{--bg:#fff;--ink:#27272a;--muted:#52525b;--line:#e4e4e7;--blue:#2563eb}
  *{box-sizing:border-box}html,body{margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Segoe UI","Malgun Gothic",sans-serif;color:var(--ink);background:var(--bg);line-height:1.6}
  .wrap{max-width:840px;margin:0 auto;padding:18px 20px 24px}
  .steps{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:14px}
  .dot{width:26px;height:26px;border-radius:999px;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--muted);background:#fff;cursor:pointer}
  .dot.active{background:var(--blue);border-color:var(--blue);color:#fff;font-weight:700}
  .dot.done{border-color:var(--blue);color:var(--blue)}
  .screen{display:none}.screen.on{display:block}
  h1{font-size:22px;margin:4px 0 10px}p{margin:8px 0}
  .sheet{display:inline-block;background:#fef3c7;border:1px solid #fcd34d;color:#92400e;border-radius:999px;padding:2px 11px;font-size:12px;font-weight:700;margin-bottom:6px}
  .lab{display:grid;grid-template-columns:1fr 250px;gap:16px;align-items:start}
  @media (max-width:680px){.lab{grid-template-columns:1fr}}
  svg{width:100%;height:auto;touch-action:none;user-select:none;display:block;background:#fff;border:1px solid var(--line);border-radius:12px}
  .handle{cursor:grab}
  .controls{display:flex;flex-direction:column;gap:10px}
  .readout{font-size:14px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 12px}
  .readout b{color:var(--blue)}
  .hint{font-size:12px;color:var(--muted)}
  .q{background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:12px 16px;margin:12px 0;font-size:14px}
  .q b{color:#1d4ed8}
  .nav{display:flex;justify-content:space-between;align-items:center;margin-top:18px;padding-top:14px;border-top:1px solid var(--line)}
  button.btn{border:1px solid var(--line);background:#fff;color:var(--ink);font:inherit;padding:8px 16px;border-radius:10px;cursor:pointer;font-weight:600}
  button.btn.primary{background:var(--blue);border-color:var(--blue);color:#fff}
  button.btn:disabled{opacity:.4;cursor:default}
  .tag{font-size:11px;color:var(--muted);border:1px solid var(--line);border-radius:6px;padding:1px 6px}
  iframe{width:100%;border:1px solid var(--line);border-radius:12px;background:#fff}
  .note{font-size:12px;color:var(--muted);border-top:1px solid var(--line);margin-top:18px;padding-top:10px}`;

function screenHtml(sc: ExportScreen): string {
  const c = (sc.config ?? {}) as Record<string, string | number | undefined>;
  let body = "";
  if (sc.type === "text") body = String(c.body ?? "");
  else if (sc.type === "plane")
    body = `<div class="plane" data-cfg="${esc(
      JSON.stringify((sc.config as Record<string, unknown>)?.plane ?? {})
    )}"></div>`;
  else if (sc.type === "geogebra")
    body = `<iframe src="https://www.geogebra.org/material/iframe/id/${esc(
      c.materialId
    )}" height="${Number(c.height) || 600}" loading="lazy"></iframe>`;
  else if (sc.type === "image")
    body =
      `<img src="${esc(c.imageUrl)}" alt="${esc(c.caption ?? sc.title)}" style="max-width:100%;border-radius:10px" />` +
      (c.caption ? `<p class="hint">${esc(c.caption)}</p>` : "");
  else if (sc.type === "html" || sc.type === "legacy")
    body = `<iframe srcdoc="${esc(c.html)}" height="${Number(c.height) || 700}" sandbox="allow-scripts"></iframe>`;

  const qs = (sc.questions ?? [])
    .map((q) => {
      const choices =
        q.type === "choice" && q.choices
          ? `<br>${q.choices.map((x) => "○ " + esc(x)).join("<br>")}`
          : "";
      return `<div class="q"><b>✏️ 질문</b> ${esc(q.prompt)}${choices}</div>`;
    })
    .join("\n    ");

  return `  <section class="screen">
    ${sc.sheet ? `<div class="sheet">📄 ${esc(sc.sheet)}</div>` : ""}
    ${sc.title ? `<h1>${esc(sc.title)}</h1>` : ""}
    ${body}
    ${qs}
  </section>`;
}

export function buildArchivePage(activity: ExportActivity, screens: ExportScreen[]): string {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(activity.title)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <div class="steps" id="steps"></div>
${screens.map(screenHtml).join("\n\n")}
  <div class="nav">
    <button class="btn" id="prev">&laquo; 이전</button>
    <span class="tag" id="counter">1 / ${screens.length}</span>
    <button class="btn primary" id="next">다음 &raquo;</button>
  </div>
  <p class="note">공개 아카이브 — 질문은 보여만 줍니다. 답을 저장하려면 수업에서 쓰는 플랫폼으로 여세요.</p>
</div>
<script>
${PLANE_JS}
(function () {
  document.querySelectorAll(".plane").forEach(function (host) {
    try { drawPlane(host, JSON.parse(host.getAttribute("data-cfg"))); } catch (e) {}
  });
  var screens = [].slice.call(document.querySelectorAll(".screen")), N = screens.length, idx = 0;
  var stepsEl = document.getElementById("steps"), counter = document.getElementById("counter");
  var prevBtn = document.getElementById("prev"), nextBtn = document.getElementById("next");
  for (var i = 0; i < N; i++) (function (k) {
    var d = document.createElement("div"); d.className = "dot"; d.textContent = k + 1;
    d.onclick = function () { go(k); }; stepsEl.appendChild(d);
  })(i);
  var dots = [].slice.call(stepsEl.children);
  function go(k) {
    idx = Math.max(0, Math.min(N - 1, k));
    for (var i = 0; i < N; i++) {
      screens[i].classList.toggle("on", i === idx);
      dots[i].classList.toggle("active", i === idx);
      dots[i].classList.toggle("done", i < idx);
    }
    counter.textContent = (idx + 1) + " / " + N;
    prevBtn.disabled = idx === 0;
    nextBtn.textContent = idx === N - 1 ? "완료 ✓" : "다음 »";
  }
  prevBtn.onclick = function () { go(idx - 1); };
  nextBtn.onclick = function () { if (idx < N - 1) go(idx + 1); };
  go(0);
})();
<\/script>
</body>
</html>
`;
}
