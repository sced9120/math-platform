-- ============================================================
-- 만져보는 수학 HTML 자료 넣기·고치기 (scripts/build-hands-on-sql.mjs 가 만든 파일 — 손으로 고치지 마세요)
-- 0018 까지 실행한 데이터베이스의 SQL Editor 에서 실행합니다. 여러 번 실행해도 됩니다.
--  - 없는 자료는 공개 상태로 새로 넣고, 있는 자료는 HTML(config)만 바꿉니다.
-- ============================================================

-- 자유 작도 — 눈금 없는 자와 컴퍼스  (원본: content/hands-on/compass-straightedge.html)
insert into public.manipulatives
  (slug, title, summary, topic, school_level, order_index, type, config, is_published, owner_id)
values (
  'compass-straightedge',
  '자유 작도 — 눈금 없는 자와 컴퍼스',
  '자를 고정해 가장자리로 곧은 선을, 컴퍼스 침을 고정하고 연필을 돌려 원을 그립니다. 끝없이 넓은 종이에서 확대·축소하며 작도해 보세요.',
  '작도', 'middle', 1, 'html',
  jsonb_build_object('height', 660, 'html', $hands_on$<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>자유 작도 — 눈금 없는 자와 컴퍼스</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif; color: #1f2937; }
  #app { height: 660px; display: flex; flex-direction: column; user-select: none; -webkit-user-select: none; }
  #bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px; border-bottom: 1px solid #e5e7eb; background: #f9fafb; }
  .grp { display: flex; align-items: center; gap: 4px; padding-right: 6px; margin-right: 2px; border-right: 1px solid #e5e7eb; }
  .grp:last-child { border-right: 0; }
  button { font: inherit; font-size: 13px; border: 1px solid #d1d5db; background: #fff; color: #374151; border-radius: 8px; padding: 6px 9px; cursor: pointer; line-height: 1; white-space: nowrap; }
  button:hover { background: #f3f4f6; }
  button.on { background: #2563eb; border-color: #2563eb; color: #fff; }
  button.lock.on { background: #f59e0b; border-color: #f59e0b; color: #fff; }
  button:disabled { opacity: .4; cursor: default; }
  button.warn { border-color: #fca5a5; color: #b91c1c; }
  .dot { width: 22px; height: 22px; padding: 0; border-radius: 999px; border: 2px solid #fff; box-shadow: 0 0 0 1px #d1d5db; }
  .dot.on { box-shadow: 0 0 0 2px #2563eb; }
  #stage { position: relative; flex: 1; overflow: hidden; touch-action: none; background: #fdfdfb; }
  #cv { position: absolute; inset: 0; display: block; }
  #hint { position: absolute; left: 10px; bottom: 10px; max-width: min(560px, calc(100% - 190px)); background: rgba(255,255,255,.92); border: 1px solid #e5e7eb; border-radius: 10px; padding: 7px 10px; font-size: 12.5px; line-height: 1.5; color: #374151; pointer-events: none; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
  #zoom { position: absolute; right: 10px; bottom: 10px; display: flex; gap: 4px; align-items: center; background: rgba(255,255,255,.92); border: 1px solid #e5e7eb; border-radius: 10px; padding: 4px; }
  #zoom button { padding: 5px 8px; }
  #zv { min-width: 46px; text-align: center; font-size: 12px; color: #4b5563; }
  @media (max-width: 560px) { #hint { max-width: calc(100% - 20px); bottom: 56px; } button { padding: 6px 7px; } }
</style>
</head>
<body>
<div id="app">
  <div id="bar">
    <div class="grp">
      <button data-mode="hand" title="화면 이동 (스페이스바를 누른 채 끌어도 됩니다)">✋ 이동</button>
      <button data-mode="pen" class="on" title="펜으로 긋기">✏️ 펜</button>
      <button data-mode="point" title="점 찍기">• 점</button>
      <button data-mode="erase" title="지우개 — 지울 선이나 점을 누르거나 문지르세요">🧽 지우개</button>
    </div>
    <div class="grp">
      <button id="bRuler" class="on" title="눈금 없는 자 꺼내기/넣기">📏 자</button>
      <button id="bRulerLock" class="lock" title="자를 움직이지 않게 고정 — 고정하면 가장자리를 따라 곧은 선이 그어집니다">🔒 자 고정</button>
      <button id="bComp" class="on" title="컴퍼스 꺼내기/넣기">🧭 컴퍼스</button>
      <button id="bPin" class="lock" title="컴퍼스 침 고정 — 고정한 뒤 연필 끝을 끌면 원이 그려집니다">📌 침 고정</button>
    </div>
    <div class="grp" id="colors"></div>
    <div class="grp">
      <button id="bUndo" title="되돌리기 (Ctrl+Z)">↶</button>
      <button id="bRedo" title="다시 하기 (Ctrl+Shift+Z)">↷</button>
      <button id="bGrid" title="격자 보이기">격자</button>
      <button id="bClear" class="warn" title="그린 것 모두 지우기">모두 지우기</button>
    </div>
  </div>
  <div id="stage">
    <canvas id="cv"></canvas>
    <div id="hint"></div>
    <div id="zoom">
      <button id="zOut" title="축소">−</button>
      <span id="zv">100%</span>
      <button id="zIn" title="확대">+</button>
      <button id="zHome" title="처음 보기로">⌖</button>
    </div>
  </div>
</div>
<script>
(function () {
  "use strict";
  var TAU = Math.PI * 2;
  var cv = document.getElementById("cv");
  var ctx = cv.getContext("2d");
  var stage = document.getElementById("stage");
  var hintEl = document.getElementById("hint");
  var W = 0, H = 0, DPR = 1;

  // ── 보기(무한 캔버스) — 화면좌표 = (세계좌표 - o) × z ─────────────
  var V = { ox: 0, oy: 0, z: 1 };
  var ZMIN = 0.08, ZMAX = 10;

  // ── 상태 ─────────────────────────────────────────────────────
  var S = { mode: "pen", color: "#111827", grid: false, objs: [], hist: [], fut: [], ver: 0, focus: "compass" };
  var COLORS = [["#111827", "검정"], ["#2563eb", "파랑"], ["#dc2626", "빨강"], ["#059669", "초록"]];
  // 눈금 없는 자: 중심(x,y), 각 a, 길이·폭은 실제 물건처럼 고정
  var R = { on: true, x: 0, y: 175, a: 0, len: 680, wid: 58, fixed: false };
  // 컴퍼스: 침(nx,ny), 벌린 거리 r, 방향 a(침→연필), 다리 길이 LEG
  var LEG = 230, MAXR = LEG * 2 * 0.95, MINR = 3;
  var C = { on: true, nx: -150, ny: 40, r: 170, a: 0, pinned: false, flip: false };

  var op = null;        // 지금 하는 조작
  var preview = null;   // 그리는 중인 선
  var snapMark = null;  // 붙는 점 표시
  var edgeHot = null;   // 펜이 닿을 자의 가장자리 (+1/-1)
  var pointers = new Map();
  var pinch = null;
  var spaceDown = false;

  // ── 수학 도우미 ───────────────────────────────────────────────
  function d2(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  function wrap(t) { while (t > Math.PI) t -= TAU; while (t <= -Math.PI) t += TAU; return t; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function segDist(p, a, b) {
    var vx = b.x - a.x, vy = b.y - a.y, L = vx * vx + vy * vy;
    var t = L ? clamp(((p.x - a.x) * vx + (p.y - a.y) * vy) / L, 0, 1) : 0;
    return d2(p, { x: a.x + vx * t, y: a.y + vy * t });
  }
  function toWorld(sx, sy) { return { x: sx / V.z + V.ox, y: sy / V.z + V.oy }; }
  function px(n) { return n / V.z; } // 화면 n픽셀을 세계 길이로

  // ── 자 ────────────────────────────────────────────────────────
  function rAxes() { var c = Math.cos(R.a), s = Math.sin(R.a); return { ux: c, uy: s, vx: -s, vy: c }; }
  function rLocal(p) { var A = rAxes(), dx = p.x - R.x, dy = p.y - R.y; return { u: dx * A.ux + dy * A.uy, v: dx * A.vx + dy * A.vy }; }
  function rWorld(u, v) { var A = rAxes(); return { x: R.x + A.ux * u + A.vx * v, y: R.y + A.uy * u + A.vy * v }; }
  function rKnob() { return rWorld(R.len / 2 - 30, 0); }
  function rHit(p) { var L = rLocal(p); return Math.abs(L.u) <= R.len / 2 && Math.abs(L.v) <= R.wid / 2; }
  // 펜이 가장자리 가까이 있는가 → 어느 쪽 가장자리, 가장자리 위의 위치 u
  function rNearEdge(p, tol) {
    var L = rLocal(p);
    if (Math.abs(L.u) > R.len / 2 + tol) return null;
    var best = null;
    [1, -1].forEach(function (sg) {
      var dist = Math.abs(L.v - sg * R.wid / 2);
      if (dist < tol && (!best || dist < best.dist)) best = { sign: sg, u: clamp(L.u, -R.len / 2, R.len / 2), dist: dist };
    });
    return best;
  }

  // ── 컴퍼스 ────────────────────────────────────────────────────
  function cPen() { return { x: C.nx + C.r * Math.cos(C.a), y: C.ny + C.r * Math.sin(C.a) }; }
  function cNormal() { var n = { x: Math.sin(C.a), y: -Math.cos(C.a) }; return C.flip ? { x: -n.x, y: -n.y } : n; }
  function cHinge() {
    var P = cPen(), n = cNormal(), h = Math.sqrt(Math.max(LEG * LEG - (C.r / 2) * (C.r / 2), 0));
    return { x: (C.nx + P.x) / 2 + n.x * h, y: (C.ny + P.y) / 2 + n.y * h };
  }
  function cKnob() { var Hh = cHinge(), n = cNormal(); return { x: Hh.x + n.x * 56, y: Hh.y + n.y * 56 }; }
  // 세워 놓을 때는 경첩이 화면 위쪽으로 오게 (돌리는 중에는 바꾸지 않아 부드럽게 돈다)
  function cUpright() { C.flip = Math.cos(C.a) < 0; }

  // ── 붙는 점: 찍은 점·선분 끝점·원의 중심·교점 ───────────────────
  var snapCache = { ver: -1, pts: [] };
  function inArc(o, th) {
    var span = o.a1 - o.a0;
    if (Math.abs(span) >= TAU - 1e-6) return true;
    var d = th - o.a0;
    if (span >= 0) { d = ((d % TAU) + TAU) % TAU; return d <= span + 1e-6; }
    d = ((-d % TAU) + TAU) % TAU; return d <= -span + 1e-6;
  }
  function onSeg(o, p) { return segDist(p, { x: o.x1, y: o.y1 }, { x: o.x2, y: o.y2 }) < 1e-4 * Math.max(1, d2({ x: o.x1, y: o.y1 }, { x: o.x2, y: o.y2 })); }
  function interLL(a, b) {
    var x1 = a.x1, y1 = a.y1, x2 = a.x2, y2 = a.y2, x3 = b.x1, y3 = b.y1, x4 = b.x2, y4 = b.y2;
    var den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(den) < 1e-9) return [];
    var t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
    var u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;
    if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) return [];
    return [{ x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) }];
  }
  function interLC(s, c) {
    var dx = s.x2 - s.x1, dy = s.y2 - s.y1, fx = s.x1 - c.cx, fy = s.y1 - c.cy;
    var A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), Cc = fx * fx + fy * fy - c.r * c.r;
    var disc = B * B - 4 * A * Cc, out = [];
    if (A < 1e-12 || disc < 0) return out;
    var sq = Math.sqrt(disc);
    [(-B - sq) / (2 * A), (-B + sq) / (2 * A)].forEach(function (t) {
      if (t < -1e-6 || t > 1 + 1e-6) return;
      var p = { x: s.x1 + t * dx, y: s.y1 + t * dy };
      if (inArc(c, Math.atan2(p.y - c.cy, p.x - c.cx))) out.push(p);
    });
    return out;
  }
  function interCC(a, b) {
    var dx = b.cx - a.cx, dy = b.cy - a.cy, d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1e-9 || d > a.r + b.r + 1e-9 || d < Math.abs(a.r - b.r) - 1e-9) return [];
    var l = (a.r * a.r - b.r * b.r + d * d) / (2 * d), h = Math.sqrt(Math.max(a.r * a.r - l * l, 0));
    var mx = a.cx + dx * l / d, my = a.cy + dy * l / d, out = [];
    [[mx + h * dy / d, my - h * dx / d], [mx - h * dy / d, my + h * dx / d]].forEach(function (q, i) {
      if (i === 1 && h < 1e-9) return;
      var p = { x: q[0], y: q[1] };
      if (inArc(a, Math.atan2(p.y - a.cy, p.x - a.cx)) && inArc(b, Math.atan2(p.y - b.cy, p.x - b.cx))) out.push(p);
    });
    return out;
  }
  function snapPoints() {
    if (snapCache.ver === S.ver) return snapCache.pts;
    var pts = [], segs = [], arcs = [];
    S.objs.forEach(function (o) {
      if (o.t === "pt") pts.push({ x: o.x, y: o.y });
      else if (o.t === "seg") { segs.push(o); pts.push({ x: o.x1, y: o.y1 }, { x: o.x2, y: o.y2 }); }
      else if (o.t === "arc") {
        arcs.push(o); pts.push({ x: o.cx, y: o.cy });
        if (Math.abs(o.a1 - o.a0) < TAU - 1e-6) {
          pts.push({ x: o.cx + o.r * Math.cos(o.a0), y: o.cy + o.r * Math.sin(o.a0) });
          pts.push({ x: o.cx + o.r * Math.cos(o.a1), y: o.cy + o.r * Math.sin(o.a1) });
        }
      }
    });
    var i, j;
    for (i = 0; i < segs.length; i++) for (j = i + 1; j < segs.length; j++) pts.push.apply(pts, interLL(segs[i], segs[j]));
    for (i = 0; i < segs.length; i++) for (j = 0; j < arcs.length; j++) pts.push.apply(pts, interLC(segs[i], arcs[j]));
    for (i = 0; i < arcs.length; i++) for (j = i + 1; j < arcs.length; j++) pts.push.apply(pts, interCC(arcs[i], arcs[j]));
    snapCache = { ver: S.ver, pts: pts };
    return pts;
  }
  function findSnap(p, tolPx, except) {
    var tol = px(tolPx), best = null, bd = tol;
    snapPoints().forEach(function (q) {
      if (except && d2(q, except) < 1e-6) return;
      var d = d2(p, q);
      if (d < bd) { bd = d; best = q; }
    });
    return best;
  }

  // ── 기록(되돌리기) ────────────────────────────────────────────
  function commit(next) { S.hist.push(S.objs); if (S.hist.length > 200) S.hist.shift(); S.objs = next; S.fut = []; S.ver++; syncButtons(); }
  function addObj(o) { commit(S.objs.concat([o])); }
  function undo() { if (!S.hist.length) return; S.fut.push(S.objs); S.objs = S.hist.pop(); S.ver++; syncButtons(); draw(); }
  function redo() { if (!S.fut.length) return; S.hist.push(S.objs); S.objs = S.fut.pop(); S.ver++; syncButtons(); draw(); }
  function nextLabel() {
    var used = {};
    S.objs.forEach(function (o) { if (o.t === "pt") used[o.label] = 1; });
    var abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (var k = 0; k < 10; k++) for (var i = 0; i < abc.length; i++) {
      var l = abc[i] + (k ? String(k) : "");
      if (!used[l]) return l;
    }
    return "P";
  }

  // ── 지우개 ────────────────────────────────────────────────────
  function hitObj(o, p, tol) {
    if (o.t === "pt") return d2(o, p) < tol + px(4);
    if (o.t === "seg") return segDist(p, { x: o.x1, y: o.y1 }, { x: o.x2, y: o.y2 }) < tol;
    if (o.t === "arc") return Math.abs(d2(p, { x: o.cx, y: o.cy }) - o.r) < tol && inArc(o, Math.atan2(p.y - o.cy, p.x - o.cx));
    if (o.t === "free") {
      for (var i = 1; i < o.pts.length; i++) if (segDist(p, { x: o.pts[i - 1][0], y: o.pts[i - 1][1] }, { x: o.pts[i][0], y: o.pts[i][1] }) < tol) return true;
      return o.pts.length === 1 && d2(p, { x: o.pts[0][0], y: o.pts[0][1] }) < tol;
    }
    return false;
  }
  function eraseAt(p) {
    var tol = px(9), keep = S.objs.filter(function (o) { return !hitObj(o, p, tol); });
    if (keep.length !== S.objs.length) { S.objs = keep; S.ver++; op.changed = true; }
  }
  // 빠르게 문질러도 사이를 건너뛰지 않도록 지나온 길을 촘촘히 훑는다
  function eraseAlong(a, b) {
    var n = Math.max(1, Math.ceil(d2(a, b) / px(4)));
    for (var i = 1; i <= n; i++) eraseAt({ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n });
  }

  // ── 그리기 ────────────────────────────────────────────────────
  var queued = false;
  function draw() { if (!queued) { queued = true; requestAnimationFrame(render); } }

  function render() {
    queued = false;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = "#fdfdfb";
    ctx.fillRect(0, 0, W, H);
    if (S.grid) drawGrid();
    ctx.setTransform(DPR * V.z, 0, 0, DPR * V.z, -V.ox * V.z * DPR, -V.oy * V.z * DPR);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    // 자는 투명 아크릴이라 그린 선이 비쳐 보여야 한다 — 자를 먼저 깔고 그 위에 선을 그린다
    if (R.on) drawRuler();
    S.objs.forEach(function (o) { if (o.t !== "pt") drawObj(o); });
    if (preview) drawObj(preview);
    S.objs.forEach(function (o) { if (o.t === "pt") drawObj(o); });
    if (C.on) drawCompass();
    if (snapMark) {
      ctx.strokeStyle = "#e11d48"; ctx.lineWidth = px(2);
      ctx.beginPath(); ctx.arc(snapMark.x, snapMark.y, px(8), 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(snapMark.x - px(12), snapMark.y); ctx.lineTo(snapMark.x + px(12), snapMark.y);
      ctx.moveTo(snapMark.x, snapMark.y - px(12)); ctx.lineTo(snapMark.x, snapMark.y + px(12)); ctx.stroke();
    }
    document.getElementById("zv").textContent = Math.round(V.z * 100) + "%";
  }

  function drawGrid() {
    var step = 50; while (step * V.z < 22) step *= 2; while (step * V.z > 90) step /= 2;
    var x0 = Math.floor(V.ox / step) * step, y0 = Math.floor(V.oy / step) * step;
    ctx.fillStyle = "#d4d4d8";
    for (var x = x0; x < V.ox + W / V.z; x += step)
      for (var y = y0; y < V.oy + H / V.z; y += step)
        ctx.fillRect((x - V.ox) * V.z - 1, (y - V.oy) * V.z - 1, 2, 2);
  }

  function drawObj(o) {
    ctx.strokeStyle = o.c || "#111827";
    ctx.lineWidth = px(o.w || 2.2);
    if (o.t === "seg") { ctx.beginPath(); ctx.moveTo(o.x1, o.y1); ctx.lineTo(o.x2, o.y2); ctx.stroke(); }
    else if (o.t === "arc") { ctx.beginPath(); ctx.arc(o.cx, o.cy, o.r, o.a0, o.a1, o.a1 < o.a0); ctx.stroke(); }
    else if (o.t === "free") {
      var p = o.pts; ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
      if (p.length === 1) ctx.lineTo(p[0][0] + 0.01, p[0][1]);
      for (var i = 1; i < p.length - 1; i++) ctx.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
      if (p.length > 1) ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
      ctx.stroke();
    } else if (o.t === "pt") {
      ctx.fillStyle = o.c || "#111827";
      ctx.beginPath(); ctx.arc(o.x, o.y, px(4), 0, TAU); ctx.fill();
      ctx.font = "600 " + px(15) + "px -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
      ctx.fillText(o.label, o.x + px(7), o.y - px(7));
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }

  // 눈금 없는 자 — 반투명 아크릴 판. 눈금이 없다.
  function drawRuler() {
    var L = R.len, Wd = R.wid;
    ctx.save();
    ctx.translate(R.x, R.y); ctx.rotate(R.a);
    ctx.shadowColor = "rgba(15,23,42,.18)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
    roundRect(-L / 2, -Wd / 2, L, Wd, 7);
    var g = ctx.createLinearGradient(0, -Wd / 2, 0, Wd / 2);
    g.addColorStop(0, "rgba(224,242,254,.88)"); g.addColorStop(.5, "rgba(186,230,253,.72)"); g.addColorStop(1, "rgba(147,214,250,.78)");
    ctx.fillStyle = g; ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.lineWidth = px(R.fixed ? 2.6 : 1.4);
    ctx.strokeStyle = R.fixed ? "#f59e0b" : "rgba(3,105,161,.75)";
    ctx.stroke();
    // 아크릴 두께감
    ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = px(1.5);
    ctx.beginPath(); ctx.moveTo(-L / 2 + 8, -Wd / 2 + 4); ctx.lineTo(L / 2 - 8, -Wd / 2 + 4); ctx.stroke();
    ctx.strokeStyle = "rgba(3,105,161,.25)";
    ctx.beginPath(); ctx.moveTo(-L / 2 + 8, Wd / 2 - 4); ctx.lineTo(L / 2 - 8, Wd / 2 - 4); ctx.stroke();
    // 펜이 닿을 가장자리
    if (edgeHot) {
      ctx.strokeStyle = S.color; ctx.globalAlpha = .45; ctx.lineWidth = px(5);
      ctx.beginPath(); ctx.moveTo(-L / 2, edgeHot * Wd / 2); ctx.lineTo(L / 2, edgeHot * Wd / 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = "rgba(3,105,161,.32)";
    ctx.font = "600 13px -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("눈금 없는 자", -40, 0);
    var kx = L / 2 - 30;
    if (!R.fixed) {
      ctx.fillStyle = "rgba(255,255,255,.95)"; ctx.strokeStyle = "rgba(3,105,161,.8)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(kx, 0, 15, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "#0369a1"; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(kx, 0, 8, -2.6, 1.9); ctx.stroke();
      var ax = kx + 8 * Math.cos(1.9), ay = 8 * Math.sin(1.9);
      ctx.fillStyle = "#0369a1"; ctx.beginPath(); ctx.moveTo(ax - 5, ay - 1); ctx.lineTo(ax + 3, ay + 4); ctx.lineTo(ax + 2, ay - 5); ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = "#f59e0b"; roundRect(kx - 9, -3, 18, 14, 3); ctx.fill();
      ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.arc(kx, -3, 6, Math.PI, 0); ctx.stroke();
    }
    ctx.restore();
  }

  function taper(a, b, wa, wb, fill, stroke) {
    var dx = b.x - a.x, dy = b.y - a.y, L = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / L, ny = dx / L;
    ctx.beginPath();
    ctx.moveTo(a.x + nx * wa, a.y + ny * wa); ctx.lineTo(b.x + nx * wb, b.y + ny * wb);
    ctx.lineTo(b.x - nx * wb, b.y - ny * wb); ctx.lineTo(a.x - nx * wa, a.y - ny * wa); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.2; ctx.stroke(); }
  }
  function along(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
  function toward(a, b, len) { var L = d2(a, b) || 1; return { x: a.x + (b.x - a.x) * len / L, y: a.y + (b.y - a.y) * len / L }; }

  // 컴퍼스 — 침 다리, 연필 다리, 경첩, 손잡이
  function drawCompass() {
    var N = { x: C.nx, y: C.ny }, P = cPen(), Hh = cHinge(), K = cKnob();
    ctx.save();
    ctx.shadowColor = "rgba(15,23,42,.22)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
    // 손잡이
    taper(Hh, K, 5, 5, "#64748b", "#334155");
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#475569"; ctx.beginPath(); ctx.arc(K.x, K.y, 10, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 1;
    for (var i = 1; i <= 3; i++) { var q = along(Hh, K, 0.25 * i), r = toward(q, { x: q.x + (K.y - Hh.y), y: q.y - (K.x - Hh.x) }, 4.5); ctx.beginPath(); ctx.moveTo(2 * q.x - r.x, 2 * q.y - r.y); ctx.lineTo(r.x, r.y); ctx.stroke(); }
    // 침 다리
    var Nn = toward(N, Hh, 22);
    taper(Hh, Nn, 7.5, 3.6, "#94a3b8", "#475569");
    ctx.strokeStyle = "#1f2937"; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(Nn.x, Nn.y); ctx.lineTo(N.x, N.y); ctx.stroke();
    // 연필 다리: 금속 → 고정 고리 → 연필 몸통 → 나무 → 심
    var A1 = along(Hh, P, 0.5), B1 = toward(P, Hh, 30), T1 = toward(P, Hh, 8);
    taper(Hh, A1, 7.5, 5.5, "#94a3b8", "#475569");
    taper(toward(A1, Hh, 4), toward(A1, P, 8), 7.5, 7.5, "#334155");
    taper(toward(A1, P, 8), B1, 5.5, 5.5, "#fbbf24", "#b45309");
    taper(B1, T1, 5.5, 2, "#f1d5a8", "#b45309");
    taper(T1, P, 2, 0.3, C.pinned ? S.color : "#1f2937");
    // 경첩
    var g = ctx.createRadialGradient(Hh.x - 4, Hh.y - 4, 2, Hh.x, Hh.y, 14);
    g.addColorStop(0, "#f8fafc"); g.addColorStop(.6, "#94a3b8"); g.addColorStop(1, "#475569");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(Hh.x, Hh.y, 13, 0, TAU); ctx.fill();
    ctx.fillStyle = "#334155"; ctx.beginPath(); ctx.arc(Hh.x, Hh.y, 3, 0, TAU); ctx.fill();
    ctx.restore();
    // 침 고정 표시 · 끌 수 있는 곳 표시 (화면 크기 고정)
    if (C.pinned) {
      ctx.strokeStyle = "#dc2626"; ctx.lineWidth = px(2.2);
      ctx.beginPath(); ctx.arc(N.x, N.y, px(7), 0, TAU); ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(37,99,235,.18)"; ctx.beginPath(); ctx.arc(N.x, N.y, px(9), 0, TAU); ctx.fill();
    }
    ctx.fillStyle = C.pinned ? "rgba(220,38,38,.16)" : "rgba(245,158,11,.22)";
    ctx.beginPath(); ctx.arc(P.x, P.y, px(11), 0, TAU); ctx.fill();
  }

  // ── 보기 조작 ─────────────────────────────────────────────────
  function zoomAt(sx, sy, f) {
    var z = clamp(V.z * f, ZMIN, ZMAX), w = toWorld(sx, sy);
    V.z = z; V.ox = w.x - sx / z; V.oy = w.y - sy / z; draw();
  }
  // 처음 보기: 큰 화면은 100%, 좁은 화면(휴대폰·작은 창)은 자와 컴퍼스가 다 보이게 줄인다
  function fitZoom(w, h) { return clamp(Math.min(w / 760, h / 600), 0.35, 1); }
  function home() { V.z = fitZoom(W, H); V.ox = -W / 2 / V.z; V.oy = -H / 2 / V.z + 20; draw(); }

  function resize() {
    var r = stage.getBoundingClientRect(), nw = Math.max(r.width, 10), nh = Math.max(r.height, 10);
    if (!W) { V.z = fitZoom(nw, nh); V.ox = -nw / 2 / V.z; V.oy = -nh / 2 / V.z + 20; }
    else { var cx = V.ox + W / 2 / V.z, cy = V.oy + H / 2 / V.z; V.ox = cx - nw / 2 / V.z; V.oy = cy - nh / 2 / V.z; }
    W = nw; H = nh; DPR = window.devicePixelRatio || 1;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    cv.style.width = W + "px"; cv.style.height = H + "px";
    draw();
  }

  // ── 입력 ──────────────────────────────────────────────────────
  function local(e) { var r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  function begin(e, s) {
    var p = toWorld(s.x, s.y), tol = px(16);
    if (e.button === 1 || spaceDown) { op = { k: "pan", sx: s.x, sy: s.y, ox: V.ox, oy: V.oy }; return; }

    // 컴퍼스가 위에 있으니 먼저 본다
    if (C.on) {
      var P = cPen(), N = { x: C.nx, y: C.ny }, Hh = cHinge(), K = cKnob();
      var aNow = Math.atan2(p.y - C.ny, p.x - C.nx);
      if (d2(p, P) < Math.max(tol, 12)) {
        S.focus = "compass";
        if (C.pinned) { op = { k: "cdraw", a0: C.a, last: aNow, acc: 0 }; preview = { t: "arc", cx: C.nx, cy: C.ny, r: C.r, a0: C.a, a1: C.a, c: S.color }; }
        else op = { k: "copen" };
        return;
      }
      // 침이 고정돼 있으면 침 끝은 잡지 않는다 — 그 점에서 자로 선을 시작할 수 있게
      if (!C.pinned && d2(p, N) < Math.max(tol, 10)) { S.focus = "compass"; op = { k: "cmove", p0: p, n0: N }; return; }
      var nearPinned = C.pinned && d2(p, N) < Math.max(tol, 12);
      var onBody = !nearPinned && (d2(p, K) < Math.max(tol, 14) || segDist(p, Hh, K) < Math.max(px(9), 6) || d2(p, Hh) < Math.max(tol, 15) ||
        segDist(p, Hh, N) < Math.max(px(9), 8) || segDist(p, Hh, P) < Math.max(px(9), 8));
      if (onBody) {
        S.focus = "compass";
        op = C.pinned ? { k: "crot", off: wrap(aNow - C.a) } : { k: "cmove", p0: p, n0: N };
        return;
      }
    }
    if (R.on) {
      if (R.fixed && S.mode === "pen") {
        var ne = rNearEdge(p, px(18));
        if (ne) {
          S.focus = "ruler";
          var u0 = snapU(ne.sign, ne.u);
          op = { k: "rline", sign: ne.sign, u0: u0 };
          var a = rWorld(u0, ne.sign * R.wid / 2);
          preview = { t: "seg", x1: a.x, y1: a.y, x2: a.x, y2: a.y, c: S.color };
          return;
        }
      }
      if (!R.fixed) {
        if (d2(p, rKnob()) < Math.max(px(18), 16)) { S.focus = "ruler"; op = rotStart(p); return; }
        if (rHit(p)) { S.focus = "ruler"; op = { k: "rmove", p0: p, c0: { x: R.x, y: R.y } }; return; }
      }
    }
    if (S.mode === "hand" || (e.pointerType === "mouse" && e.button === 2)) { op = { k: "pan", sx: s.x, sy: s.y, ox: V.ox, oy: V.oy }; return; }
    if (S.mode === "pen") { op = { k: "free", last: s }; preview = { t: "free", pts: [[p.x, p.y]], c: S.color }; return; }
    if (S.mode === "point") { op = { k: "point", s0: s }; return; }
    if (S.mode === "erase") { op = { k: "erase", before: S.objs, changed: false, last: p }; eraseAt(p); }
  }

  // 자 가장자리 위의 위치 u — 가장자리 위(또는 아주 가까이)에 있는 점에 붙는다
  function snapU(sign, u) {
    var q = rWorld(u, sign * R.wid / 2), sp = findSnap(q, 12);
    if (sp) { var L = rLocal(sp); if (Math.abs(L.v - sign * R.wid / 2) < px(3)) { snapMark = sp; return clamp(L.u, -R.len / 2, R.len / 2); } }
    snapMark = null;
    return u;
  }

  // 자 돌리기: 가장자리가 어떤 점 위에 있으면 그 점을 축으로, 아니면 가운데를 축으로 돈다
  function rotStart(p) {
    var pivot = null, sign = 0;
    snapPoints().some(function (q) {
      var L = rLocal(q);
      if (Math.abs(L.u) > R.len / 2) return false;
      if (Math.abs(L.v - R.wid / 2) < px(2)) { pivot = q; sign = 1; return true; }
      if (Math.abs(L.v + R.wid / 2) < px(2)) { pivot = q; sign = -1; return true; }
      return false;
    });
    var c = pivot || { x: R.x, y: R.y };
    var o = { k: "rrot", pivot: c, sign: sign, off: wrap(Math.atan2(p.y - c.y, p.x - c.x) - R.a) };
    if (pivot) { var L = rLocal(pivot); o.pu = L.u; }
    return o;
  }

  function move(e, s) {
    var p = toWorld(s.x, s.y);
    if (!op) { hover(p); return; }
    switch (op.k) {
      case "pan":
        V.ox = op.ox - (s.x - op.sx) / V.z; V.oy = op.oy - (s.y - op.sy) / V.z; break;
      case "free": {
        if (Math.abs(s.x - op.last.x) + Math.abs(s.y - op.last.y) < 1.5) return;
        op.last = s; preview.pts.push([p.x, p.y]); break;
      }
      case "rline": {
        var L = rLocal(p), u1 = snapU(op.sign, clamp(L.u, -R.len / 2, R.len / 2));
        var a = rWorld(op.u0, op.sign * R.wid / 2), b = rWorld(u1, op.sign * R.wid / 2);
        preview.x1 = a.x; preview.y1 = a.y; preview.x2 = b.x; preview.y2 = b.y; edgeHot = op.sign; break;
      }
      case "rmove": {
        R.x = op.c0.x + p.x - op.p0.x; R.y = op.c0.y + p.y - op.p0.y;
        // 가장자리가 점 가까이 가면 점에 딱 붙인다
        snapMark = null;
        var best = null, A = rAxes();
        snapPoints().forEach(function (q) {
          var Lq = rLocal(q);
          if (Math.abs(Lq.u) > R.len / 2) return;
          [1, -1].forEach(function (sg) {
            var d = Lq.v - sg * R.wid / 2;
            if (Math.abs(d) < px(9) && (!best || Math.abs(d) < Math.abs(best.d))) best = { d: d, q: q };
          });
        });
        if (best) { R.x += A.vx * best.d; R.y += A.vy * best.d; snapMark = best.q; }
        break;
      }
      case "rrot": {
        var ang = wrap(Math.atan2(p.y - op.pivot.y, p.x - op.pivot.x) - op.off);
        snapMark = op.sign ? op.pivot : null;
        if (op.sign) {
          // 축(점)에서 다른 점을 향하는 각에 가까우면 그 각으로 맞춘다
          var pv = op.pivot;
          snapPoints().forEach(function (q) {
            if (d2(q, pv) < px(4)) return;
            var aq = Math.atan2(q.y - pv.y, q.x - pv.x);
            [aq, wrap(aq + Math.PI)].forEach(function (cand) {
              var diff = Math.abs(wrap(cand - ang)), dist = d2(q, pv) * Math.sin(diff);
              if (diff < Math.PI / 2 && dist < px(8)) { ang = cand; snapMark = q; }
            });
          });
          R.a = ang;
          var A2 = rAxes();
          R.x = op.pivot.x - A2.ux * op.pu - A2.vx * op.sign * R.wid / 2;
          R.y = op.pivot.y - A2.uy * op.pu - A2.vy * op.sign * R.wid / 2;
        } else R.a = ang;
        break;
      }
      case "cmove": {
        var n = { x: op.n0.x + p.x - op.p0.x, y: op.n0.y + p.y - op.p0.y }, sp = findSnap(n, 12);
        snapMark = sp; if (sp) n = sp;
        C.nx = n.x; C.ny = n.y; break;
      }
      case "copen": {
        var t = p, sp2 = findSnap(p, 12, { x: C.nx, y: C.ny });
        snapMark = sp2; if (sp2) t = sp2;
        C.r = clamp(d2(t, { x: C.nx, y: C.ny }), MINR, MAXR);
        C.a = Math.atan2(t.y - C.ny, t.x - C.nx); cUpright(); break;
      }
      case "cdraw": {
        var th = Math.atan2(p.y - C.ny, p.x - C.nx);
        op.acc = clamp(op.acc + wrap(th - op.last), -TAU, TAU); op.last = th;
        C.a = op.a0 + op.acc; preview.a1 = C.a; break;
      }
      case "crot":
        C.a = Math.atan2(p.y - C.ny, p.x - C.nx) - op.off; break;
      case "erase": eraseAlong(op.last, p); op.last = p; break;
    }
    draw(); hint();
  }

  function end(s) {
    if (!op) return;
    var p = toWorld(s.x, s.y);
    switch (op.k) {
      case "free": if (preview.pts.length > 1) addObj(preview); break;
      case "rline": if (d2({ x: preview.x1, y: preview.y1 }, { x: preview.x2, y: preview.y2 }) > px(3)) addObj(preview); break;
      case "cdraw": if (Math.abs(op.acc) > 0.015) addObj({ t: "arc", cx: C.nx, cy: C.ny, r: C.r, a0: op.a0, a1: op.a0 + op.acc, c: S.color }); break;
      case "point": {
        if (Math.abs(s.x - op.s0.x) + Math.abs(s.y - op.s0.y) > 8) break;
        var sp = findSnap(p, 12) || p;
        addObj({ t: "pt", x: sp.x, y: sp.y, label: nextLabel(), c: S.color }); break;
      }
      case "erase": if (op.changed) { S.hist.push(op.before); S.fut = []; syncButtons(); } break;
    }
    op = null; preview = null; snapMark = null; edgeHot = null;
    draw(); hint();
  }

  // 아무것도 누르지 않을 때: 붙을 점·자 가장자리 미리 보여 주기
  function hover(p) {
    var cursor = S.mode === "hand" ? "grab" : S.mode === "erase" ? "cell" : "crosshair";
    snapMark = null; edgeHot = null;
    if (C.on) {
      var P = cPen(), N = { x: C.nx, y: C.ny }, Hh = cHinge(), K = cKnob();
      if (d2(p, P) < px(16) || d2(p, N) < px(16) || d2(p, K) < Math.max(px(16), 14) || d2(p, Hh) < 15 ||
          segDist(p, Hh, N) < Math.max(px(9), 8) || segDist(p, Hh, P) < Math.max(px(9), 8)) cursor = "grab";
    }
    if (cursor !== "grab" && R.on) {
      if (R.fixed && S.mode === "pen") { var ne = rNearEdge(p, px(18)); if (ne) { edgeHot = ne.sign; cursor = "crosshair"; } }
      else if (!R.fixed && (rHit(p) || d2(p, rKnob()) < 16)) cursor = d2(p, rKnob()) < 16 ? "alias" : "grab";
    }
    if (S.mode === "point" && cursor === "crosshair") snapMark = findSnap(p, 12);
    stage.style.cursor = cursor;
    draw();
  }

  stage.addEventListener("pointerdown", function (e) {
    if (e.target !== cv) return;
    stage.setPointerCapture(e.pointerId);
    var s = local(e);
    pointers.set(e.pointerId, s);
    if (pointers.size === 2) {
      // 두 손가락: 그리던 것을 취소하고 확대·이동
      if (op && op.k === "erase" && op.changed) S.objs = op.before, S.ver++;
      op = null; preview = null; snapMark = null;
      var it = pointers.values(), a = it.next().value, b = it.next().value;
      pinch = { d: d2(a, b) || 1, m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, z: V.z, ox: V.ox, oy: V.oy };
      draw(); return;
    }
    if (pointers.size > 2) return;
    if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 1) return;
    begin(e, s); draw(); hint();
  });
  stage.addEventListener("pointermove", function (e) {
    var s = local(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, s);
    if (pinch && pointers.size >= 2) {
      var it = pointers.values(), a = it.next().value, b = it.next().value;
      var z = clamp(pinch.z * (d2(a, b) / pinch.d), ZMIN, ZMAX), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      var w = { x: pinch.m.x / pinch.z + pinch.ox, y: pinch.m.y / pinch.z + pinch.oy };
      V.z = z; V.ox = w.x - m.x / z; V.oy = w.y - m.y / z; draw(); return;
    }
    move(e, s);
  });
  function up(e) {
    var s = local(e);
    var had = pointers.has(e.pointerId);
    pointers.delete(e.pointerId);
    if (pinch) { if (pointers.size < 2) pinch = null; return; }
    if (had) end(s);
  }
  stage.addEventListener("pointerup", up);
  stage.addEventListener("pointercancel", up);
  stage.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  stage.addEventListener("wheel", function (e) {
    e.preventDefault();
    var s = local(e);
    zoomAt(s.x, s.y, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)));
  }, { passive: false });
  stage.addEventListener("dblclick", function (e) {
    if (!C.on) return;
    var p = toWorld(local(e).x, local(e).y);
    if (d2(p, { x: C.nx, y: C.ny }) < px(18) || d2(p, cHinge()) < 18) togglePin();
  });
  window.addEventListener("keydown", function (e) {
    if (e.code === "Space") { spaceDown = true; stage.style.cursor = "grab"; e.preventDefault(); }
    var mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === "z" || e.key === "Z")) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    if (mod && (e.key === "y" || e.key === "Y")) { e.preventDefault(); redo(); }
    if (e.key === "Escape" && op) { op = null; preview = null; snapMark = null; draw(); }
  });
  window.addEventListener("keyup", function (e) { if (e.code === "Space") spaceDown = false; });

  // ── 버튼 ──────────────────────────────────────────────────────
  var $ = function (id) { return document.getElementById(id); };
  document.querySelectorAll("[data-mode]").forEach(function (b) {
    b.addEventListener("click", function () { S.mode = b.getAttribute("data-mode"); syncButtons(); hint(); });
  });
  var colorsEl = $("colors");
  COLORS.forEach(function (c) {
    var b = document.createElement("button");
    b.className = "dot"; b.title = c[1] + " 펜"; b.style.background = c[0]; b.setAttribute("data-color", c[0]);
    b.addEventListener("click", function () { S.color = c[0]; syncButtons(); draw(); });
    colorsEl.appendChild(b);
  });
  function centerWorld() { return toWorld(W / 2, H / 2); }
  $("bRuler").addEventListener("click", function () {
    R.on = !R.on;
    if (R.on) { var c = centerWorld(); R.x = c.x; R.y = c.y + px(110); R.a = 0; R.fixed = false; S.focus = "ruler"; }
    syncButtons(); draw(); hint();
  });
  $("bRulerLock").addEventListener("click", function () { if (!R.on) return; R.fixed = !R.fixed; S.focus = "ruler"; if (R.fixed) S.mode = "pen"; syncButtons(); draw(); hint(); });
  $("bComp").addEventListener("click", function () {
    C.on = !C.on;
    if (C.on) { var c = centerWorld(); C.nx = c.x - 80; C.ny = c.y - px(20); C.r = 150; C.a = 0; C.pinned = false; cUpright(); S.focus = "compass"; }
    syncButtons(); draw(); hint();
  });
  function togglePin() { if (!C.on) return; C.pinned = !C.pinned; if (!C.pinned) cUpright(); S.focus = "compass"; syncButtons(); draw(); hint(); }
  $("bPin").addEventListener("click", togglePin);
  $("bUndo").addEventListener("click", undo);
  $("bRedo").addEventListener("click", redo);
  $("bGrid").addEventListener("click", function () { S.grid = !S.grid; syncButtons(); draw(); });
  // 확인 창을 띄울 수 없는 곳(iframe)이라 두 번 눌러 지운다
  var clearArm = 0;
  $("bClear").addEventListener("click", function () {
    var b = $("bClear");
    if (!S.objs.length) return;
    if (Date.now() - clearArm < 2500) { commit([]); clearArm = 0; b.textContent = "모두 지우기"; draw(); return; }
    clearArm = Date.now(); b.textContent = "한 번 더 누르면 지웁니다";
    setTimeout(function () { if (Date.now() - clearArm >= 2400) b.textContent = "모두 지우기"; }, 2500);
  });
  $("zIn").addEventListener("click", function () { zoomAt(W / 2, H / 2, 1.25); });
  $("zOut").addEventListener("click", function () { zoomAt(W / 2, H / 2, 0.8); });
  $("zHome").addEventListener("click", home);
  ["zoom"].forEach(function (id) { $(id).addEventListener("pointerdown", function (e) { e.stopPropagation(); }); });

  function syncButtons() {
    document.querySelectorAll("[data-mode]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-mode") === S.mode); });
    document.querySelectorAll("[data-color]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-color") === S.color); });
    $("bRuler").classList.toggle("on", R.on);
    $("bRulerLock").classList.toggle("on", R.on && R.fixed);
    $("bRulerLock").disabled = !R.on;
    $("bRulerLock").textContent = R.fixed ? "🔓 자 풀기" : "🔒 자 고정";
    $("bComp").classList.toggle("on", C.on);
    $("bPin").classList.toggle("on", C.on && C.pinned);
    $("bPin").disabled = !C.on;
    $("bPin").textContent = C.pinned ? "📍 침 풀기" : "📌 침 고정";
    $("bGrid").classList.toggle("on", S.grid);
    $("bUndo").disabled = !S.hist.length;
    $("bRedo").disabled = !S.fut.length;
  }

  // 지금 할 수 있는 일을 한 줄로 알려 준다
  function hint() {
    var t;
    if (op && op.k === "cdraw") t = "🧭 원하는 만큼 돌린 뒤 손을 떼세요. 한 바퀴를 넘기면 원이 닫힙니다.";
    else if (op && op.k === "rline") t = "📏 자의 가장자리를 따라 곧은 선이 그어집니다. 점 가까이에서 멈추면 그 점에 붙습니다.";
    else if (S.mode === "erase") t = "🧽 지울 선이나 점을 누르거나 문지르세요. 실수했다면 ↶ 로 되돌립니다.";
    else if (S.mode === "point") t = "• 점을 찍을 곳을 누르세요. 교점·끝점·원의 중심 가까이 누르면 그 위치에 정확히 찍힙니다.";
    else if (S.mode === "hand") t = "✋ 빈 곳을 끌어 화면을 옮깁니다. 휠(또는 두 손가락)로 확대·축소합니다.";
    else if (S.focus === "compass" && C.on) {
      t = C.pinned
        ? "📌 침 고정됨 — <b>연필 끝</b>을 끌어 돌리면 원(호)이 그려집니다. <b>손잡이</b>를 끌면 그리지 않고 돌아갑니다. 벌린 거리를 바꾸려면 '침 풀기'."
        : "🧭 <b>침 끝</b>을 끌어 중심에 놓고, <b>연필 끝</b>을 끌어 원하는 만큼 벌리세요(점 가까이 가면 붙습니다). 그다음 <b>침 고정</b>. (침을 두 번 눌러도 고정)";
    } else if (S.focus === "ruler" && R.on) {
      t = R.fixed
        ? "🔒 자 고정됨 — 펜으로 <b>자의 가장자리</b>를 따라 그으면 곧은 선이 됩니다. 옮기려면 '자 풀기'."
        : "📏 <b>몸통</b>을 끌어 옮기고 <b>↻ 손잡이</b>로 돌리세요. 가장자리가 점에 닿으면 붙고, 그 점을 축으로 돌아 다른 점에도 맞춰집니다. 맞췄으면 <b>자 고정</b>.";
    } else t = "✏️ 펜: 자유롭게 그립니다. 📏 자를 고정하면 가장자리를 따라 곧은 선, 🧭 컴퍼스 침을 고정하면 원을 그릴 수 있습니다.";
    hintEl.innerHTML = t;
  }

  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  window.addEventListener("resize", resize);
  cUpright();
  resize(); syncButtons(); hint();
})();
</script>
</body>
</html>
$hands_on$::text),
  true, null
)
on conflict (slug) do update
  set type = excluded.type, config = excluded.config, updated_at = now();

-- 띠 안에 가두기 — 수열은 어디로 다가갈까  (원본: content/hands-on/calc2-sequence-band.html)
insert into public.manipulatives
  (slug, title, summary, topic, school_level, order_index, type, config, is_published, owner_id)
values (
  'calc2-sequence-band',
  '띠 안에 가두기 — 수열은 어디로 다가갈까',
  '수열의 점들 위에 ''가로 띠''를 직접 끌어 놓고 좁혀 보며, 어떤 값 L 둘레의 띠 안에 결국 모든 항이 들어오는지로 수렴과 발산을 판정해 본다.',
  '미적분Ⅱ · 수열의 극한', 'high', 1, 'html',
  jsonb_build_object('height', 660, 'html', $hands_on$<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>띠 안에 가두기 — 수열의 수렴과 발산</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif; color: #1f2937; }
  #app { height: 660px; display: flex; flex-direction: column; user-select: none; -webkit-user-select: none; }
  #bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px; border-bottom: 1px solid #e5e7eb; background: #f9fafb; }
  .grp { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
  button { font: inherit; font-size: 13px; border: 1px solid #d1d5db; background: #fff; color: #374151; border-radius: 8px; padding: 8px 10px; min-height: 36px; cursor: pointer; line-height: 1; white-space: nowrap; }
  button:hover { background: #f3f4f6; }
  button.on { background: #2563eb; border-color: #2563eb; color: #fff; }
  #formula { margin-left: auto; font-size: 18px; font-weight: 600; color: #1e3a8a; }
  #stage { position: relative; flex: 1; overflow: hidden; touch-action: none; background: #fdfdfb; }
  #cv { position: absolute; inset: 0; display: block; touch-action: none; }
  #status { position: absolute; right: 8px; top: 8px; width: 210px; background: rgba(255,255,255,.88); border: 1px solid #e5e7eb; border-radius: 10px; padding: 6px 9px; font-size: 12.5px; line-height: 1.45; pointer-events: none; }
  #status .v { font-variant-numeric: tabular-nums; color: #374151; }
  #status .ok { color: #15803d; font-weight: 600; }
  #status .ng { color: #b91c1c; font-weight: 600; }
  #status .sm { color: #6b7280; font-size: 11px; margin-top: 3px; }
  #hint { position: absolute; left: 10px; bottom: 10px; max-width: min(520px, calc(100% - 190px)); background: rgba(255,255,255,.92); border: 1px solid #e5e7eb; border-radius: 10px; padding: 7px 10px; font-size: 12.5px; line-height: 1.5; color: #374151; pointer-events: none; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
  #acts { position: absolute; right: 10px; bottom: 10px; display: flex; flex-direction: column; gap: 4px; }
  #qpanel { position: absolute; left: 8px; right: 8px; top: 8px; bottom: 8px; background: rgba(255,255,255,.97); border: 1px solid #d1d5db; border-radius: 10px; padding: 12px 14px; overflow-y: auto; font-size: 13.5px; line-height: 1.6; display: none; z-index: 5; }
  #qpanel.open { display: block; }
  #qpanel ol { padding-left: 20px; margin: 8px 0; }
  #qpanel li { margin-bottom: 8px; }
  #qpanel .warnbox { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 6px 9px; font-size: 12.5px; color: #1e3a8a; }
  #qclose { position: sticky; top: 0; float: right; }
  @media (max-width: 560px) {
    #hint { max-width: calc(100% - 20px); bottom: 92px; }
    #acts { flex-direction: row; }
    #status { width: 190px; font-size: 12px; }
    #formula { margin-left: 0; width: 100%; }
  }
</style>
</head>
<body>
<div id="app">
  <div id="bar">
    <div class="grp" id="seqs"></div>
    <button id="bReset" title="현재 수열의 기본값으로 되돌리기">처음으로</button>
    <div id="formula"></div>
  </div>
  <div id="stage">
    <canvas id="cv"></canvas>
    <div id="status"></div>
    <div id="hint"></div>
    <div id="acts">
      <button id="bQ">질문 보기</button>
      <button id="bAuto">N 자동 찾기</button>
    </div>
    <div id="qpanel">
      <button id="qclose">닫기</button>
      <b>탐구 질문</b>
      <div class="warnbox">화면은 n=60까지의 유한한 항만 보여 줍니다. 수렴·발산은 모든 n에 대한 이야기이므로, 마지막 판정은 일반항으로 합니다.</div>
      <ol>
        <li>① aₙ = 1/n 에서 L = 0, ε = 0.1 로 두면 N은 얼마부터인가요? ε = 0.05 이면? ε을 절반으로 줄이면 N은 어떻게 변하나요?</li>
        <li>③ 2 + (−1)ⁿ/n 은 2보다 컸다 작았다 합니다. 그래도 2로 수렴한다고 말할 수 있는 이유를 띠로 설명해 보세요.</li>
        <li>④ (−1)ⁿ 에서 L을 1, 0, −1 등 여러 곳에 두어 보세요. ε을 충분히 작게 하면 어느 L에서도 ‘어떤 N 이후 모두 띠 안’이 될 수 없는 까닭은 무엇인가요?</li>
        <li>⑤ √n 과 ⑥ 1 − n 은 둘 다 발산합니다. 띠에서 벗어나는 모양은 서로 어떻게 다른가요? 이 둘과 ④의 발산은 어떻게 다른가요? (양의 무한대로 발산 / 음의 무한대로 발산 / 진동)</li>
      </ol>
    </div>
  </div>
</div>
<script>
(function () {
  "use strict";
  var cv = document.getElementById("cv");
  var ctx = cv.getContext("2d");
  var stage = document.getElementById("stage");
  var statusEl = document.getElementById("status");
  var hintEl = document.getElementById("hint");
  var NMAX = 60, W = 0, H = 0, DPR = 1;
  var PAD = { l: 50, r: 16, t: 14, b: 34 };

  // ── 수열 목록: 일반항, 세로 범위 ───────────────────────────────
  var SEQS = [
    { label: "① 1/n", tex: "1/n", f: function (n) { return 1 / n; }, lo: -0.5, hi: 1.5, kind: "conv" },
    { label: "② (n+1)/n", tex: "(n+1)/n", f: function (n) { return (n + 1) / n; }, lo: 0, hi: 2.5, kind: "conv" },
    { label: "③ 2+(−1)ⁿ/n", tex: "2 + (−1)ⁿ/n", f: function (n) { return 2 + (n % 2 ? -1 : 1) / n; }, lo: 0.5, hi: 3.5, kind: "conv" },
    { label: "④ (−1)ⁿ", tex: "(−1)ⁿ", f: function (n) { return n % 2 ? -1 : 1; }, lo: -2, hi: 2, kind: "osc" },
    { label: "⑤ √n", tex: "√n", f: function (n) { return Math.sqrt(n); }, lo: 0, hi: 9, kind: "pos" },
    { label: "⑥ 1−n", tex: "1 − n", f: function (n) { return 1 - n; }, lo: -62, hi: 3, kind: "neg" }
  ];
  var cur = 0, L = 0, EPS = 0.2, N = 1;
  var extraHint = "", autoFail = false;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function r2(v) { return Math.round(v * 100) / 100; }
  function fmt(v) { return isFinite(v) ? (Math.round(v * 1000) / 1000).toFixed(2).replace(/\.?0+$/, function (m) { return m.length > 3 ? "" : m; }) : "—"; }
  function range() { return SEQS[cur].hi - SEQS[cur].lo; }
  function an(n) { return SEQS[cur].f(n); }
  // 띠 안 판정: |aₙ − L| < ε (엄격). 부동소수 오차를 1e-9 로 정리해 비교
  function inside(n) {
    var d = Math.round(Math.abs(an(n) - L) * 1e9) / 1e9;
    return d < Math.round(EPS * 1e9) / 1e9;
  }
  function outsideCount() { var k = 0; for (var n = N; n <= NMAX; n++) if (!inside(n)) k++; return k; }

  // ── 좌표 변환 ───────────────────────────────────────────────
  function pw() { return W - PAD.l - PAD.r; }
  function ph() { return H - PAD.t - PAD.b; }
  function X(n) { return PAD.l + (n - 1) / (NMAX - 1) * pw(); }
  function Y(v) { return PAD.t + (SEQS[cur].hi - v) / range() * ph(); }
  function unY(py) { return SEQS[cur].hi - (py - PAD.t) / ph() * range(); }
  function yc(v) { return clamp(Y(v), PAD.t, PAD.t + ph()); }

  // ── 설정/초기화 ─────────────────────────────────────────────
  function setSeq(i) {
    cur = i; L = 0;
    EPS = Math.round(range() / 8 / 0.005) * 0.005;
    N = 1; autoFail = false;
    var k = SEQS[i].kind;
    extraHint = k === "osc" ? "L을 어디에 두어도 띠를 0.5보다 좁히면 어떻게 되는지 보세요."
      : (k === "pos" || k === "neg") ? "띠를 어디에 놓아도 점들이 결국 띠를 뚫고 나가는 방향을 보세요." : "";
    var bs = document.querySelectorAll("#seqs button");
    for (var j = 0; j < bs.length; j++) bs[j].className = j === i ? "on" : "";
    document.getElementById("formula").textContent = "aₙ = " + SEQS[i].tex;
    update();
  }
  function snapL(v) {
    var tol = range() * 0.01, best = null, bd = tol;
    for (var k = 1; k <= 4; k++) {
      var c = Math.round(v * k) / k, d = Math.abs(c - v);
      if (d <= bd) { bd = d; best = c; }
    }
    return best === null ? r2(v) : r2(best);
  }

  // ── 화면 갱신 ───────────────────────────────────────────────
  function update() {
    var out = outsideCount();
    var ok = out === 0;
    statusEl.innerHTML = '<div class="v">L = ' + L.toFixed(2) + ' / ε = ' + EPS.toFixed(3).replace(/0$/, "") + ' / N = ' + N + '</div>' +
      (ok ? '<div class="ok">✔ N=' + N + ' 이후 보이는 항은 모두 띠 안</div>' : '<div class="ng">✘ N 이후에 띠 밖 항 ' + out + '개</div>') +
      '<div class="sm">화면에는 n=60까지만 보입니다. 그 뒤의 항은 일반항으로 생각해 보세요.</div>';
    var h;
    if (autoFail) h = "60까지 안에는 그런 N이 없어요. 일반항으로 따지면 N이 정말 없을까요, 화면이 짧은 것일까요?";
    else if (ok) h = "좋아요! 이제 띠를 더 좁혀 보세요. 그래도 어떤 N부터는 모두 띠 안에 들어오나요?";
    else h = "파란 띠의 가운데 선을 끌어 수열이 다가가는 것 같은 값에 놓아 보세요. 오른쪽 네모로 띠를 좁힐 수 있어요.";
    if (extraHint && !autoFail) h += " " + extraHint;
    hintEl.textContent = h;
    draw();
  }

  function resize() {
    DPR = window.devicePixelRatio || 1;
    W = stage.clientWidth; H = stage.clientHeight;
    cv.width = Math.max(1, Math.round(W * DPR)); cv.height = Math.max(1, Math.round(H * DPR));
    cv.style.width = W + "px"; cv.style.height = H + "px";
    draw();
  }

  function tri(x, y, up, c) {
    ctx.fillStyle = c; ctx.beginPath();
    if (up) { ctx.moveTo(x, y - 5); ctx.lineTo(x - 4, y + 3); ctx.lineTo(x + 4, y + 3); }
    else { ctx.moveTo(x, y + 5); ctx.lineTo(x - 4, y - 3); ctx.lineTo(x + 4, y - 3); }
    ctx.closePath(); ctx.fill();
  }

  function draw() {
    if (!W) return;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var s = SEQS[cur], top = PAD.t, bot = PAD.t + ph(), left = PAD.l, right = PAD.l + pw();
    // 격자와 눈금 (세로축: 정수 단위로, 범위가 크면 성기게)
    ctx.font = "11px sans-serif"; ctx.fillStyle = "#6b7280"; ctx.strokeStyle = "#eef0f3"; ctx.lineWidth = 1;
    var step = range() > 20 ? 10 : range() > 6 ? 2 : range() > 3 ? 1 : 0.5;
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (var v = Math.ceil(s.lo / step) * step; v <= s.hi + 1e-9; v += step) {
      var yy = Y(v); ctx.beginPath(); ctx.moveTo(left, yy); ctx.lineTo(right, yy); ctx.stroke();
      ctx.fillText(fmt(v), left - 6, yy);
    }
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (var n0 = 10; n0 <= NMAX; n0 += 10) ctx.fillText(String(n0), X(n0), bot + 6);
    ctx.fillText("n", right - 4, bot + 18);
    ctx.strokeStyle = "#9ca3af"; ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left, bot); ctx.lineTo(right, bot); ctx.stroke();
    // y=0 선
    if (s.lo < 0 && s.hi > 0) { ctx.strokeStyle = "#d1d5db"; ctx.beginPath(); ctx.moveTo(left, Y(0)); ctx.lineTo(right, Y(0)); ctx.stroke(); }

    // 띠
    var yU = yc(L + EPS), yD = yc(L - EPS), yL = yc(L);
    ctx.fillStyle = "rgba(37,99,235,0.13)"; ctx.fillRect(left, yU, right - left, yD - yU);
    ctx.strokeStyle = "rgba(37,99,235,0.55)"; ctx.lineWidth = 1.2; ctx.setLineDash([5, 4]);
    [L + EPS, L - EPS].forEach(function (b) { var y = Y(b); if (y >= top && y <= bot) { ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke(); } });
    ctx.setLineDash([]);
    ctx.strokeStyle = "#1d4ed8"; ctx.lineWidth = 2;
    if (Y(L) >= top && Y(L) <= bot) { ctx.beginPath(); ctx.moveTo(left, Y(L)); ctx.lineTo(right, Y(L)); ctx.stroke(); }

    // N 깃발
    var xn = X(N);
    ctx.strokeStyle = "#6b7280"; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(xn, top); ctx.lineTo(xn, bot); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#374151"; ctx.beginPath(); ctx.moveTo(xn, top); ctx.lineTo(xn + 26, top + 7); ctx.lineTo(xn, top + 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 9px sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("N", xn + 4, top + 7);
    ctx.fillStyle = "#374151"; ctx.beginPath(); ctx.moveTo(xn, bot - 4); ctx.lineTo(xn + 8, bot - 14); ctx.lineTo(xn - 8, bot - 14); ctx.closePath(); ctx.fill();

    // 점
    for (var n = 1; n <= NMAX; n++) {
      var a = an(n), x = X(n), y = Y(a), ins = inside(n), after = n >= N;
      ctx.globalAlpha = after ? 1 : 0.35;
      var col = ins ? "#2563eb" : "#f97316";
      if (y < top) tri(x, top + 5, true, col);
      else if (y > bot) tri(x, bot - 5, false, col);
      else {
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 3.6, 0, 6.2832); ctx.fill();
        if (after && !ins) { ctx.strokeStyle = "#dc2626"; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(x, y, 5.6, 0, 6.2832); ctx.stroke(); }
      }
      if (after && !ins && (y < top || y > bot)) { ctx.strokeStyle = "#dc2626"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y < top ? top + 3 : bot - 3, 6, 0, 6.2832); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;

    // 손잡이: L (왼쪽 동그라미), ε (위 경계 오른쪽 네모)
    var hy = clamp(Y(L), top, bot);
    ctx.fillStyle = "#1d4ed8"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(left + 14, hy, 9, 0, 6.2832); ctx.fill(); ctx.stroke();
    var ey = clamp(Y(L + EPS), top + 8, bot - 8);
    ctx.fillStyle = "#2563eb"; ctx.fillRect(right - 22, ey - 8, 16, 16); ctx.strokeRect(right - 22, ey - 8, 16, 16);
  }

  // ── 끌기 (Pointer Events) ────────────────────────────────────
  var drag = null;
  function pos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function hit(p) {
    var top = PAD.t, bot = PAD.t + ph(), right = PAD.l + pw();
    var cand = [
      { k: "L", d: Math.hypot(p.x - (PAD.l + 14), p.y - clamp(Y(L), top, bot)) },
      { k: "E", d: Math.hypot(p.x - (right - 14), p.y - clamp(Y(L + EPS), top + 8, bot - 8)) },
      { k: "N", d: (p.y > bot - 44 || p.y < top + 24) ? Math.abs(p.x - X(N)) : 999 }
    ];
    cand.sort(function (a, b) { return a.d - b.d; });
    return cand[0].d <= 22 ? cand[0].k : null;
  }
  cv.addEventListener("pointerdown", function (e) {
    var p = pos(e), k = hit(p);
    if (!k) return;
    drag = { k: k, id: e.pointerId };
    try { cv.setPointerCapture(e.pointerId); } catch (x) {}
    e.preventDefault();
  });
  cv.addEventListener("pointermove", function (e) {
    if (!drag || drag.id !== e.pointerId) return;
    var p = pos(e);
    if (drag.k === "L") {
      L = snapL(clamp(unY(p.y), SEQS[cur].lo - range() * 0.1, SEQS[cur].hi + range() * 0.1));
    } else if (drag.k === "E") {
      var e2 = Math.abs(unY(p.y) - L);
      EPS = clamp(Math.round(e2 / 0.005) * 0.005, 0.005, Math.round(range() / 2 / 0.005) * 0.005);
    } else {
      N = clamp(Math.round(1 + (p.x - PAD.l) / pw() * (NMAX - 1)), 1, NMAX);
    }
    autoFail = false;
    update();
    e.preventDefault();
  });
  function endDrag(e) { if (drag && drag.id === e.pointerId) drag = null; }
  cv.addEventListener("pointerup", endDrag);
  cv.addEventListener("pointercancel", endDrag);

  // ── 버튼 ────────────────────────────────────────────────────
  var seqBox = document.getElementById("seqs");
  SEQS.forEach(function (s, i) {
    var b = document.createElement("button");
    b.textContent = s.label;
    b.addEventListener("click", function () { setSeq(i); });
    seqBox.appendChild(b);
  });
  document.getElementById("bReset").addEventListener("click", function () { setSeq(cur); });
  document.getElementById("bAuto").addEventListener("click", function () {
    // 끝에서부터 거꾸로 훑어 처음으로 띠 밖인 항 바로 다음을 N 으로
    if (!inside(NMAX)) { autoFail = true; update(); return; }
    var m = NMAX;
    while (m > 1 && inside(m - 1)) m--;
    N = m; autoFail = false; update();
  });
  var qp = document.getElementById("qpanel");
  document.getElementById("bQ").addEventListener("click", function () { qp.classList.toggle("open"); });
  document.getElementById("qclose").addEventListener("click", function () { qp.classList.remove("open"); });

  window.addEventListener("resize", resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  setSeq(0);
  resize();
})();
</script>
</body>
</html>
$hands_on$::text),
  true, null
)
on conflict (slug) do update
  set type = excluded.type, config = excluded.config, updated_at = now();

-- 극한 조립기 — 수렴하는 수열을 더하고 곱하고 나누면  (원본: content/hands-on/calc2-limit-assembler.html)
insert into public.manipulatives
  (slug, title, summary, topic, school_level, order_index, type, config, is_published, owner_id)
values (
  'calc2-limit-assembler',
  '극한 조립기 — 수렴하는 수열을 더하고 곱하고 나누면',
  '수열 카드 두 장을 연산 기계에 끼워 넣어 합·차·실수배·곱·몫의 극한이 각 극한의 합·차·실수배·곱·몫이 되는지 확인하고, ∞/∞ 꼴은 분모의 최고차항으로 나누어 ''수렴하는 조각''으로 쪼갠 뒤 조립해 본다.',
  '미적분Ⅱ · 수열의 극한', 'high', 2, 'html',
  jsonb_build_object('height', 660, 'html', $hands_on$<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>극한 조립기 — 수렴하는 수열을 더하고 곱하고 나누면</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif; color: #1f2937; }
  #app { height: 660px; display: flex; flex-direction: column; overflow-y: auto; overflow-x: hidden; }
  button { font: inherit; font-size: 13px; border: 1px solid #d1d5db; background: #fff; color: #374151; border-radius: 8px; padding: 8px 10px; min-height: 40px; cursor: pointer; line-height: 1.1; }
  button:hover { background: #f3f4f6; }
  button.on { background: #2563eb; border-color: #2563eb; color: #fff; }
  #tabs { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px; border-bottom: 1px solid #e5e7eb; background: #f9fafb; flex: none; }
  .panel { display: none; padding: 8px; flex-direction: column; gap: 8px; }
  .panel.show { display: flex; }
  .sub { font-size: 12px; color: #6b7280; }
  /* 카드 서랍 */
  #drawer { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px; border: 1px dashed #d1d5db; border-radius: 10px; background: #f9fafb; }
  .card { display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 74px; min-height: 44px; padding: 3px 6px; border: 1px solid #bfdbfe; background: #fff; border-radius: 8px; font-size: 13px; touch-action: none; user-select: none; -webkit-user-select: none; cursor: grab; }
  .card.div { border-color: #fcd34d; background: #fffbeb; }
  .card svg { display: block; }
  .card.sel { outline: 2px solid #2563eb; }
  /* 기계 */
  #machine { display: flex; align-items: center; justify-content: center; gap: 6px; flex-wrap: wrap; }
  .slot { width: 96px; min-height: 52px; border: 2px dashed #9ca3af; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #9ca3af; background: #fff; touch-action: none; }
  .slot.hot { border-color: #2563eb; background: #eff6ff; }
  .slot .card { min-width: 0; width: 100%; border: 0; background: transparent; }
  #opBtn { min-width: 52px; font-size: 20px; font-weight: 700; color: #7c3aed; border-color: #c4b5fd; }
  #dial { display: none; align-items: center; gap: 4px; }
  #dial span { min-width: 64px; text-align: center; font-weight: 700; color: #7c3aed; }
  /* 예측 판 */
  #pred { padding: 8px 10px; border-radius: 10px; font-size: 13px; line-height: 1.5; border: 1px solid #e5e7eb; background: #f9fafb; color: #4b5563; }
  #pred.ok { background: #ecfdf5; border-color: #6ee7b7; color: #065f46; }
  #pred.no { background: #f3f4f6; border-color: #d1d5db; color: #4b5563; }
  #pred.zero { background: #fff7ed; border-color: #fdba74; color: #9a3412; }
  .cvw { position: relative; height: 200px; min-height: 160px; border: 1px solid #e5e7eb; border-radius: 10px; background: #fdfdfb; touch-action: none; }
  .cvw canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  #status { font-size: 12.5px; color: #4b5563; min-height: 18px; }
  .hint { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 7px 10px; font-size: 12.5px; line-height: 1.5; color: #374151; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
  details { border: 1px solid #e5e7eb; border-radius: 10px; padding: 6px 10px; font-size: 12.5px; }
  summary { cursor: pointer; min-height: 28px; display: flex; align-items: center; font-weight: 600; }
  details ol { margin: 4px 0 4px 16px; padding: 0; line-height: 1.6; }
  .foot { font-size: 11.5px; color: #9ca3af; line-height: 1.5; }
  /* 분해 작업대 */
  #exprs { display: flex; flex-wrap: wrap; gap: 6px; }
  #board { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 6px; padding: 10px 6px; border: 1px solid #e5e7eb; border-radius: 10px; min-height: 96px; font-size: 20px; transition: opacity .25s; }
  #board.fade { opacity: 0; }
  .frac { display: inline-flex; flex-direction: column; align-items: center; }
  .frac .bar { height: 2px; background: #374151; width: 100%; margin: 3px 0; }
  .row { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 3px; }
  .chip { min-width: 40px; min-height: 40px; padding: 4px 8px; border: 1px solid #93c5fd; background: #eff6ff; color: #1e3a8a; border-radius: 999px; font-size: 15px; cursor: pointer; }
  .chip.flip { background: #dcfce7; border-color: #4ade80; color: #166534; }
  .op { font-size: 17px; color: #6b7280; }
  #result { font-size: 14px; font-weight: 600; color: #065f46; min-height: 20px; line-height: 1.5; }
  @media (max-width: 560px) { button { padding: 8px 8px; } }
</style>
</head>
<body>
<div id="app">
  <div id="tabs">
    <button id="t1" class="on">① 조립기</button>
    <button id="t2">② 분해 작업대</button>
    <button id="reset">처음으로</button>
  </div>

  <!-- ① 조립기 -->
  <div id="p1" class="panel show">
    <div class="sub">카드를 끌어 빈칸에 놓거나, 카드를 눌러 빈칸에 넣으세요. 빈칸의 카드를 누르면 빠집니다.</div>
    <div id="drawer"></div>
    <div id="machine">
      <div class="slot" id="slotA" data-slot="A">aₙ</div>
      <button id="opBtn" title="연산 바꾸기">+</button>
      <div class="slot" id="slotB" data-slot="B">bₙ</div>
      <div id="dial"><button id="kMinus">−</button><span id="kVal">k = 2</span><button id="kPlus">+</button></div>
    </div>
    <div id="pred">카드 두 장을 넣어 보세요.</div>
    <div class="cvw" id="cw1"><canvas id="cv1"></canvas></div>
    <div id="status"></div>
  </div>

  <!-- ② 분해 작업대 -->
  <div id="p2" class="panel">
    <div id="exprs"></div>
    <div id="board"></div>
    <button id="divBtn">분모의 최고차항으로 위아래 나누기</button>
    <div id="result"></div>
    <div class="cvw" id="cw2"><canvas id="cv2"></canvas></div>
  </div>

  <div class="panel show" id="common" style="padding-top:0">
    <div class="hint" id="hint"></div>
    <details>
      <summary>질문 보기</summary>
      <ol>
        <li>2 + 1/n 과 3 − 2/n 을 넣고 +, −, ×, ÷ 를 차례로 눌러 보세요. 결과의 극한은 각 극한값 2, 3 으로 어떻게 계산되나요?</li>
        <li>n 카드 두 장으로 n − n 과 n + n 을 만들어 보세요. 또 n × (1/n) 은요? '∞ − ∞', '∞ × 0' 의 값을 하나로 정할 수 없는 까닭을 말해 보세요.</li>
        <li>② 에서 (2n+1)/(n+3) 을 바로 '∞/∞' 로 계산할 수 없는데, 분모의 최고차항 n 으로 나누면 왜 성질을 쓸 수 있게 되나요?</li>
        <li>(n+4)/(n²+1) 과 (3n²−n)/(n²+5) 의 극한을 비교하세요. 분자와 분모의 차수가 극한값에 어떤 영향을 주나요?</li>
      </ol>
    </details>
    <div class="foot">화면은 n=60까지의 유한한 항만 보여 줍니다. 극한값은 일반항과 극한의 성질로 정합니다.</div>
  </div>
</div>
<script>
(function () {
  "use strict";
  var NMAX = 60;
  var $ = function (id) { return document.getElementById(id); };

  // ── 카드 정의: f=일반항, lim=극한값(숫자) 또는 'inf'/'osc' ──────────
  var CARDS = [
    { id: "c1", label: "1/n", f: function (n) { return 1 / n; }, lim: 0 },
    { id: "c2", label: "2 + 1/n", f: function (n) { return 2 + 1 / n; }, lim: 2 },
    { id: "c3", label: "(n+1)/n", f: function (n) { return (n + 1) / n; }, lim: 1 },
    { id: "c4", label: "3 − 2/n", f: function (n) { return 3 - 2 / n; }, lim: 3 },
    { id: "c5", label: "(−1)ⁿ/n", f: function (n) { return (n % 2 ? -1 : 1) / n; }, lim: 0 },
    { id: "c6", label: "n", f: function (n) { return n; }, lim: "inf" },
    { id: "c7", label: "(−1)ⁿ", f: function (n) { return n % 2 ? -1 : 1; }, lim: "osc" }
  ];
  function cardById(id) { for (var i = 0; i < CARDS.length; i++) if (CARDS[i].id === id) return CARDS[i]; return null; }
  function conv(c) { return typeof c.lim === "number"; }

  // ── 분수 계산(예측값을 정확한 유리수로) ───────────────────────────
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a || 1; }
  function frac(p, q) { if (q < 0) { p = -p; q = -q; } var g = gcd(p, q); return { p: p / g, q: q / g }; }
  function fracVal(f) { return f.p / f.q; }
  function fracStr(f) {
    var s = (f.p < 0 ? "−" : "") + Math.abs(f.p) + (f.q === 1 ? "" : "/" + f.q);
    if (f.q !== 1) s += " ≈ " + fmt(fracVal(f));
    return s;
  }
  function fmt(x) {
    if (!isFinite(x)) return "—";
    var s = (Math.round(x * 1000) / 1000).toString();
    return s.replace("-", "−");
  }
  function kStr(k) { return (k < 0 ? "(" + fmt(k) + ")" : fmt(k)); }

  // ── 상태 ─────────────────────────────────────────────────────────
  var slotA = null, slotB = null;      // 카드 id
  var OPS = ["+", "−", "×", "÷", "k"];
  var opIdx = 0, kVal = 2;
  var shown = [];                      // 화면에 보이는 c 값(애니메이션 중간값)
  var anim = null;
  var tab = 1;

  function opSym() { return OPS[opIdx]; }
  function seqOf(card) { var r = []; for (var n = 1; n <= NMAX; n++) r.push(card.f(n)); return r; }
  function calcC() {
    var A = slotA && cardById(slotA), B = slotB && cardById(slotB), r = [], n, a, b, v;
    if (!A) return null;
    if (opSym() !== "k" && !B) return null;
    for (n = 1; n <= NMAX; n++) {
      a = A.f(n); b = B ? B.f(n) : 0; v = NaN;
      switch (opSym()) {
        case "+": v = a + b; break;
        case "−": v = a - b; break;
        case "×": v = a * b; break;
        case "÷": v = Math.abs(b) < 1e-12 ? NaN : a / b; break;
        case "k": v = kVal * a; break;
      }
      r.push(v);
    }
    return r;
  }
  // 예측: {kind:'ok'|'no'|'zero'|'none', text, value}
  function predict() {
    var A = slotA && cardById(slotA), B = slotB && cardById(slotB), op = opSym();
    if (!A || (op !== "k" && !B)) return { kind: "none", text: "카드 두 장을 넣으면 극한의 성질로 예측해 줘요." };
    var NO = { kind: "no", text: "성질을 쓸 수 없어요 — aₙ, bₙ 이 모두 수렴할 때만 쓰는 성질입니다." };
    if (!conv(A) || (op !== "k" && !conv(B))) return NO;
    var al = A.lim, be = B ? B.lim : 0, v, t;
    if (op === "k") {
      v = frac(Math.round(kVal * 2) * al, 2);
      return { kind: "ok", value: fracVal(v), text: "lim aₙ = " + al + " 이므로 lim(k·aₙ) = k·α = " + kStr(kVal) + "·" + al + " = " + fracStr(v) };
    }
    if (op === "÷") {
      if (be === 0) return { kind: "zero", text: "β = 0 이라 몫의 성질을 쓸 수 없어요." };
      v = frac(al, be);
      return { kind: "ok", value: fracVal(v), text: "lim aₙ = " + al + ", lim bₙ = " + be + " 이므로 lim(aₙ ÷ bₙ) = α ÷ β = " + al + " ÷ " + be + " = " + fracStr(v) };
    }
    var r = op === "+" ? al + be : op === "−" ? al - be : al * be;
    return { kind: "ok", value: r, text: "lim aₙ = " + al + ", lim bₙ = " + be + " 이므로 lim(aₙ " + op + " bₙ) = α " + op + " β = " + al + " " + op + " " + (be < 0 ? "(" + be + ")" : be) + " = " + fmt(r) };
  }

  // ── 그리기 공통 ──────────────────────────────────────────────────
  function setup(cv) {
    var r = cv.parentNode.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    var w = Math.max(100, Math.round(r.width)), h = Math.max(80, Math.round(r.height));
    if (cv.width !== w * d || cv.height !== h * d) { cv.width = w * d; cv.height = h * d; }
    var c = cv.getContext("2d"); c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, w, h);
    return { c: c, w: w, h: h };
  }
  function niceTicks(lo, hi) {
    var span = hi - lo, step = Math.pow(10, Math.floor(Math.log10(span / 4)));
    var m = span / 4 / step; step *= m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10;
    var t = [], v = Math.ceil(lo / step) * step;
    for (; v <= hi + 1e-9; v += step) t.push(Math.round(v / step) * step);
    return t;
  }
  // series: [{vals, color, r, alpha}], lines: [{y,color}], 반환 없음
  function drawChart(cv, series, lines, lo, hi) {
    var S = setup(cv), c = S.c, w = S.w, h = S.h;
    var L = 34, R = 8, T = 8, B = 18, pw = w - L - R, ph = h - T - B;
    function X(n) { return L + (n - 1) / (NMAX - 1) * pw; }
    function Y(v) { return T + (hi - v) / (hi - lo) * ph; }
    c.font = "10px sans-serif"; c.fillStyle = "#6b7280"; c.strokeStyle = "#eef0f3"; c.lineWidth = 1;
    niceTicks(lo, hi).forEach(function (t) {
      var y = Y(t); c.beginPath(); c.moveTo(L, y); c.lineTo(w - R, y);
      c.strokeStyle = t === 0 ? "#9ca3af" : "#eef0f3"; c.stroke();
      c.textAlign = "right"; c.textBaseline = "middle"; c.fillText(fmt(t), L - 4, y);
    });
    [1, 10, 20, 30, 40, 50, 60].forEach(function (n) { c.textAlign = "center"; c.textBaseline = "top"; c.fillText(n, X(n), h - B + 3); });
    lines.forEach(function (ln) {
      if (ln.y < lo || ln.y > hi) return;
      c.save(); c.setLineDash([5, 4]); c.strokeStyle = ln.color; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(L, Y(ln.y)); c.lineTo(w - R, Y(ln.y)); c.stroke(); c.restore();
    });
    series.forEach(function (s) {
      c.globalAlpha = s.alpha || 1; c.fillStyle = s.color;
      for (var i = 0; i < s.vals.length; i++) {
        var v = s.vals[i]; if (!isFinite(v)) continue;
        var x = X(i + 1);
        if (v > hi || v < lo) { // 범위 밖은 가장자리 화살표
          var up = v > hi, y0 = up ? T + 1 : T + ph - 1, dy = up ? 5 : -5;
          c.beginPath(); c.moveTo(x, y0); c.lineTo(x - 3, y0 + dy); c.lineTo(x + 3, y0 + dy); c.closePath(); c.fill();
        } else { c.beginPath(); c.arc(x, Y(v), s.r, 0, 6.2832); c.fill(); }
      }
    });
    c.globalAlpha = 1;
  }

  function draw1() {
    var A = slotA && cardById(slotA), B = slotB && cardById(slotB), op = opSym();
    var series = [], lines = [], vals = [], P = predict();
    if (A) { var sa = seqOf(A); series.push({ vals: sa, color: "#93c5fd", r: 2.2 }); vals = vals.concat(sa); }
    if (B && op !== "k") { var sb = seqOf(B); series.push({ vals: sb, color: "#86efac", r: 2.2 }); vals = vals.concat(sb); }
    if (shown.length) { series.push({ vals: shown, color: "#6d28d9", r: 3.4 }); vals = vals.concat(shown); }
    if (P.kind === "ok") { lines.push({ y: P.value, color: "#7c3aed" }); vals.push(P.value); }
    var lo = Infinity, hi = -Infinity;
    vals.forEach(function (v) { if (isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } });
    if (!isFinite(lo)) { lo = -1; hi = 1; }
    var pad = Math.max((hi - lo) * 0.1, 0.25); lo = Math.max(-20, lo - pad); hi = Math.min(20, hi + pad);
    if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
    drawChart($("cv1"), series, lines, lo, hi);
  }

  // ── ① 화면 갱신 ─────────────────────────────────────────────────
  function cardHTML(card) {
    // 작은 점 미리보기(앞 24항)
    var s = '<svg width="64" height="16" viewBox="0 0 64 16">', vals = [], i, lo = -3, hi = 5;
    for (i = 1; i <= 24; i++) vals.push(card.f(i));
    for (i = 0; i < vals.length; i++) {
      var v = Math.max(lo, Math.min(hi, vals[i]));
      s += '<circle cx="' + (2 + i * 2.6).toFixed(1) + '" cy="' + (14 - (v - lo) / (hi - lo) * 12).toFixed(1) + '" r="1.2" fill="' + (conv(card) ? "#2563eb" : "#d97706") + '"/>';
    }
    return '<span>' + card.label + '</span>' + s + '</svg>';
  }
  function buildDrawer() {
    var d = $("drawer"); d.innerHTML = "";
    CARDS.forEach(function (c) {
      var e = document.createElement("div"); e.className = "card" + (conv(c) ? "" : " div"); e.dataset.card = c.id;
      e.innerHTML = cardHTML(c); d.appendChild(e); bindDrag(e, c.id, false);
    });
  }
  function renderSlots() {
    [["A", slotA], ["B", slotB]].forEach(function (p) {
      var el = $("slot" + p[0]); el.innerHTML = "";
      if (p[1]) {
        var c = cardById(p[1]), e = document.createElement("div"); e.className = "card" + (conv(c) ? "" : " div");
        e.innerHTML = cardHTML(c); el.appendChild(e); bindDrag(e, p[1], p[0]);
      } else el.textContent = p[0] === "A" ? "aₙ" : "bₙ";
    });
    var k = opSym() === "k";
    $("slotB").style.display = k ? "none" : "flex";
    $("dial").style.display = k ? "flex" : "none";
    $("kVal").textContent = "k = " + fmt(kVal);
    $("opBtn").textContent = k ? "k배" : opSym();
  }
  function update1(animate) {
    renderSlots();
    var to = calcC();
    if (!to) { shown = []; anim = null; }
    else if (animate && shown.length === to.length) { anim = { from: shown.slice(), to: to, t0: performance.now() }; }
    else { shown = to; anim = null; }
    if (anim) requestAnimationFrame(tick);
    var P = predict(), pr = $("pred");
    pr.className = P.kind === "none" ? "" : P.kind; pr.id = "pred"; pr.textContent = P.text;
    status1(P); hint1(P); draw1();
  }
  function tick(now) {
    if (!anim) return;
    var u = Math.min(1, (now - anim.t0) / 300), e = u * u * (3 - 2 * u), i;
    for (i = 0; i < anim.to.length; i++) {
      var a = anim.from[i], b = anim.to[i];
      shown[i] = (isFinite(a) && isFinite(b)) ? a + (b - a) * e : b;
    }
    draw1();
    if (u < 1) requestAnimationFrame(tick); else { shown = anim.to; anim = null; draw1(); }
  }
  function status1(P) {
    var c = anim ? anim.to : shown, v = c.length ? c[NMAX - 1] : NaN, s = "";
    if (c.length) {
      s = "c₆₀ = " + (isFinite(v) ? (Math.abs(v) >= 1000 ? fmt(v) : v.toFixed(4).replace("-", "−")) : "—");
      s += P.kind === "ok" ? " / 예측 " + fmt(P.value) + " (차 " + (isFinite(v) ? Math.abs(v - P.value).toFixed(4) : "—") + ")" : " / 예측 없음";
    }
    $("status").textContent = s;
  }
  function hint1(P) {
    var A = slotA && cardById(slotA), B = slotB && cardById(slotB), t;
    if (tab !== 1) return;
    if (!A || (opSym() !== "k" && !B)) t = "카드 두 장을 기계의 빈칸에 넣어 보세요. 가운데 단추로 더하기·빼기·곱하기·나누기·실수배를 바꿀 수 있어요.";
    else if (P.kind === "zero") t = "분모가 0으로 가면 몫의 성질을 쓸 수 없어요.";
    else if (P.kind === "no") t = "기계가 예측을 멈췄어요. 그래도 결과 점은 어디로 가는지 직접 보세요. n − n 과 n + n 을 비교해 보세요.";
    else t = "보라색 점들이 점선(예측값)으로 다가가나요? 연산을 바꿔도 그런지 보세요.";
    $("hint").textContent = t;
  }

  // ── 끌기/탭 ──────────────────────────────────────────────────────
  // from: false=서랍 카드, 'A'/'B'=슬롯 카드
  function bindDrag(el, id, from) {
    var sx, sy, ghost = null, moved = false, pid = null;
    el.addEventListener("pointerdown", function (e) {
      sx = e.clientX; sy = e.clientY; moved = false; pid = e.pointerId;
      try { el.setPointerCapture(pid); } catch (x) {}
      e.preventDefault();
    });
    el.addEventListener("pointermove", function (e) {
      if (pid === null) return;
      if (!moved && Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 6) {
        moved = true; ghost = el.cloneNode(true);
        ghost.style.cssText = "position:fixed;z-index:99;pointer-events:none;opacity:.85;background:#fff;border:1px solid #2563eb;width:84px";
        document.body.appendChild(ghost);
      }
      if (ghost) {
        ghost.style.left = (e.clientX - 42) + "px"; ghost.style.top = (e.clientY - 24) + "px";
        var s = slotAt(e.clientX, e.clientY);
        $("slotA").classList.toggle("hot", s === "A"); $("slotB").classList.toggle("hot", s === "B");
      }
    });
    function end(e) {
      if (pid === null) return;
      var wasMoved = moved, s = slotAt(e.clientX, e.clientY);
      pid = null; if (ghost) { ghost.remove(); ghost = null; }
      $("slotA").classList.remove("hot"); $("slotB").classList.remove("hot");
      if (e.type === "pointercancel") return;
      if (!wasMoved) { // 탭
        if (from) place(from, null); else tapInsert(id);
      } else if (s) {
        if (from && from !== s) place(from, null);
        place(s, id);
      } else if (from) place(from, null); // 슬롯 밖으로 끌어내면 비움
    }
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }
  function slotAt(x, y) {
    var els = document.elementsFromPoint(x, y);
    for (var i = 0; i < els.length; i++) {
      var sl = els[i].closest && els[i].closest(".slot");
      if (sl && sl.style.display !== "none") return sl.dataset.slot;
    }
    return null;
  }
  function place(slot, id) { if (slot === "A") slotA = id; else slotB = id; update1(true); }
  function tapInsert(id) {
    if (!slotA) slotA = id;
    else if (!slotB && opSym() !== "k") slotB = id;
    else if (opSym() === "k") slotA = id;
    else slotB = id;
    update1(true);
  }

  $("opBtn").addEventListener("click", function () { opIdx = (opIdx + 1) % OPS.length; update1(true); });
  $("kMinus").addEventListener("click", function () { kVal = Math.max(-3, kVal - 0.5); update1(true); });
  $("kPlus").addEventListener("click", function () { kVal = Math.min(3, kVal + 0.5); update1(true); });

  // ── ② 분해 작업대 ───────────────────────────────────────────────
  // num/den: 나눈 뒤의 조각 [{s:부호, t:글자, lim:극한값}], f: 원래 식
  var EXPRS = [
    { label: "(2n+1)/(n+3)", top: "2n+1", bot: "n+3", f: function (n) { return (2 * n + 1) / (n + 3); }, nf: function (n) { return 2 * n + 1; }, df: function (n) { return n + 3; },
      num: [{ s: "+", t: "2", lim: 2 }, { s: "+", t: "1/n", lim: 0 }], den: [{ s: "+", t: "1", lim: 1 }, { s: "+", t: "3/n", lim: 0 }], ans: 2 },
    { label: "(3n²−n)/(n²+5)", top: "3n²−n", bot: "n²+5", f: function (n) { return (3 * n * n - n) / (n * n + 5); }, nf: function (n) { return 3 * n * n - n; }, df: function (n) { return n * n + 5; },
      num: [{ s: "+", t: "3", lim: 3 }, { s: "−", t: "1/n", lim: 0 }], den: [{ s: "+", t: "1", lim: 1 }, { s: "+", t: "5/n²", lim: 0 }], ans: 3 },
    { label: "(n+4)/(n²+1)", top: "n+4", bot: "n²+1", f: function (n) { return (n + 4) / (n * n + 1); }, nf: function (n) { return n + 4; }, df: function (n) { return n * n + 1; },
      num: [{ s: "+", t: "1/n", lim: 0 }, { s: "+", t: "4/n²", lim: 0 }], den: [{ s: "+", t: "1", lim: 1 }, { s: "+", t: "1/n²", lim: 0 }], ans: 0 }
  ];
  var ei = 0, divided = false, flipped = {};

  function buildExprBtns() {
    var d = $("exprs"); d.innerHTML = "";
    EXPRS.forEach(function (x, i) {
      var b = document.createElement("button"); b.textContent = x.label; if (i === ei) b.className = "on";
      b.addEventListener("click", function () { ei = i; divided = false; flipped = {}; render2(true); });
      d.appendChild(b);
    });
  }
  function allFlipped(x) {
    for (var i = 0; i < x.num.length; i++) if (!flipped["n" + i]) return false;
    for (i = 0; i < x.den.length; i++) if (!flipped["d" + i]) return false;
    return true;
  }
  function side(parts, key) {
    var row = document.createElement("div"); row.className = "row";
    parts.forEach(function (p, i) {
      if (i > 0 || p.s === "−") { var o = document.createElement("span"); o.className = "op"; o.textContent = p.s === "−" ? "−" : "+"; if (i === 0) o.textContent = "−"; row.appendChild(o); }
      var ch = document.createElement("button"), k = key + i, f = !!flipped[k];
      ch.className = "chip" + (f ? " flip" : "");
      ch.textContent = f ? p.t + " → " + p.lim : p.t;
      ch.addEventListener("click", function () { flipped[k] = !flipped[k]; render2(false); });
      row.appendChild(ch);
    });
    return row;
  }
  function limSide(parts, key) {
    var s = "";
    parts.forEach(function (p, i) { s += (i ? " " + p.s + " " : (p.s === "−" ? "−" : "")) + p.lim; });
    return "(" + s + ")";
  }
  function render2(fade) {
    var x = EXPRS[ei], b = $("board"), swap = function () {
      b.innerHTML = "";
      var fr = document.createElement("div"); fr.className = "frac";
      if (!divided) {
        var t = document.createElement("div"); t.textContent = x.top; var bar = document.createElement("div"); bar.className = "bar";
        var d = document.createElement("div"); d.textContent = x.bot; fr.appendChild(t); fr.appendChild(bar); fr.appendChild(d);
        b.appendChild(fr);
      } else {
        fr.appendChild(side(x.num, "n")); var bar2 = document.createElement("div"); bar2.className = "bar"; fr.appendChild(bar2); fr.appendChild(side(x.den, "d"));
        b.appendChild(fr);
      }
      b.classList.remove("fade");
    };
    if (fade) { b.classList.add("fade"); setTimeout(swap, 120); } else swap();
    buildExprBtns();
    $("divBtn").disabled = divided;
    var r = $("result"), done = divided && allFlipped(x);
    r.textContent = done ? "(" + limSide(x.num, "n").slice(1, -1) + ") ÷ (" + limSide(x.den, "d").slice(1, -1) + ") = " + x.ans + "  — 분모의 극한이 1 ≠ 0 이므로 몫의 성질을 쓸 수 있어요." : "";
    r.textContent = done ? limSide(x.num) + " ÷ " + limSide(x.den) + " = " + x.ans + "  (분모의 극한이 1 ≠ 0 이라 몫의 성질을 쓸 수 있어요)" : "";
    if (tab === 2) $("hint").textContent = !divided ? "분자·분모가 둘 다 한없이 커져서 바로 성질을 쓸 수 없어요. 분모의 최고차항으로 위아래를 나눠 보세요."
      : done ? "모두 뒤집었어요. 조립한 값이 점선과 같은 곳인지 보세요." : "이제 조각마다 극한이 있어요. 칩을 눌러 극한값으로 바꿔 보세요.";
    draw2();
  }
  function draw2() {
    var x = EXPRS[ei], vals = [], nv = [], dv = [], n, lo = 0, hi = -Infinity, done = divided && allFlipped(x);
    for (n = 1; n <= NMAX; n++) { var v = x.f(n); vals.push(v); nv.push(x.nf(n)); dv.push(x.df(n)); if (v > hi) hi = v; }
    if (done && x.ans > hi) hi = x.ans;
    hi = Math.max(hi * 1.15, 1); lo = -0.1 * hi;
    var series = [];
    if (!divided) { series.push({ vals: nv, color: "#93c5fd", r: 2, alpha: 0.7 }); series.push({ vals: dv, color: "#86efac", r: 2, alpha: 0.7 }); }
    series.push({ vals: vals, color: "#6d28d9", r: 3 });
    drawChart($("cv2"), series, done ? [{ y: x.ans, color: "#7c3aed" }] : [], lo, hi);
  }
  $("divBtn").addEventListener("click", function () { divided = true; flipped = {}; render2(true); });

  // ── 탭 전환 ──────────────────────────────────────────────────────
  function showTab(t) {
    tab = t;
    $("p1").classList.toggle("show", t === 1); $("p2").classList.toggle("show", t === 2);
    $("t1").className = t === 1 ? "on" : ""; $("t2").className = t === 2 ? "on" : "";
    if (t === 1) update1(false); else render2(false);
  }
  $("t1").addEventListener("click", function () { showTab(1); });
  $("t2").addEventListener("click", function () { showTab(2); });
  $("reset").addEventListener("click", function () {
    slotA = slotB = null; opIdx = 0; kVal = 2; ei = 0; divided = false; flipped = {}; shown = []; anim = null; showTab(1);
  });
  window.addEventListener("resize", function () { if (tab === 1) draw1(); else draw2(); });

  buildDrawer(); showTab(1);
})();
</script>
</body>
</html>
$hands_on$::text),
  true, null
)
on conflict (slug) do update
  set type = excluded.type, config = excluded.config, updated_at = now();

-- 공비 지도 칠하기 — rⁿ은 어디로 갈까  (원본: content/hands-on/calc2-ratio-map.html)
insert into public.manipulatives
  (slug, title, summary, topic, school_level, order_index, type, config, is_published, owner_id)
values (
  'calc2-ratio-map',
  '공비 지도 칠하기 — rⁿ은 어디로 갈까',
  '수직선 위의 공비 r을 손으로 끌어 막대가 r배씩 늘고 줄고 뒤집히는 모습을 보고, 시험한 r마다 수직선에 결과를 칠해 등비수열 rⁿ의 수렴·발산 지도를 직접 완성한다.',
  '미적분Ⅱ · 수열의 극한', 'high', 3, 'html',
  jsonb_build_object('height', 660, 'html', $hands_on$<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>공비 지도 칠하기 — rⁿ은 어디로 갈까</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif; color: #1f2937; }
  #app { height: 660px; display: flex; flex-direction: column; user-select: none; -webkit-user-select: none; overflow: hidden; }
  #bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; background: #f9fafb; }
  button { font: inherit; font-size: 13px; border: 1px solid #d1d5db; background: #fff; color: #374151; border-radius: 8px; padding: 8px 10px; min-height: 36px; cursor: pointer; line-height: 1; white-space: nowrap; }
  button:hover { background: #f3f4f6; }
  button.on { background: #2563eb; border-color: #2563eb; color: #fff; }
  button.warn { border-color: #fca5a5; color: #b91c1c; }
  #formula { margin-left: auto; font-size: 18px; font-weight: 700; color: #1d4ed8; }
  #nl { display: block; width: 100%; height: 84px; touch-action: none; background: #fff; border-bottom: 1px solid #e5e7eb; }
  #stage { position: relative; flex: 1; min-height: 120px; touch-action: none; background: #fdfdfb; }
  #cv { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  #row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 6px 8px; border-top: 1px solid #e5e7eb; background: #f9fafb; }
  #verdict { flex: 1 1 200px; font-size: 14px; line-height: 1.35; }
  #verdict b { color: #1d4ed8; }
  #verdict small { display: block; color: #6b7280; font-size: 12px; }
  #aBox { display: none; align-items: center; gap: 4px; font-size: 13px; }
  #aBox.show { display: flex; }
  #aBox input { width: 90px; touch-action: none; }
  #hint { margin: 6px 8px 0; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 7px 10px; font-size: 13px; line-height: 1.4; }
  details { margin: 6px 8px 0; font-size: 12.5px; }
  summary { cursor: pointer; padding: 4px 0; color: #374151; }
  details ol { margin: 4px 0; padding-left: 20px; line-height: 1.45; }
  #foot { margin: 6px 8px 8px; font-size: 11.5px; color: #6b7280; line-height: 1.4; }
</style>
</head>
<body>
<div id="app">
  <div id="bar">
    <button id="t1" class="on">① rⁿ 지도</button>
    <button id="t2">② 첫째항 바꾸기</button>
    <button id="bClear" class="warn">지도 지우기</button>
    <button id="bReset">처음으로</button>
    <span id="formula"></span>
  </div>
  <canvas id="nl"></canvas>
  <div id="stage"><canvas id="cv"></canvas></div>
  <div id="row">
    <button id="rm" title="r 을 0.01 줄이기">−0.01</button>
    <button id="rp" title="r 을 0.01 늘리기">+0.01</button>
    <div id="verdict"></div>
    <div id="aBox">a <input type="range" id="aIn" min="-6" max="6" step="1" value="2" /> <b id="aVal"></b></div>
    <button id="paint" class="on">이 r 칠하기</button>
  </div>
  <div id="hint"></div>
  <details>
    <summary>질문 보기</summary>
    <ol>
      <li>r = 0.5, −0.5, 0.9, −0.9 를 칠해 보세요. 모두 같은 색인 까닭을 '곱할수록 크기가 어떻게 되는지'로 설명해 보세요.</li>
      <li>r = 1 과 r = −1 은 둘 다 |r| = 1 인데 판정이 다릅니다. 막대 모양을 보고 이유를 말해 보세요.</li>
      <li>지도를 완성해 등비수열 rⁿ 이 수렴하는 r 의 범위를 부등식으로 써 보세요.</li>
      <li>②에서 aₙ = 3·(1/2)ⁿ⁻¹ 과 aₙ = 3·1ⁿ⁻¹ 의 극한값은 각각 얼마인가요? a·rⁿ⁻¹ 이 수렴하는 조건을 a 와 r 로 말해 보세요.</li>
    </ol>
  </details>
  <div id="foot">화면은 n=20까지의 유한한 항만 보여 줍니다. 수렴·발산은 모든 n에 대한 것이므로 판정은 r의 범위로 합니다.</div>
</div>
<script>
(function () {
  // ===== 상태: R = 100·r (정수), A = 첫째항 a (0.5 단위) =====
  var R = 80, A = 1, tab = 1;
  var rec = {};            // 칠한 기록: {R: 색 종류}
  var COL = { zero: '#16a34a', one: '#2563eb', inf: '#dc2626', osc: '#7c3aed' };
  var NAME = { zero: '초록', one: '파랑', inf: '빨강', osc: '보라' };
  var $ = function (id) { return document.getElementById(id); };

  // ===== 판정 (정수 R 로 비교) =====
  function kind(R) {
    if (R > 100) return 'inf';
    if (R === 100) return 'one';
    if (R > -100) return 'zero';
    return 'osc';
  }
  function zone(R) { // 다섯 구간 번호
    if (R < -100) return 0; if (R === -100) return 1; if (R < 100) return 2; if (R === 100) return 3; return 4;
  }
  function fr(R) { return (R / 100).toFixed(2).replace('-0.00', '0.00'); }
  function fa(a) { return (Math.round(a * 10) / 10).toString(); }
  function val(n) { // n 번째 항
    var r = R / 100;
    return tab === 1 ? Math.pow(r, n) : A * Math.pow(r, n - 1);
  }
  function fmt(v, sig) {
    if (!isFinite(v)) return '매우 큼';
    if (v === 0) return '0';
    var ab = Math.abs(v);
    if (ab >= 10000 || ab < 0.001) return v.toExponential(sig - 1).replace('e+', '×10^').replace('e-', '×10^−');
    return String(parseFloat(v.toPrecision(sig)));
  }
  function verdict() {
    var rs = fr(R), r = R / 100, k = kind(R), s, lim = null;
    if (tab === 2 && A === 0) return { text: 'a=0 이므로 모든 항 0 → 0 으로 수렴', lim: 0 };
    var P = tab === 1 ? 'rⁿ' : 'a·rⁿ⁻¹';
    if (k === 'zero') { s = '|r| < 1 → ' + P + ' → 0 으로 수렴'; lim = 0; }
    else if (k === 'one') {
      if (tab === 1) { s = 'r = 1 → 모든 항 1 → 1 로 수렴'; lim = 1; }
      else { s = 'r = 1 이므로 → ' + fa(A) + ' 로 수렴'; lim = A; }
    }
    else if (k === 'inf') {
      if (tab === 1 || A > 0) s = 'r > 1 → 양의 무한대로 발산';
      else s = 'r > 1, a < 0 → 음의 무한대로 발산';
    }
    else s = (R === -100 ? 'r = −1 → −1, 1 을 되풀이하며 진동(발산)' : 'r < −1 → 부호가 바뀌며 절댓값이 커지는 진동(발산)');
    return { text: 'r = ' + rs + ' → ' + s, lim: lim };
  }

  // ===== 화면 크기 맞춤 =====
  var nl = $('nl'), cv = $('cv'), dpr = 1;
  function fit(c) {
    var w = c.clientWidth, h = c.clientHeight;
    dpr = window.devicePixelRatio || 1;
    c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr));
    var g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g: g, w: w, h: h };
  }

  // ===== 공비 수직선 =====
  var PAD = 26;
  function nx(Rv, w) { return PAD + (Rv + 200) / 400 * (w - 2 * PAD); }
  function drawNL() {
    var o = fit(nl), g = o.g, w = o.w, h = o.h, y = 30, i;
    g.clearRect(0, 0, w, h);
    // 구간 색 띠(칠한 점이 드러내는 경계 안내용 옅은 선)
    g.strokeStyle = '#9ca3af'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(nx(-200, w), y); g.lineTo(nx(200, w), y); g.stroke();
    g.font = '11px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#4b5563';
    for (i = -200; i <= 200; i += 50) {
      var big = (i === -100 || i === 0 || i === 100), x = nx(i, w);
      g.lineWidth = big ? 3 : 1; g.strokeStyle = big ? '#374151' : '#9ca3af';
      g.beginPath(); g.moveTo(x, y - (big ? 9 : 5)); g.lineTo(x, y + (big ? 9 : 5)); g.stroke();
      g.fillText(String(i / 100), x, y + 24);
    }
    // 기록 점 (수직선 바로 아래 줄)
    for (var key in rec) {
      var kx = nx(+key, w);
      g.fillStyle = COL[rec[key]]; g.beginPath(); g.arc(kx, y + 40, 4.5, 0, 7); g.fill();
    }
    // 손잡이
    var hx = nx(R, w), hc = COL[kind(R)];
    g.fillStyle = '#fff'; g.strokeStyle = '#2563eb'; g.lineWidth = 3;
    g.beginPath(); g.arc(hx, y, 14, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#2563eb'; g.beginPath(); g.arc(hx, y, 5, 0, 7); g.fill();
    g.fillStyle = hc; g.font = 'bold 12px sans-serif';
    g.fillText('r=' + fr(R), Math.min(w - 30, Math.max(30, hx)), 12);
  }
  function setFromX(px) {
    var w = nl.clientWidth, v = (px - PAD) / (w - 2 * PAD) * 400 - 200;
    v = Math.round(Math.max(-200, Math.min(200, v)));
    var mags = [-200, -100, -50, 0, 50, 100, 200];
    for (var i = 0; i < mags.length; i++) if (Math.abs(v - mags[i]) <= 3) { v = mags[i]; break; }
    R = v; update();
  }
  var dragging = false;
  nl.addEventListener('pointerdown', function (e) {
    dragging = true; try { nl.setPointerCapture(e.pointerId); } catch (x) {}
    setFromX(e.clientX - nl.getBoundingClientRect().left);
  });
  nl.addEventListener('pointermove', function (e) { if (dragging) setFromX(e.clientX - nl.getBoundingClientRect().left); });
  function endDrag() { dragging = false; }
  nl.addEventListener('pointerup', endDrag); nl.addEventListener('pointercancel', endDrag);

  // ===== 막대 무대 =====
  function drawBars() {
    var o = fit(cv), g = o.g, w = o.w, h = o.h, i;
    g.clearRect(0, 0, w, h);
    var L = 30, Rt = w - 8, T = 18, B = h - 16, zy = (T + B) / 2, sc = (B - T) / 2 / 3;
    var cw = (Rt - L) / 20, bw = Math.max(4, cw * 0.55);
    g.font = '10px sans-serif'; g.textAlign = 'center';
    // 기준선·눈금
    g.strokeStyle = '#e5e7eb'; g.lineWidth = 1; g.fillStyle = '#9ca3af'; g.textAlign = 'right';
    for (i = -3; i <= 3; i++) {
      var yy = zy - i * sc;
      g.beginPath(); g.moveTo(L, yy); g.lineTo(Rt, yy); g.stroke();
      g.fillText(String(i), L - 4, yy + 3);
    }
    g.strokeStyle = '#374151'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(L, zy); g.lineTo(Rt, zy); g.stroke();
    // 극한값 점선
    var vd = verdict();
    if (vd.lim !== null && Math.abs(vd.lim) <= 3) {
      var ly = zy - vd.lim * sc;
      g.setLineDash([6, 4]); g.strokeStyle = '#16a34a'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(L, ly); g.lineTo(Rt, ly); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#16a34a'; g.textAlign = 'left'; g.font = '11px sans-serif';
      g.fillText('극한값 ' + fmt(vd.lim, 3), L + 4, ly - 4);
    }
    g.font = '10px sans-serif';
    for (i = 1; i <= 20; i++) {
      var v = val(i), cx = L + (i - 0.5) * cw, hh = v * sc, clip = false;
      if (Math.abs(v) > 3) { hh = (v > 0 ? 3 : -3) * sc; clip = true; }
      g.fillStyle = v >= 0 ? '#3b82f6' : '#f97316';
      g.fillRect(cx - bw / 2, hh >= 0 ? zy - hh : zy, bw, Math.abs(hh));
      if (clip) { // 잘린 막대: 화살표와 실제 값
        g.fillStyle = '#111827'; g.textAlign = 'center';
        var ty = v > 0 ? T - 2 : B + 10;
        g.beginPath();
        if (v > 0) { g.moveTo(cx - 3, T + 5); g.lineTo(cx + 3, T + 5); g.lineTo(cx, T); }
        else { g.moveTo(cx - 3, B - 5); g.lineTo(cx + 3, B - 5); g.lineTo(cx, B); }
        g.fill();
        if (cw > 15 || i % 2 === 0) { g.font = '9px sans-serif'; g.fillText(fmt(v, 2), cx, ty + (v > 0 ? 0 : 2)); g.font = '10px sans-serif'; }
      }
      g.fillStyle = '#6b7280'; g.textAlign = 'center';
      if (cw > 14 || i % 5 === 0 || i === 1) g.fillText(String(i), cx, h - 3);
    }
    // 앞 5개: ×r 표시
    g.strokeStyle = '#6b7280'; g.fillStyle = '#374151'; g.lineWidth = 1.2; g.font = '10px sans-serif';
    for (i = 1; i <= 5; i++) {
      var x1 = L + (i - 0.5) * cw, x2 = x1 + cw, ay = T + 6 + (i % 2) * 10;
      g.beginPath(); g.moveTo(x1, ay + 6); g.quadraticCurveTo((x1 + x2) / 2, ay - 8, x2, ay + 6); g.stroke();
      if (cw > 20 || i % 2 === 1) g.fillText('×r', (x1 + x2) / 2, ay - 1);
    }
  }

  // ===== 글·힌트 갱신 =====
  function hintText() {
    var cats = {}, n = 0, k;
    for (k in rec) { n++; cats[zone(+k)] = 1; }
    var nc = Object.keys(cats).length;
    if (n >= 8 && nc >= 4) return '지도의 색이 바뀌는 경계는 어디인가요? r = 1 과 r = −1 에서는 각각 어떤 색인가요? (경계는 어디인가요?)';
    if ((R >= 95 && R <= 99) || (R >= 101 && R <= 105) || (R <= -95 && R >= -99) || (R <= -101 && R >= -105))
      return '1에 아주 가까우면 20번 곱해도 변화가 작아 보여요. 화면이 짧을 뿐, n이 더 커지면 어떻게 될지 생각해 보세요.';
    if (tab === 2) return '이번엔 첫째항 a를 바꿔 보세요. 극한값은 a와 r 중 무엇에 따라 달라지나요?';
    if (R < 0 && R > -100) return '음수를 곱하면 막대가 위아래로 뒤집혀요. 뒤집히면서 줄어드나요, 커지나요?';
    if (R > 0 && R < 100) return '곱할수록 막대가 줄어들어요. 어디까지 줄어들까요?';
    return '공비 r을 끌어 보세요. 막대 하나하나가 앞 막대에 r을 곱한 것이에요.';
  }
  function update() {
    var rs = fr(R);
    $('formula').textContent = tab === 1 ? 'aₙ = (' + rs + ')ⁿ' : 'aₙ = ' + fa(A) + '·(' + rs + ')ⁿ⁻¹';
    var vd = verdict();
    $('verdict').innerHTML = '<b>' + vd.text + '</b><small>a₂₀ = ' + fmt(val(20), 4) + '</small>';
    $('hint').textContent = hintText();
    $('aVal').textContent = fa(A);
    drawNL(); drawBars();
  }

  // ===== 버튼 =====
  function setTab(t) {
    tab = t; $('t1').className = t === 1 ? 'on' : ''; $('t2').className = t === 2 ? 'on' : '';
    $('aBox').className = t === 2 ? 'show' : ''; update();
  }
  $('t1').onclick = function () { setTab(1); };
  $('t2').onclick = function () { setTab(2); };
  $('rm').onclick = function () { R = Math.max(-200, R - 1); update(); };
  $('rp').onclick = function () { R = Math.min(200, R + 1); update(); };
  $('paint').onclick = function () { rec[R] = kind(R); update(); };
  $('bClear').onclick = function () { rec = {}; update(); };
  $('bReset').onclick = function () { R = 50; A = 1; $('aIn').value = 2; setTab(1); };
  $('aIn').oninput = function () { A = (+this.value) / 2; update(); };
  window.addEventListener('resize', update);
  update();
})();
</script>
</body>
</html>
$hands_on$::text),
  true, null
)
on conflict (slug) do update
  set type = excluded.type, config = excluded.config, updated_at = now();

-- 막대 이어 붙이기 — 무한히 더하면 어디까지 갈까  (원본: content/hands-on/calc2-series-stacking.html)
insert into public.manipulatives
  (slug, title, summary, topic, school_level, order_index, type, config, is_published, owner_id)
values (
  'calc2-series-stacking',
  '막대 이어 붙이기 — 무한히 더하면 어디까지 갈까',
  '항 aₙ을 길이 막대로 하나씩 자 위에 이어 붙이며 부분합 Sₙ 깃발이 어디로 가는지 보고, 급수의 수렴·발산이 ''항''이 아니라 ''부분합 수열''로 정해진다는 것과 "aₙ→0 이어도 발산할 수 있다"를 직접 확인한다.',
  '미적분Ⅱ · 수열의 극한', 'high', 4, 'html',
  jsonb_build_object('height', 660, 'html', $hands_on$<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>막대 이어 붙이기 — 급수의 수렴과 발산</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif; color: #1f2937; }
  #app { height: 660px; display: flex; flex-direction: column; user-select: none; -webkit-user-select: none; overflow: hidden; }
  #bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; background: #f9fafb; }
  #sers { display: flex; flex-wrap: wrap; gap: 4px; }
  button { font: inherit; font-size: 13px; border: 1px solid #d1d5db; background: #fff; color: #374151; border-radius: 8px; padding: 6px 9px; cursor: pointer; line-height: 1; white-space: nowrap; min-height: 40px; }
  button:hover { background: #f3f4f6; }
  button.on { background: #2563eb; border-color: #2563eb; color: #fff; }
  button:disabled { opacity: .4; cursor: default; }
  #cur { flex: 1 1 200px; font-size: 15px; font-weight: 600; color: #111827; min-width: 0; }
  #status { padding: 4px 10px; font-size: 12.5px; color: #374151; background: #fff; border-bottom: 1px solid #f1f5f9; line-height: 1.5; min-height: 26px; }
  #status .gray { color: #6b7280; }
  #stage { position: relative; flex: 1; min-height: 150px; overflow: hidden; touch-action: none; background: #fdfdfb; }
  #cv { position: absolute; inset: 0; display: block; touch-action: none; }
  #ctl { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 8px; border-top: 1px solid #e5e7eb; background: #f9fafb; align-items: center; }
  #ctl button.sm { font-size: 12px; min-height: 40px; }
  #hint { margin: 6px 8px 0; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 7px 10px; font-size: 12.5px; line-height: 1.5; color: #374151; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
  details { margin: 4px 8px 0; font-size: 12.5px; color: #374151; }
  summary { cursor: pointer; padding: 6px 2px; min-height: 32px; color: #2563eb; }
  details ol { margin: 2px 0 6px; padding-left: 20px; line-height: 1.5; }
  #foot { margin: 4px 10px 6px; font-size: 11.5px; color: #6b7280; line-height: 1.45; }
  @media (max-width: 560px) { button { padding: 6px 7px; min-height: 38px; } #bar, #ctl { padding: 4px 6px; gap: 4px; } #hint { padding: 5px 8px; } #foot { margin: 2px 10px 4px; } }
</style>
</head>
<body>
<div id="app">
  <div id="bar">
    <div id="sers"></div>
    <button id="bReset" title="처음으로">처음으로</button>
    <div id="cur"></div>
  </div>
  <div id="status"></div>
  <div id="stage"><canvas id="cv"></canvas></div>
  <div id="ctl">
    <button id="b1">+1 항</button>
    <button id="b10">+10 항</button>
    <button id="b50">끝까지(50항)</button>
    <button id="bUndo">하나 빼기</button>
    <button id="bFar" class="sm" style="display:none">더 멀리 보기</button>
    <button id="bAns" class="sm" style="display:none">답 보기</button>
  </div>
  <div id="hint"></div>
  <details>
    <summary>질문 보기</summary>
    <ol>
      <li>① 과 ② 는 막대 모양이 다른데 깃발은 둘 다 1에 다가갑니다. 급수의 합은 무엇의 극한인가요?</li>
      <li>③ 의 항 그래프와 부분합 그래프를 비교해 보세요. 항이 0으로 가는데도 급수가 발산할 수 있나요?</li>
      <li>④ 와 ⑤ 는 항이 0으로 다가가지 않습니다. 이런 급수가 수렴할 수 없는 까닭을 깃발의 움직임으로 설명해 보세요.</li>
      <li>여섯 급수를 '수렴(합)'과 '발산'으로 나누어 보세요. 'aₙ 이 0으로 가는지'만으로 판정이 끝나는 것은 어느 쪽인가요?</li>
    </ol>
  </details>
  <div id="foot">화면은 50번째 부분합까지만 보여 줍니다. 급수의 합은 n→∞ 일 때 Sₙ 의 극한이므로, 판정은 Sₙ 의 일반항이나 성질로 합니다.</div>
</div>
<script>
(function () {
  "use strict";
  var NMAX = 50;
  var cv = document.getElementById("cv"), ctx = cv.getContext("2d");
  var stage = document.getElementById("stage");
  var W = 0, H = 0, DPR = 1;

  // ── 급수 정의: 항, 범위(자 / 항 그래프 / 부분합 그래프), 답, 끝까지 후 힌트 ──
  var SERIES = [
    { name: "① Σ 1/2ⁿ", show: "Σ 1/2ⁿ = 1/2 + 1/4 + 1/8 + …", a: function (n) { return 1 / Math.pow(2, n); }, ruler: [0, 1.5], tr: [0, 0.6], sr: [0, 1.5], ans: "이 급수의 합: 1", end: "깃발이 목표선에 한없이 가까워지나요? 그렇다면 그 값이 급수의 합이에요." },
    { name: "② Σ 1/(n(n+1))", show: "Σ 1/(n(n+1)) = 1/2 + 1/6 + 1/12 + …", a: function (n) { return 1 / (n * (n + 1)); }, ruler: [0, 1.5], tr: [0, 0.6], sr: [0, 1.5], ans: "이 급수의 합: 1", end: "깃발이 목표선에 한없이 가까워지나요? 그렇다면 그 값이 급수의 합이에요." },
    { name: "③ Σ 1/n", show: "Σ 1/n = 1 + 1/2 + 1/3 + …", a: function (n) { return 1 / n; }, ruler: [0, 6], tr: [0, 1.1], sr: [0, 6], ans: "발산", end: "막대는 점점 짧아져 0에 가까워지는데, 깃발은 멈췄나요? [더 멀리 보기]로 확인해 보세요." },
    { name: "④ Σ (−1)ⁿ⁻¹", show: "Σ (−1)ⁿ⁻¹ = 1 − 1 + 1 − 1 + …", a: function (n) { return n % 2 === 1 ? 1 : -1; }, ruler: [-0.5, 1.5], tr: [-1.5, 1.5], sr: [-0.5, 1.5], ans: "발산", end: "깃발이 왔다 갔다 해요. Sₙ 이 한 값에 다가가지 않으면 급수는 어떻게 될까요?" },
    { name: "⑤ Σ n/(n+1)", show: "Σ n/(n+1) = 1/2 + 2/3 + 3/4 + …", a: function (n) { return n / (n + 1); }, ruler: [0, 50], tr: [0, 1.1], sr: [0, 50], ans: "발산", end: "막대 길이가 1에 가까워져요. 거의 1씩 계속 더하면 깃발은 어디로 갈까요?" },
    { name: "⑥ Σ (2/3)ⁿ⁻¹", show: "Σ (2/3)ⁿ⁻¹ = 1 + 2/3 + 4/9 + …", a: function (n) { return Math.pow(2 / 3, n - 1); }, ruler: [0, 3.5], tr: [0, 1.1], sr: [0, 3.5], ans: "이 급수의 합: 3", end: "깃발이 목표선에 한없이 가까워지나요? 그렇다면 그 값이 급수의 합이에요." }
  ];

  // ── 상태 ──
  var si = 0;            // 현재 급수
  var n = 0;             // 붙인 항 수(애니메이션 중인 것 제외)
  var A = [0], Sn = [0]; // A[k]=a_k, Sn[k]=S_k
  var target = 0;        // 목표선 값 S
  var anim = null;       // {t0, dur} 진행 중인 막대
  var pending = 0, pendDur = 0.25;
  var showAns = false, far = null;
  var drag = null;       // {kind:'target'|'bar', x, y}

  // ── 도우미 ──
  var SUB = "₀₁₂₃₄₅₆₇₈₉";
  function sub(k) { return String(k).split("").map(function (c) { return SUB[+c]; }).join(""); }
  function fmt(x) {
    if (!isFinite(x)) return "—";
    // 아주 작은 값은 0 으로 오해하지 않게 지수 표기(위첨자)
    if (x !== 0 && Math.abs(x) < 0.00005) {
      var e = Math.floor(Math.log(Math.abs(x)) / Math.LN10), m = x / Math.pow(10, e);
      if (Math.abs(Math.round(m * 10) / 10) >= 10) { m /= 10; e++; }
      var SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
      var es = String(Math.abs(e)).split("").map(function (c) { return SUP[+c]; }).join("");
      return (Math.round(m * 10) / 10) + "×10" + (e < 0 ? "⁻" : "") + es;
    }
    var s = (Math.round(x * 10000) / 10000).toFixed(4);
    s = s.replace(/0+$/, "").replace(/\.$/, "");
    return s === "-0" ? "0" : s;
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function cur() { return SERIES[si]; }

  // ── 레이아웃(캔버스 안) ──
  function layout() {
    var rh = W >= 520 ? Math.max(104, Math.round(H * 0.38)) : Math.max(96, Math.round(H * 0.30)); // 좁은 화면은 자를 낮춰 그래프 확보
    var L = { ruler: { x: 14, y: 0, w: W - 28, h: rh } };
    var gy = rh + 4, gh = H - gy - 2;
    if (W >= 520) {
      var gw = (W - 30) / 2;
      L.g1 = { x: 10, y: gy, w: gw, h: gh };
      L.g2 = { x: 20 + gw, y: gy, w: gw, h: gh };
    } else {
      var hh = gh / 2;
      L.g1 = { x: 6, y: gy, w: W - 12, h: hh };
      L.g2 = { x: 6, y: gy + hh, w: W - 12, h: hh };
    }
    L.axisY = rh - 20;
    L.next = { x: 8, y: 4, w: 92, h: 36 };
    return L;
  }
  function rx(L, v) { var r = cur().ruler; return L.ruler.x + (v - r[0]) / (r[1] - r[0]) * L.ruler.w; }
  function rinv(L, px) { var r = cur().ruler; return r[0] + (px - L.ruler.x) / L.ruler.w * (r[1] - r[0]); }

  // ── 조작 ──
  function reset(newSeries) {
    if (newSeries !== undefined) si = newSeries;
    n = 0; A = [0]; Sn = [0]; anim = null; pending = 0; showAns = false; far = null;
    var r = cur().ruler; target = (r[0] + r[1]) / 2;
    refreshUI(); draw();
  }
  function addTerm(dur) {
    if (n >= NMAX || anim) return false;
    var k = n + 1;
    A[k] = cur().a(k); Sn[k] = Sn[k - 1] + A[k];
    anim = { t0: performance.now(), dur: dur * 1000 };
    loop();
    return true;
  }
  function finishAnim() { anim = null; n++; refreshUI(); }
  function queue(c, dur) { pending = c; pendDur = dur; loop(); }
  function removeOne() {
    pending = 0;
    if (anim) { anim = null; A.length = n + 1; Sn.length = n + 1; }
    else if (n > 0) { n--; A.length = n + 1; Sn.length = n + 1; }
    far = null; showAns = false;
    refreshUI(); draw();
  }
  var running = false;
  function loop() {
    if (running) return; running = true;
    (function f() {
      var now = performance.now();
      if (anim && now - anim.t0 >= anim.dur) finishAnim();
      if (!anim && pending > 0 && n < NMAX) { pending--; addTerm(pendDur); }
      else if (!anim) pending = 0;
      draw();
      if (anim || pending > 0) requestAnimationFrame(f); else running = false;
    })();
  }

  // ── 화면 갱신(HTML 부분) ──
  function sers() {
    var box = document.getElementById("sers");
    box.innerHTML = "";
    SERIES.forEach(function (s, i) {
      var b = document.createElement("button");
      b.textContent = s.name.charAt(0);
      b.title = s.name;
      b.setAttribute("aria-label", s.name);
      b.style.minWidth = "40px";
      b.className = i === si ? "on" : "";
      b.addEventListener("click", function () { reset(i); });
      box.appendChild(b);
    });
  }
  function hintText() {
    if (n === 0) return "[+1 항]을 눌러 막대를 하나씩 이어 붙여 보세요. 빨간 깃발이 지금까지의 합 Sₙ 이에요.";
    if (n >= NMAX) {
      if (si === 2 && far) return "S₁₀₀, S₁₀₀₀, S₁₀₀₀₀ 을 보세요. 항이 0에 가까워져도 부분합 Sₙ 은 커지기만 하나요?";
      return cur().end;
    }
    if (si === 3 && n >= 3) return cur().end;
    if (si === 4 && n >= 3) return cur().end;
    return "초록 목표선을 깃발이 다가가는 것 같은 곳으로 끌어 놓아 보세요.";
  }
  function refreshUI() {
    sers();
    document.getElementById("cur").textContent = cur().show;
    var done = n >= NMAX;
    document.getElementById("bFar").style.display = (si === 2 && done) ? "" : "none";
    document.getElementById("bAns").style.display = done ? "" : "none";
    document.getElementById("hint").textContent = hintText();
    var st;
    if (n === 0) st = "n = 0 · S₀ = 0 · |S − S₀| = " + fmt(Math.abs(target));
    else st = "n = " + n + " · a" + sub(n) + " = " + fmt(A[n]) + " · S" + sub(n) + " = " + fmt(Sn[n]) + " · |S − S" + sub(n) + "| = " + fmt(Math.abs(target - Sn[n]));
    if (far) st += "<br>S₁₀₀ = " + far[0] + " · S₁₀₀₀ = " + far[1] + " · S₁₀₀₀₀ = " + far[2];
    if (showAns) st += '<br><span class="gray">' + cur().ans + "</span>";
    document.getElementById("status").innerHTML = st;
  }

  // ── 그리기 ──
  function txt(s, x, y, color, size, align) {
    ctx.fillStyle = color || "#374151"; ctx.font = (size || 11) + "px sans-serif";
    ctx.textAlign = align || "left"; ctx.textBaseline = "middle"; ctx.fillText(s, x, y);
  }
  function graph(R, title, yr, getY, color, hline) {
    ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1; ctx.fillStyle = "#fff";
    var gx = R.x + 34, gy = R.y + 20, gw = R.w - 42, gh = R.h - 38;
    if (gh < 20) return;
    ctx.fillRect(R.x, R.y, R.w, R.h); ctx.strokeRect(R.x + .5, R.y + .5, R.w - 1, R.h - 1);
    txt(title, R.x + 8, R.y + 10, "#374151", 11.5);
    function Y(v) { return gy + gh - (clamp(v, yr[0], yr[1]) - yr[0]) / (yr[1] - yr[0]) * gh; }
    function X(k) { return gx + (k - 1) / (NMAX - 1) * gw; }
    // 눈금
    [yr[0], (yr[0] + yr[1]) / 2, yr[1]].forEach(function (v) {
      ctx.strokeStyle = "#f1f5f9"; ctx.beginPath(); ctx.moveTo(gx, Y(v)); ctx.lineTo(gx + gw, Y(v)); ctx.stroke();
      txt(fmt(v), gx - 4, Y(v), "#6b7280", 10, "right");
    });
    [1, 10, 20, 30, 40, 50].forEach(function (k) { txt(String(k), X(k), gy + gh + 8, "#6b7280", 10, "center"); });
    if (yr[0] < 0 && yr[1] > 0) { ctx.strokeStyle = "#9ca3af"; ctx.beginPath(); ctx.moveTo(gx, Y(0)); ctx.lineTo(gx + gw, Y(0)); ctx.stroke(); }
    if (hline !== null) {
      ctx.strokeStyle = "#16a34a"; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(gx, Y(hline)); ctx.lineTo(gx + gw, Y(hline)); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.fillStyle = color;
    for (var k = 1; k <= n; k++) { ctx.beginPath(); ctx.arc(X(k), Y(getY(k)), 2.8, 0, 6.2832); ctx.fill(); }
  }
  function draw() {
    if (!W) return;
    var L = layout(), s = cur();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var ay = L.axisY, R = L.ruler;
    // 자: 눈금
    ctx.fillStyle = "#f8fafc"; ctx.fillRect(R.x - 4, ay - 44, R.w + 8, 50);
    ctx.strokeStyle = "#6b7280"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(R.x, ay); ctx.lineTo(R.x + R.w, ay); ctx.stroke();
    var span = s.ruler[1] - s.ruler[0], step = span > 20 ? 10 : (span > 4 ? 1 : 0.5);
    for (var v = Math.ceil(s.ruler[0] / step) * step; v <= s.ruler[1] + 1e-9; v += step) {
      var x = rx(L, v); ctx.beginPath(); ctx.moveTo(x, ay); ctx.lineTo(x, ay + 5); ctx.stroke();
      txt(fmt(v), x, ay + 13, "#6b7280", 10, "center");
    }
    // 막대
    var shown = n + (anim ? 1 : 0), p = 1;
    if (anim) p = clamp((performance.now() - anim.t0) / anim.dur, 0, 1);
    for (var k = 1; k <= shown; k++) {
      var from = Sn[k - 1], a = A[k], q = (anim && k === shown) ? p : 1;
      var to = from + a * q;
      var row = a < 0 ? 1 : 0, by = ay - 34 + row * 16;
      var x0 = rx(L, Math.min(from, to)), x1 = rx(L, Math.max(from, to));
      x0 = clamp(x0, R.x - 2, R.x + R.w + 2); x1 = clamp(x1, R.x - 2, R.x + R.w + 2);
      ctx.fillStyle = k % 2 ? "#60a5fa" : "#f59e0b";
      ctx.fillRect(x0, by, Math.max(x1 - x0, 1), 14);
      if (k <= 8 && x1 - x0 > 16 && q === 1) txt("a" + sub(k), (x0 + x1) / 2, by + 7, "#fff", 9.5, "center");
    }
    // 목표선
    var tx = rx(L, clamp(target, s.ruler[0], s.ruler[1]));
    ctx.strokeStyle = "#16a34a"; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(tx, 44); ctx.lineTo(tx, ay + 4); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#16a34a"; ctx.beginPath(); ctx.arc(tx, 44, 9, 0, 6.2832); ctx.fill();
    // 라벨은 원 위쪽(점선·막대와 겹치지 않는 곳)
    txt("S=" + fmt(target), clamp(tx, 28, W - 28), 28, "#16a34a", 10.5, "center");
    // 깃발
    var fS = n === 0 && !anim ? 0 : (anim ? Sn[n] + A[n + 1] * p : Sn[n]);
    var fx = rx(L, fS), off = fx > R.x + R.w + 1 || fx < R.x - 1;
    fx = clamp(fx, R.x + 4, R.x + R.w - 4);
    ctx.strokeStyle = "#dc2626"; ctx.fillStyle = "#dc2626"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(fx, ay + 3); ctx.lineTo(fx, ay - 44); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fx, ay - 44); ctx.lineTo(fx + (off ? -1 : 1) * 13, ay - 39); ctx.lineTo(fx, ay - 34); ctx.fill();
    txt("S" + sub(n) + (off ? "=" + fmt(fS) + " →" : ""), clamp(fx + 16, 20, W - 50), ay - 50, "#dc2626", 10.5, "left");
    // 다음 막대 손잡이
    var N = L.next;
    if (n < NMAX && !anim) {
      var dx = drag && drag.kind === "bar" ? drag.x - 20 : N.x, dy = drag && drag.kind === "bar" ? drag.y - 18 : N.y;
      ctx.fillStyle = (n + 1) % 2 ? "#60a5fa" : "#f59e0b"; ctx.globalAlpha = .9;
      ctx.fillRect(dx, dy, N.w, N.h); ctx.globalAlpha = 1;
      txt("다음 막대 a" + sub(n + 1), dx + N.w / 2, dy + N.h / 2, "#fff", 11, "center");
    }
    ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, R.h + 1.5); ctx.lineTo(W, R.h + 1.5); ctx.stroke();
    // 그래프
    graph(L.g1, "항 aₙ  (n, aₙ)", s.tr, function (k) { return A[k]; }, "#2563eb", null);
    graph(L.g2, "부분합 Sₙ  (n, Sₙ)", s.sr, function (k) { return Sn[k]; }, "#dc2626", target);
  }

  // ── 포인터 ──
  function pos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function magnet(v) {
    var r = cur().ruler, tol = (r[1] - r[0]) * 0.01, best = v;
    [0, 1, 2, 3, 0.5].forEach(function (m) { if (m >= r[0] && m <= r[1] && Math.abs(v - m) <= tol) best = m; });
    return best;
  }
  cv.addEventListener("pointerdown", function (e) {
    var P = pos(e), L = layout(), N = L.next;
    if (n < NMAX && !anim && P.x >= N.x - 4 && P.x <= N.x + N.w + 4 && P.y >= N.y - 4 && P.y <= N.y + N.h + 4) {
      drag = { kind: "bar", x: P.x, y: P.y };
    } else if (P.y < L.ruler.h && Math.abs(P.x - rx(L, clamp(target, cur().ruler[0], cur().ruler[1]))) <= 24) {
      drag = { kind: "target", x: P.x, y: P.y };
    } else return;
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault(); draw();
  });
  cv.addEventListener("pointermove", function (e) {
    if (!drag) return;
    var P = pos(e), L = layout(); drag.x = P.x; drag.y = P.y;
    if (drag.kind === "target") {
      var r = cur().ruler;
      target = magnet(clamp(rinv(L, P.x), r[0], r[1]));
      refreshUI();
    }
    draw();
  });
  function up(e) {
    if (!drag) return;
    var L = layout(), d = drag; drag = null;
    if (d.kind === "bar") {
      var fx = rx(L, clamp(Sn[n], cur().ruler[0], cur().ruler[1]));
      if (Math.abs(d.x - fx) < 50 && d.y > L.ruler.h * 0.3) addTerm(0.25);
    }
    draw();
  }
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", up);

  // ── 단추 ──
  document.getElementById("b1").addEventListener("click", function () { if (!anim) addTerm(0.25); });
  document.getElementById("b10").addEventListener("click", function () { if (!anim && pending === 0) queue(10, 0.05); });
  document.getElementById("b50").addEventListener("click", function () { if (!anim && pending === 0) queue(NMAX - n, 0.05); });
  document.getElementById("bUndo").addEventListener("click", removeOne);
  document.getElementById("bReset").addEventListener("click", function () { reset(si); });
  document.getElementById("bFar").addEventListener("click", function () {
    var s = 0, o = [];
    for (var k = 1; k <= 10000; k++) { s += 1 / k; if (k === 100 || k === 1000 || k === 10000) o.push(s.toFixed(3)); }
    far = o; refreshUI();
  });
  document.getElementById("bAns").addEventListener("click", function () { showAns = true; refreshUI(); });

  // ── 크기 ──
  function resize() {
    var r = stage.getBoundingClientRect();
    W = Math.floor(r.width); H = Math.floor(r.height); DPR = window.devicePixelRatio || 1;
    cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + "px"; cv.style.height = H + "px";
    draw();
  }
  window.addEventListener("resize", resize);
  // 상태 줄 수가 바뀌면 무대 높이도 바뀌므로 캔버스를 다시 맞춘다
  if (window.ResizeObserver) new ResizeObserver(function () { var r = stage.getBoundingClientRect(); if (Math.floor(r.width) !== W || Math.floor(r.height) !== H) resize(); }).observe(stage);
  reset(0);
  resize();
  setTimeout(resize, 50);
})();
</script>
</body>
</html>
$hands_on$::text),
  true, null
)
on conflict (slug) do update
  set type = excluded.type, config = excluded.config, updated_at = now();

-- 닮은 꼴 접어 넣기 — 전체 안에 전체가 들어 있다  (원본: content/hands-on/calc2-geometric-self-similar.html)
insert into public.manipulatives
  (slug, title, summary, topic, school_level, order_index, type, config, is_published, owner_id)
values (
  'calc2-geometric-self-similar',
  '닮은 꼴 접어 넣기 — 전체 안에 전체가 들어 있다',
  '첫 조각 a 옆에 ''전체 그림을 r배로 줄인 복사본''을 끌어다 끼워 넣으며, 등비급수의 합 S가 S = a + rS 를 만족한다는 것을 눈으로 확인하고 S = a/(1−r) 를 이끌어 낸 뒤 순환소수·튀는 공 문제에 활용한다.',
  '미적분Ⅱ · 수열의 극한', 'high', 5, 'html',
  jsonb_build_object('height', 660, 'html', $hands_on$<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>닮은 꼴 접어 넣기 — 등비급수의 합</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif; color: #1f2937; font-size: 14px; }
  #app { padding-bottom: 10px; }
  button { font: inherit; font-size: 13px; border: 1px solid #d1d5db; background: #fff; color: #374151; border-radius: 8px; padding: 8px 10px; min-height: 44px; cursor: pointer; line-height: 1.1; }
  button:hover { background: #f3f4f6; }
  button.on { background: #2563eb; border-color: #2563eb; color: #fff; }
  button:disabled { opacity: .4; cursor: default; }
  button.warn { border-color: #fca5a5; color: #b91c1c; }
  #top { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px; border-bottom: 1px solid #e5e7eb; background: #f9fafb; }
  #eq { flex: 1 1 220px; font-size: 13px; color: #374151; text-align: right; min-width: 0; overflow-wrap: anywhere; }
  .row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; padding: 8px; border-bottom: 1px solid #f1f5f9; }
  .row label { font-size: 13px; color: #4b5563; }
  input[type=number] { width: 74px; min-height: 44px; font: inherit; font-size: 14px; padding: 4px 6px; border: 1px solid #d1d5db; border-radius: 8px; }
  input[type=range] { width: 150px; min-height: 44px; accent-color: #2563eb; }
  .ctl { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  #dial { width: 180px; height: 96px; touch-action: none; cursor: pointer; }
  #stage { position: relative; height: 290px; touch-action: none; background: #fdfdfb; border-bottom: 1px solid #e5e7eb; }
  #cv { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
  #acts { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px; }
  #info { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 8px; }
  .box { flex: 1 1 280px; min-width: 0; border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px 10px; background: #fff; font-size: 13px; line-height: 1.5; }
  #hint { background: #f8fafc; }
  #stat div { display: flex; justify-content: space-between; gap: 8px; }
  #stat b { font-variant-numeric: tabular-nums; text-align: right; overflow-wrap: anywhere; }
  .ok { color: #15803d; }
  #warn { color: #b91c1c; font-weight: 600; margin: 6px 8px 0; font-size: 13px; }
  #fpanel { margin: 8px; border: 1px solid #c7d2fe; background: #eef2ff; border-radius: 10px; padding: 8px 10px; font-size: 14px; }
  #fpanel .blank { display: inline-block; min-width: 40px; text-align: center; border-bottom: 2px solid #2563eb; padding: 0 4px; font-weight: 700; color: #1d4ed8; }
  #fpanel p { margin: 6px 0; }
  details { margin: 8px; border: 1px solid #e5e7eb; border-radius: 10px; padding: 6px 10px; }
  summary { cursor: pointer; min-height: 32px; display: flex; align-items: center; font-weight: 600; font-size: 13px; }
  details ol { margin: 4px 0 6px; padding-left: 20px; font-size: 13px; line-height: 1.6; }
  #note { margin: 4px 8px 0; font-size: 12px; color: #6b7280; line-height: 1.5; }
  #exdesc { font-size: 13px; color: #374151; flex: 1 1 100%; }
  [hidden] { display: none !important; }
  .sm { display: none; }
  /* 좁은 화면(휴대폰): 한 화면(높이 약 660)에 안내·버튼·결과가 보이게 압축 */
  @media (max-width: 480px) {
    button { font-size: 12px; }
    #top { padding: 6px 8px; gap: 4px; }
    #top button { flex: 1 1 0; padding: 4px 2px; white-space: nowrap; }
    #eq { flex: 1 1 100%; text-align: left; font-size: 12px; line-height: 1.3; }
    .row { padding: 4px 8px; gap: 0 8px; }
    .lg { display: none; }
    .sm { display: inline; }
    #ctl .ctl { flex-wrap: nowrap; gap: 4px; }
    #ctl .ctl.ra { width: 100%; }
    #ctl .ctl.ra input[type=range] { flex: 1 1 auto; width: auto; min-width: 0; min-height: 32px; }
    #ctl input[type=number] { width: 50px; min-height: 40px; padding: 2px 4px; }
    #ctl .ctl.rb button { min-width: 44px; padding: 4px; }
    #dial { width: 120px; height: 64px; }
    #dial text.tk { font-size: 12px; }
    #dial text.rl { font-size: 16px; }
    #stage { height: 232px; }
    #acts { flex-wrap: nowrap; gap: 4px; padding: 6px 8px; }
    #acts button { flex: 1 1 0; min-width: 0; padding: 4px 1px; white-space: nowrap; }
    #exbar { flex-wrap: wrap; gap: 4px; }
    #exbar button { flex: 1 1 28%; min-width: 0; padding: 4px 1px; white-space: nowrap; }
    #exdesc { font-size: 12px; line-height: 1.4; }
    #info { padding: 0 8px; gap: 4px; }
    .box { flex: 1 1 100%; font-size: 12px; line-height: 1.4; padding: 5px 8px; }
  }
</style>
</head>
<body>
<div id="app">
  <div id="top">
    <button id="tBuild" class="on">합 공식 만들기</button>
    <button id="tApply">활용하기</button>
    <button id="bReset" class="warn">처음으로</button>
    <div id="eq"></div>
  </div>

  <!-- 설정 줄: 첫 조각 a, 축소 비율 r -->
  <div class="row" id="ctl">
    <div class="ctl ra">
      <label for="aRange"><span class="lg">첫 조각 </span>a</label>
      <input id="aRange" type="range" min="0.5" max="2" step="0.1" value="1" />
      <input id="aNum" type="number" min="0.5" max="2" step="0.1" value="1" aria-label="a 값" />
    </div>
    <div class="ctl rb">
      <label class="lg">축소 비율 r (눈금판을 돌려요)</label>
      <svg id="dial" viewBox="0 0 180 96" role="img" aria-label="r 눈금판"></svg>
      <button id="rDown" aria-label="r 줄이기">−</button>
      <input id="rNum" type="number" step="0.05" value="0.5" aria-label="r 값" />
      <button id="rUp" aria-label="r 늘리기">+</button>
    </div>
    <label class="ctl"><input id="wide" type="checkbox" /> <span class="lg">범위 넓히기 (발산 관찰용 ±1.2)</span><span class="sm">넓히기</span></label>
  </div>

  <!-- 활용 탭: 예제 -->
  <div class="row" id="exbar" hidden>
    <button id="ex1">① 순환소수 0.2727…</button>
    <button id="ex2">② 튀는 공</button>
    <button id="ex3">③ 정사각형 안 정사각형</button>
    <div id="exdesc"></div>
  </div>

  <div id="stage"><canvas id="cv"></canvas></div>

  <div id="acts">
    <button id="bIns" class="on">복사본 끼우기</button>
    <button id="bTen">10번 끼우기</button>
    <button id="bUndo">하나 되돌리기</button>
    <button id="bLim">극한 위치 보기</button>
    <button id="bForm">식 맞추기</button>
  </div>
  <div id="warn" hidden></div>

  <div id="info">
    <div class="box" id="hint"></div>
    <div class="box" id="stat"></div>
  </div>

  <div id="fpanel" hidden></div>

  <details>
    <summary>질문 보기</summary>
    <ol id="qs"></ol>
  </details>
  <div id="note">화면은 최대 30번까지 끼운 유한한 그림입니다. 무한 번 끼운 '전체'는 |r| &lt; 1 일 때만 길이가 정해지며, 그 길이가 Sₙ 의 극한 a/(1−r) 입니다.</div>
</div>

<script>
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var cv = $("cv"), ctx = cv.getContext("2d"), stage = $("stage");
  var W = 300, H = 290, DPR = 1, CP = false; // CP: 좁은 화면(그림판 낮음)
  var NMAX = 30;

  // ── 상태 ──────────────────────────────────────────────────
  // tab: build | apply, mode: strip | dec | ball | sq
  var st = { tab: "build", mode: "strip", a: 1, r: 0.5, n: 0, limit: false, wide: false,
             p: 0, flash: 0, glow: "", glowT: 0, fa: false, fr: false, steps: 0, formOpen: false, hintKey: "start" };
  var hist = [];
  var anim = null, drag = null, tenTimer = null;

  // ── 계산 ──────────────────────────────────────────────────
  // 점화식 S(n+1) = a + r·S(n), S(0 번 끼움) = a
  function Sn(n) { var s = st.a; for (var k = 0; k < n; k++) s = st.a + st.r * s; return s; }
  // 공식값 a(1-r^(n+1))/(1-r), r=1 이면 (n+1)a
  function Sform(n) {
    if (Math.abs(st.r - 1) < 1e-9) return (n + 1) * st.a;
    return st.a * (1 - Math.pow(st.r, n + 1)) / (1 - st.r);
  }
  function limitVal() { return Math.abs(st.r) < 1 ? st.a / (1 - st.r) : null; }
  // 그림: 첫 조각 [0,a] + 이전 그림을 점 a 기준으로 r배(부호 있는 닮음)
  function figure(n) {
    var a = st.a, r = st.r, segs = [{ lo: 0, hi: a, d: 0 }];
    for (var k = 0; k < n; k++) {
      var nx = [{ lo: 0, hi: a, d: 0 }];
      for (var i = 0; i < segs.length; i++) nx.push({ lo: a + r * segs[i].lo, hi: a + r * segs[i].hi, d: segs[i].d + 1 });
      segs = nx;
    }
    return segs;
  }
  function copyOf(n) {
    var a = st.a, r = st.r, f = figure(n), out = [];
    for (var i = 0; i < f.length; i++) out.push({ lo: a + r * f[i].lo, hi: a + r * f[i].hi, d: f[i].d + 1 });
    return out;
  }
  function fmt(x, d) {
    if (x === null || x === undefined || !isFinite(x)) return "너무 커요";
    if (Math.abs(x) > 1e9) return x.toExponential(2);
    d = d === undefined ? 6 : d;
    var s = parseFloat(x.toFixed(d)).toString();
    return s === "-0" ? "0" : s;
  }
  // 자 눈금 범위 (30번 끼운 그림의 범위, 최대 [-10,10])
  function range() {
    var a = st.a, r = st.r, lo = 0, hi = a, ok = true;
    for (var k = 0; k < NMAX; k++) {
      var l2 = r >= 0 ? a + r * lo : a + r * hi, h2 = r >= 0 ? a + r * hi : a + r * lo;
      lo = Math.min(0, l2); hi = Math.max(a, h2);
      if (!isFinite(lo) || !isFinite(hi)) { ok = false; break; }
    }
    if (!ok) { lo = -10; hi = 10; }
    lo = Math.max(lo, -10); hi = Math.min(hi, 10);
    var m = 0.06 * (hi - lo) + 0.02 * a;
    return [lo - m, hi + m];
  }
  function niceStep(raw) {
    var e = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / e;
    return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e;
  }
  function col(d) { return d === 0 ? "#2563eb" : "hsl(217,85%," + Math.min(42 + d * 4, 86) + "%)"; }
  function rowDist() { return CP ? (st.mode === "sq" ? 96 : st.mode === "ball" ? 80 : 112) : (st.mode === "sq" ? 140 : 120); }
  // 버튼 글자: 좁은 화면에서는 짧게
  var LABELS = { bIns: ["복사본 끼우기", "끼우기"], bTen: ["10번 끼우기", "10번"], bUndo: ["하나 되돌리기", "되돌리기"], bLim: ["극한 위치 보기", "극한 보기"], bForm: ["식 맞추기", "식 맞추기"],
                 ex1: ["① 순환소수 0.2727…", "① 순환소수"], ex2: ["② 튀는 공", "② 튀는 공"], ex3: ["③ 정사각형 안 정사각형", "③ 정사각형"], bReset: ["처음으로", "처음"] };
  function setLabels() { for (var id in LABELS) { var t = LABELS[id][CP ? 1 : 0]; if ($(id).textContent !== t) $(id).textContent = t; } }

  // ── 그리기 ────────────────────────────────────────────────
  function resize() {
    DPR = window.devicePixelRatio || 1;
    W = Math.max(200, stage.clientWidth); H = stage.clientHeight || 290; CP = H < 260; setLabels();
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    draw();
  }
  function label(t, x, y, color, align, font) {
    ctx.fillStyle = color || "#6b7280"; ctx.textAlign = align || "left"; ctx.font = font || "12px sans-serif";
    ctx.fillText(t, x, y);
  }
  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#fdfdfb"; ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = 1;
    if (st.mode === "ball") drawBall(); else if (st.mode === "sq") drawSq(); else drawStrip();
  }
  function now() { return performance.now(); }

  function drawStrip() {
    var rg = range(), lo = rg[0], hi = rg[1], pad = 14, sx = (W - 2 * pad) / (hi - lo);
    function X(u) { return pad + (u - lo) * sx; }
    var R1 = 62, R2 = R1 + rowDist(), BH = 30, a = st.a, r = st.r, p = st.p;
    var axisY = R1 + BH / 2 + 10;
    // 자(눈금)
    ctx.strokeStyle = "#9ca3af"; ctx.beginPath(); ctx.moveTo(X(lo), axisY); ctx.lineTo(X(hi), axisY); ctx.stroke();
    var step = niceStep((hi - lo) / 8);
    for (var k = Math.ceil(lo / step); k <= Math.floor(hi / step + 1e-9); k++) {
      var tx = X(k * step);
      ctx.beginPath(); ctx.moveTo(tx, axisY); ctx.lineTo(tx, axisY + 5); ctx.stroke();
      label(fmt(k * step, 3), tx, axisY + 17, "#6b7280", "center", "11px sans-serif");
    }
    label("현재 그림", 10, 15, "#374151", "left", "bold 12px sans-serif");
    // 대기칸
    ctx.setLineDash([4, 4]); ctx.strokeStyle = "#d1d5db";
    ctx.strokeRect(6, R2 - BH / 2 - 14, W - 12, BH + 44); ctx.setLineDash([]);
    label("복사본 대기칸 (현재 그림 전체 × r)", 12, R2 + BH / 2 + 24, "#6b7280");
    if (Math.abs(r) >= 1) label("복사본이 줄어들지 않아요", W - 12, R2 + BH / 2 + 24, "#b91c1c", "right");
    // 꽂는 자리(초록 점선)
    ctx.setLineDash([5, 4]); ctx.strokeStyle = "#16a34a"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(a), R1 - BH / 2 - 6); ctx.lineTo(X(a), 142); ctx.stroke();
    ctx.setLineDash([]); ctx.lineWidth = 1;
    label("▲ 꽂는 자리", Math.min(Math.max(X(a), 44), W - 44), 140, "#16a34a", "center");
    // 현재 그림
    var segs = figure(st.n), tiny = false;
    function bars(list, y, fixed, alpha) {
      for (var i = 0; i < list.length; i++) {
        var s = list[i], l = Math.min(s.lo, s.hi), h = Math.max(s.lo, s.hi);
        var x1 = X(l), x2 = X(h), yy = y + (r < 0 ? Math.min(s.d, 6) * 3 : 0);
        if (x2 - x1 < 0.5) { if (!fixed) tiny = true; continue; }
        x1 = Math.max(x1, -2); x2 = Math.min(x2, W + 2);
        if (x2 <= x1) continue;
        ctx.globalAlpha = alpha; ctx.fillStyle = fixed || col(s.d);
        ctx.fillRect(x1, yy - BH / 2, x2 - x1, BH);
        ctx.strokeStyle = "#fff"; ctx.strokeRect(x1, yy - BH / 2, x2 - x1, BH);
        ctx.globalAlpha = 1;
      }
    }
    bars(segs, R1, null, 1);
    if (tiny) label("(너무 작아 보이지 않음)", W - 10, 15, "#6b7280", "right");
    // 그림 끝 위치 Sn
    var sEnd = Sn(st.n), ex = X(sEnd);
    if (isFinite(sEnd) && ex >= 0 && ex <= W) {
      ctx.strokeStyle = "#111827"; ctx.beginPath(); ctx.moveTo(ex, R1 - BH / 2 - 2); ctx.lineTo(ex, axisY + 4); ctx.stroke();
      label("Sₙ = " + fmt(sEnd, 4), Math.min(Math.max(ex, 50), W - 50), axisY + 32, "#111827", "center", "bold 12px sans-serif");
    } else {
      var right = !(sEnd < lo);
      label(right ? "Sₙ = " + fmt(sEnd, 2) + " ▶" : "◀ Sₙ = " + fmt(sEnd, 2), right ? W - 8 : 8, axisY + 32, "#b91c1c", right ? "right" : "left", "bold 12px sans-serif");
    }
    // 극한 위치
    var L = limitVal();
    if (st.limit) {
      if (L !== null) {
        ctx.strokeStyle = "#16a34a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(L), 22); ctx.lineTo(X(L), R2 + BH / 2 + 4); ctx.stroke(); ctx.lineWidth = 1;
        label("a/(1−r) = " + fmt(L, 4), Math.min(Math.max(X(L), 60), W - 60), 26, "#15803d", "center", "bold 12px sans-serif");
      } else label("|r| ≥ 1 : 한 값에 다가가지 않아요", W / 2, 26, "#b91c1c", "center");
    }
    // 복사본
    var cps = copyOf(st.n), y2 = R2 + (R1 - R2) * p;
    bars(cps, y2, "#9ca3af", 0.85);
    var cLo = Infinity, cHi = -Infinity;
    cps.forEach(function (s) { cLo = Math.min(cLo, s.lo, s.hi); cHi = Math.max(cHi, s.lo, s.hi); });
    var hx = Math.min(Math.max(X((cLo + cHi) / 2), 34), W - 34);
    if (!isFinite(hx)) hx = W / 2;
    // 빛남(식 맞추기에서 탭)
    var t = now();
    ctx.lineWidth = 3;
    if (st.glow === "first" && t < st.glowT) { ctx.strokeStyle = "#f59e0b"; ctx.strokeRect(X(0) - 2, R1 - BH / 2 - 3, X(a) - X(0) + 4, BH + 6); }
    if (st.glow === "copy" && t < st.glowT) { ctx.strokeStyle = "#f59e0b"; ctx.strokeRect(Math.max(X(Math.min(cLo, cHi)) - 2, 0), y2 - BH / 2 - 3, Math.max(X(cHi) - X(cLo), 4) + 4, BH + 6); }
    ctx.lineWidth = 1;
    // 끼운 직후 괄호 표시
    if (t < st.flash) {
      var by = R1 - BH / 2 - 8, xa = X(a), xc1 = X(Math.min(cLo, cHi)), xc2 = X(Math.max(cLo, cHi));
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#2563eb"; ctx.beginPath(); ctx.moveTo(X(0), by); ctx.lineTo(xa, by); ctx.stroke();
      ctx.strokeStyle = "#ea580c"; ctx.beginPath(); ctx.moveTo(Math.max(xc1, 0), by); ctx.lineTo(Math.min(xc2, W), by); ctx.stroke();
      ctx.lineWidth = 1;
      label("첫 조각 + (전체 × r)", W / 2, by - 6, "#374151", "center", "bold 12px sans-serif");
    }
    drawHandle(hx, y2);
  }
  function drawHandle(x, y) {
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "#2563eb"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.lineWidth = 1;
    label("⇕", x, y + 7, "#2563eb", "center", "bold 20px sans-serif");
  }

  // 튀는 공: 처음 낙하 3 m + 튀는 호(각 호의 이동거리 4·(2/3)^i)
  function drawBall() {
    var r = st.r, p = st.p, g1 = CP ? 128 : 150, g2 = g1 + rowDist() * (1 - p), ppm = CP ? 33 : 40, k = ppm / 40, x0 = 52;
    var rail = g1 + rowDist(), boxTop = CP ? rail - 72 : 184, boxH = CP ? 92 : 100; // 대기칸 상자
    var n = st.n, xs = [x0];
    function h(i) { return 3 * Math.pow(r, i + 1); }
    for (var i = 0; i <= n + 1; i++) xs.push(xs[i] + 26 * Math.sqrt(h(i)));
    label("현재 그림 (높이 3 m 에서 낙하)", 10, 15, "#374151", "left", "bold 12px sans-serif");
    ctx.strokeStyle = "#9ca3af";
    ctx.beginPath(); ctx.moveTo(10, g1); ctx.lineTo(W - 10, g1); ctx.stroke();
    ctx.setLineDash([4, 4]); ctx.strokeStyle = "#d1d5db";
    ctx.strokeRect(6, boxTop, W - 12, boxH); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(10, rail); ctx.lineTo(W - 10, rail); ctx.stroke();
    label("복사본 대기칸 (튄 뒤 전체 경로 × 2/3)", 12, boxTop + 15, "#6b7280"); // 상자 윗변 안쪽(점선과 안 겹치게)
    // 처음 낙하
    ctx.strokeStyle = "#111827"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x0, g1 - 3 * ppm); ctx.lineTo(x0, g1); ctx.stroke(); ctx.lineWidth = 1;
    label("처음 낙하 3 m", x0 + 6, g1 - 3 * ppm + 4, "#111827", "left", "11px sans-serif"); // 왼쪽이 잘리지 않게 선 오른쪽에
    // 꽂는 자리
    ctx.setLineDash([5, 4]); ctx.strokeStyle = "#16a34a"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(xs[1], g1 - 90 * k); ctx.lineTo(xs[1], g1 + 6); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    label("꽂는 자리", xs[1], g1 - 94 * k, "#16a34a", "center", "11px sans-serif");
    function arc(i, g, color) {
      var w = xs[i + 1] - xs[i];
      if (w < 0.5) return;
      ctx.strokeStyle = color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(xs[i], g); ctx.quadraticCurveTo(xs[i] + w / 2, g - 2 * ppm * h(i), xs[i + 1], g); ctx.stroke(); ctx.lineWidth = 1;
    }
    for (var j = 0; j <= n; j++) arc(j, g1, col(j));
    for (var c = 1; c <= n + 1; c++) arc(c, g2, "#9ca3af");
    var t = now();
    // 강조(첫 조각): 첫 왕복 호만 감싼다(낙하선 제외)
    if (st.glow === "first" && t < st.glowT) { ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 3; ctx.strokeRect(x0 + 4, g1 - ppm * h(0) - 4, xs[1] - x0, ppm * h(0) + 8); ctx.lineWidth = 1; }
    if (st.glow === "copy" && t < st.glowT) { ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 3; ctx.strokeRect(xs[1] - 3, g2 - 60 * k, xs[n + 2] - xs[1] + 6, 64 * k); ctx.lineWidth = 1; }
    if (t < st.flash) label("첫 조각 + (전체 × r)", W / 2, 34, "#374151", "center", "bold 12px sans-serif");
    drawHandle(Math.min(xs[1] + (xs[n + 2] - xs[1]) / 2, W - 34), g2 - 24);
  }

  // 정사각형 안 정사각형: 단계 i 의 한 변 = 100/(√2)^i, 45°씩 회전
  function drawSq() {
    var p = st.p, cx = W / 2, cy1 = CP ? 76 : 92, cy2 = cy1 + rowDist() * (1 - p), n = st.n, sc = CP ? 0.8 : 1, base2 = cy1 + rowDist();
    label("현재 그림 (한 변 2 인 정사각형, 넓이 4)", 10, 15, "#374151", "left", "bold 12px sans-serif");
    ctx.setLineDash([4, 4]); ctx.strokeStyle = "#d1d5db"; ctx.strokeRect(6, base2 - (CP ? 42 : 50), W - 12, CP ? 84 : 104); ctx.setLineDash([]);
    // 대기칸 글자: 좁은 화면은 상자 아래, 넓은 화면은 상자 안 왼쪽 아래(점선과 안 겹치게)
    label("복사본 대기칸 (안쪽 그림 × 1/2 넓이)", 12, CP ? base2 + 56 : base2 + 48, "#6b7280");
    function sq(i, y, fill, alpha) {
      var s = 100 * sc / Math.pow(Math.SQRT2, i);
      if (s < 1) return;
      ctx.save(); ctx.translate(cx, y); ctx.rotate(i * Math.PI / 4);
      ctx.globalAlpha = alpha; ctx.fillStyle = fill; ctx.fillRect(-s / 2, -s / 2, s, s); ctx.globalAlpha = 1;
      ctx.strokeStyle = "#fff"; ctx.strokeRect(-s / 2, -s / 2, s, s); ctx.restore();
    }
    for (var i = 0; i <= n; i++) sq(i, cy1, col(i), i === 0 ? 0.9 : 0.55);
    for (var c = 1; c <= n + 1; c++) sq(c, cy2, "#9ca3af", 0.5);
    ctx.setLineDash([5, 4]); ctx.strokeStyle = "#16a34a"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy1, 16, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    label(CP ? "꽂는 자리" : "꽂는 자리 (중점 정사각형)", cx + (CP ? 48 : 62), cy1 + 4, "#16a34a", "left", "11px sans-serif");
    var t = now();
    if (st.glow === "first" && t < st.glowT) { ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 3; ctx.strokeRect(cx - 54 * sc, cy1 - 54 * sc, 108 * sc, 108 * sc); ctx.lineWidth = 1; }
    if (st.glow === "copy" && t < st.glowT) { ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 3; ctx.strokeRect(cx - 40 * sc, cy2 - 40 * sc, 80 * sc, 80 * sc); ctx.lineWidth = 1; }
    if (t < st.flash) label("첫 조각 + (전체 × r)", W - 10, 15, "#374151", "right", "bold 12px sans-serif");
    drawHandle(cx + 70, cy2);
  }

  // ── 화면 갱신 ─────────────────────────────────────────────
  var QS_BUILD = [
    "복사본을 여러 번 끼운 뒤, 그림의 '첫 조각을 뺀 나머지'는 무엇과 닮았나요? 몇 배인가요?",
    "끝없이 끼운 전체 길이를 S라 하면, 질문 1을 식으로 쓰면 S = a + □ 입니다. S 를 구해 보고 [극한 위치 보기]로 확인하세요.",
    "r 을 0.9, 1, −0.5, −1 로 바꿔 보세요(1 이상은 [범위 넓히기]). 어떤 때 그림 길이가 한 값에 다가가나요? S = a + rS 라는 식을 쓸 수 없는 경우는 언제일까요?"
  ];
  var QS_APPLY = [
    "0.272727… 을 '첫 조각 + 그 복사본'으로 보면 첫 조각과 r 은 무엇인가요? 튀는 공에서는 왜 첫 낙하만 따로 떼어야 할까요?",
    "정사각형 안 정사각형에서 넓이의 비 r 이 왜 1/2 일까요? (한 변의 비는 1/√2)"
  ];
  var EXDESC = {
    dec: "첫 조각 0.27, 복사본은 1/100배. 0.27 + 0.0027 + … → 27/99 = 3/11",
    ball: "높이 3 m 에서 떨어져 매번 2/3 높이로 튑니다. 처음 낙하 3 m 는 따로 떼고, 튀어 오른 뒤 한 번의 왕복 2·3·(2/3) = 4 m 가 첫 조각입니다. 총 거리 3 + 4/(1−2/3) = 15 m",
    sq: "한 변 2 인 정사각형의 각 변 중점을 이어 정사각형을 계속 만들 때 넓이의 합. 첫 조각 넓이 4, r = 1/2 → 합 8"
  };
  function hintText() {
    if (st.mode === "ball") return st.hintKey === "start"
      ? "처음 낙하 3 m 는 따로 떼어 둡니다. 파란 호가 첫 조각(왕복 4 m), 아래 회색은 '튄 뒤 전체 경로'를 2/3배 한 복사본이에요. 초록 점선 자리에 끼워 보세요."
      : "새 경로 = 첫 왕복 + (방금 전 경로 × 2/3). 낙하 3 m 는 이 반복에 들어가지 않아요.";
    if (st.mode === "sq") return st.hintKey === "start"
      ? "가장 큰 정사각형(넓이 4)이 첫 조각이에요. 회색은 안쪽 그림 전체의 복사본(넓이 1/2배). 초록 점선 자리에 끼워 보세요."
      : "새 그림 = 첫 정사각형 + (방금 전 그림 × 1/2 넓이). 안쪽 정사각형이 바깥과 닮았나요?";
    return st.hintKey === "start"
      ? "파란 조각이 첫째 항 a 예요. 아래 회색 복사본은 '지금 그림 전체'를 r배로 줄인 거예요. 초록 점선 자리에 끼워 보세요."
      : "새 그림 = 첫 조각 + (방금 전 그림 × r). 끼운 복사본이 원래 그림과 똑같이 생겼나요?";
  }
  function row(k, v, cls) { return "<div><span>" + k + "</span><b" + (cls ? ' class="' + cls + '"' : "") + ">" + v + "</b></div>"; }
  function update() {
    var a = st.a, r = st.r, n = st.n, s = Sn(n), L = limitVal(), f = Sform(n), m = st.mode;
    // 상단 식
    var eq;
    if (m === "dec") eq = "0.2727… = 0.27 + 0.27×0.01 + 0.27×0.01² + …";
    else if (m === "ball") eq = "총 거리 = 3 + 4 + 4·(2/3) + 4·(2/3)² + …";
    else if (m === "sq") eq = "넓이의 합 = 4 + 4·(1/2) + 4·(1/2)² + …";
    else eq = "S = a + ar + ar² + …  (a = " + fmt(a, 2) + ", r = " + fmt(r, 2) + ")";
    $("eq").textContent = eq;
    // 상태 상자
    var h = "";
    h += row("끼운 횟수 n", n + " (조각 " + (n + 1) + "개)");
    var unit = m === "ball" ? " m" : "";
    if (Math.abs(r - 1) < 1e-9) {
      h += row("그림 길이 Sₙ", "(n+1) × a = " + fmt(f, 4));
      h += row("a/(1−r)", "정의되지 않음(0으로 나눔)", "");
    } else {
      h += row("그림 길이 Sₙ" + (m === "ball" ? " (튄 뒤 부분)" : ""), fmt(s, 6) + unit);
      var diff = Math.abs(s - f);
      h += row("공식 a(1−rⁿ⁺¹)/(1−r)", fmt(f, 6) + (diff < 1e-6 * Math.max(1, Math.abs(f)) ? " ✔ 같음" : " (확인 필요)"), "ok");
      if (L !== null) { h += row("a/(1−r)", fmt(L, 6) + unit); h += row("차이", fmt(L - s, 6)); }
      else h += row("a/(1−r)", "한 값에 다가가지 않음");
    }
    if (m === "ball") h += row("총 이동거리", fmt(3 + s, 4) + " m (극한 3 + 12 = 15 m)");
    if (m === "dec") h += row("요약", "0.27 + 0.0027 + … → 27/99 = 3/11");
    if (m === "sq") h += row("요약", "합 → 4/(1 − 1/2) = 8");
    $("stat").innerHTML = h;
    $("hint").textContent = hintText();
    // 경고
    var w = $("warn");
    if (m === "strip" && Math.abs(r) >= 1) { w.hidden = false; w.textContent = "복사본이 줄어들지 않아요. 끼울수록 끝없이 커지거나 흔들립니다. (이때는 S = a + rS 에서 S 를 구할 수 없어요)"; }
    else w.hidden = true;
    // 컨트롤
    $("aRange").value = a; if (document.activeElement !== $("aNum")) $("aNum").value = fmt(a, 2);
    if (document.activeElement !== $("rNum")) $("rNum").value = fmt(r, 2);
    var lim = rLimits();
    $("rNum").min = lim[0]; $("rNum").max = lim[1];
    $("rDown").disabled = r <= lim[0] + 1e-9; $("rUp").disabled = r >= lim[1] - 1e-9;
    $("bIns").disabled = n >= NMAX; $("bTen").disabled = n >= NMAX; $("bUndo").disabled = hist.length === 0;
    $("bLim").classList.toggle("on", st.limit);
    $("bForm").classList.toggle("on", st.formOpen);
    $("tBuild").classList.toggle("on", st.tab === "build"); $("tApply").classList.toggle("on", st.tab === "apply");
    $("ctl").hidden = st.tab !== "build"; $("exbar").hidden = st.tab !== "apply";
    ["ex1", "ex2", "ex3"].forEach(function (id, i) { $(id).classList.toggle("on", st.tab === "apply" && ["dec", "ball", "sq"][i] === m); });
    $("exdesc").textContent = EXDESC[m] || "버튼을 눌러 예제를 고르세요.";
    var qs = st.tab === "build" ? QS_BUILD : QS_APPLY;
    $("qs").innerHTML = qs.map(function (q) { return "<li>" + q + "</li>"; }).join("");
    renderDial(); renderForm();
    kick();
  }

  // 식 맞추기 패널
  function renderForm() {
    var p = $("fpanel");
    p.hidden = !st.formOpen;
    if (!st.formOpen) return;
    var a = st.a, r = st.r;
    var h = '<p>S = <span class="blank">' + (st.fa ? "a" : "□") + '</span> + <span class="blank">' + (st.fr ? "r" : "□") + '</span> × S</p>';
    h += '<p style="font-size:12px;color:#4b5563">그림에서 <b>첫 조각</b>(위쪽 파란 부분)과 <b>복사본</b>(아래 회색)을 각각 탭하세요. (S 는 끝없이 끼운 전체 길이)</p>';
    h += '<p><button id="fa">첫 조각 탭</button> <button id="fr">복사본 탭</button></p>';
    if (st.fa && st.fr) {
      var lines = [
        "S = a + rS" + "   (a = " + fmt(a, 2) + ", r = " + fmt(r, 2) + ")",
        "S − rS = a",
        "(1 − r)S = a",
        "S = a/(1 − r) = " + (Math.abs(r) < 1 ? fmt(a, 2) + "/(1 − " + fmt(r, 2) + ") = " + fmt(a / (1 - r), 4) + (st.mode === "ball" ? "  (튄 뒤 부분, 총거리 = 3 + " + fmt(a / (1 - r), 4) + ")" : "") : "— |r| ≥ 1 이라 S 가 정해지지 않아 쓸 수 없어요")
      ];
      for (var i = 0; i < Math.min(st.steps + 1, lines.length); i++) h += "<p><b>" + lines[i] + "</b></p>";
      if (st.steps + 1 < lines.length) h += '<p><button id="fnext">다음 줄 ▸</button></p>';
      else h += '<p style="font-size:12px;color:#b45309">S 가 한 값으로 존재(|r| &lt; 1)할 때만 이렇게 풀 수 있어요.</p>';
    }
    p.innerHTML = h;
    $("fa").onclick = function () { tapFirst(); }; $("fr").onclick = function () { tapCopy(); };
    var nx = $("fnext"); if (nx) nx.onclick = function () { st.steps++; renderForm(); };
  }

  // r 눈금판(반원)
  function rLimits() { return st.wide ? [-1.2, 1.2] : [-0.8, 0.9]; }
  var DCX = 90, DCY = 84, DR = 66;
  function renderDial() {
    var lim = rLimits(), lo = lim[0], hi = lim[1], s = "";
    s += '<path d="M' + (DCX - DR) + " " + DCY + " A" + DR + " " + DR + " 0 0 1 " + (DCX + DR) + " " + DCY + '" fill="#f9fafb" stroke="#9ca3af" stroke-width="2"/>';
    function ang(v) { return Math.PI * (1 - (v - lo) / (hi - lo)); }
    for (var v = Math.ceil(lo * 10 - 1e-9) / 10; v <= hi + 1e-9; v += 0.1) {
      var t = ang(v), big = Math.abs(Math.round(v * 10) % 5) === 0;
      var x1 = DCX + (DR - (big ? 10 : 5)) * Math.cos(t), y1 = DCY - (DR - (big ? 10 : 5)) * Math.sin(t);
      var x2 = DCX + DR * Math.cos(t), y2 = DCY - DR * Math.sin(t);
      s += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="#6b7280"/>';
    }
    [0].concat([lo, hi]).forEach(function (v) {
      var t = ang(v), x = DCX + (DR - 20) * Math.cos(t), y = DCY - (DR - 20) * Math.sin(t) + 3;
      s += '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" class="tk" font-size="9" text-anchor="middle" fill="#4b5563">' + v + "</text>";
    });
    var tt = ang(Math.min(Math.max(st.r, lo), hi));
    s += '<line x1="' + DCX + '" y1="' + DCY + '" x2="' + (DCX + (DR - 4) * Math.cos(tt)).toFixed(1) + '" y2="' + (DCY - (DR - 4) * Math.sin(tt)).toFixed(1) + '" stroke="#2563eb" stroke-width="4" stroke-linecap="round"/>';
    s += '<circle cx="' + DCX + '" cy="' + DCY + '" r="6" fill="#2563eb"/>';
    s += '<text class="rl" x="' + DCX + '" y="' + (DCY - 22) + '" font-size="13" text-anchor="middle" font-weight="700" fill="#1f2937">r = ' + fmt(st.r, 2) + "</text>";
    $("dial").innerHTML = s;
  }
  function dialPick(e) {
    var bb = $("dial").getBoundingClientRect(), k = 180 / bb.width;
    var x = (e.clientX - bb.left) * k, y = (e.clientY - bb.top) * k;
    var t = Math.atan2(DCY - y, x - DCX);
    if (t < -Math.PI / 2) t = Math.PI; else if (t < 0) t = 0;
    var lim = rLimits();
    setR(lim[0] + (1 - t / Math.PI) * (lim[1] - lim[0]));
  }

  // ── 조작 ──────────────────────────────────────────────────
  function resetFigure() { st.n = 0; hist = []; st.p = 0; st.flash = 0; st.hintKey = "start"; anim = null; stopTen(); }
  function setA(v) {
    v = parseFloat(v); if (!isFinite(v)) return;
    st.a = Math.min(2, Math.max(0.5, Math.round(v * 10) / 10));
    update();
  }
  function setR(v) {
    v = parseFloat(v); if (!isFinite(v)) return;
    var lim = rLimits();
    v = Math.min(lim[1], Math.max(lim[0], Math.round(v * 20) / 20));
    if (v === st.r) { update(); return; }
    st.r = v; resetFigure(); st.steps = 0; update();
  }
  function commit() {
    if (st.n >= NMAX) return;
    hist.push(st.n); st.n++; st.p = 0; st.flash = now() + 1000; st.hintKey = "after"; update();
  }
  function startAnim(to, doCommit, dur) {
    if (anim) return;
    anim = { from: st.p, to: to, t0: now(), dur: dur || 300, commit: doCommit };
    kick();
  }
  function insertOne() {
    if (anim || st.n >= NMAX) return;
    stopTen(); startAnim(1, true, 300);
  }
  function stopTen() { if (tenTimer) { clearInterval(tenTimer); tenTimer = null; } }
  function insertTen() {
    if (anim || tenTimer) return;
    var cnt = 0;
    tenTimer = setInterval(function () {
      if (cnt >= 10 || st.n >= NMAX) { stopTen(); return; }
      cnt++; commit();
    }, 80);
  }
  function undo() {
    if (!hist.length) return;
    stopTen(); anim = null; st.p = 0; st.n = hist.pop(); st.flash = 0; if (st.n === 0) st.hintKey = "start"; update();
  }
  function setExample(m) {
    st.tab = "apply"; st.mode = m;
    if (m === "dec") { st.a = 0.27; st.r = 0.01; }
    else if (m === "ball") { st.a = 4; st.r = 2 / 3; }
    else { st.a = 4; st.r = 0.5; }
    resetFigure(); update();
  }
  function goBuild() {
    st.tab = "build"; st.mode = "strip"; st.a = 1; st.r = 0.5; resetFigure(); update();
  }
  function tapFirst() {
    st.glow = "first"; st.glowT = now() + 700;
    if (st.formOpen) { st.fa = true; renderForm(); }
    kick();
  }
  function tapCopy() {
    st.glow = "copy"; st.glowT = now() + 700;
    if (st.formOpen) { st.fr = true; renderForm(); }
    kick();
  }

  // 캔버스 끌기: 아래쪽 복사본을 위로 끌어 올려 꽂는다. 거의 안 움직이면 '탭'.
  function pos(e) { var b = cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; }
  cv.addEventListener("pointerdown", function (e) {
    if (anim) return;
    var q = pos(e);
    drag = { id: e.pointerId, sx: q.x, sy: q.y, lower: q.y > H * 0.5, moved: false };
    try { cv.setPointerCapture(e.pointerId); } catch (x) {}
    e.preventDefault();
  });
  cv.addEventListener("pointermove", function (e) {
    if (!drag || drag.id !== e.pointerId) return;
    var q = pos(e);
    if (Math.abs(q.x - drag.sx) + Math.abs(q.y - drag.sy) > 6) drag.moved = true;
    if (drag.moved && drag.lower) {
      st.p = Math.min(1, Math.max(0, (drag.sy - q.y) / rowDist()));
      kick();
    }
  });
  function endDrag(e) {
    if (!drag || drag.id !== e.pointerId) return;
    var d = drag; drag = null;
    if (!d.moved) { if (d.lower) tapCopy(); else tapFirst(); return; }
    if (d.lower) {
      if (st.p > 0.55 && st.n < NMAX) startAnim(1, true, 300 * (1 - st.p) + 80);
      else startAnim(0, false, 200);
    }
  }
  cv.addEventListener("pointerup", endDrag);
  cv.addEventListener("pointercancel", endDrag);

  // 그리기 반복(애니메이션·빛남·괄호가 있을 때만)
  var looping = false;
  function kick() { if (!looping) { looping = true; requestAnimationFrame(loop); } }
  function loop() {
    var t = now();
    if (anim) {
      var u = Math.min(1, (t - anim.t0) / anim.dur);
      st.p = anim.from + (anim.to - anim.from) * (u * (2 - u));
      if (u >= 1) { var a2 = anim; anim = null; st.p = a2.to; if (a2.commit) commit(); }
    }
    draw();
    if (anim || t < st.glowT || t < st.flash || (drag && drag.moved)) requestAnimationFrame(loop); else looping = false;
  }

  // ── 이벤트 연결 ───────────────────────────────────────────
  $("tBuild").onclick = goBuild;
  $("tApply").onclick = function () { setExample(st.mode === "strip" ? "dec" : st.mode); };
  $("bReset").onclick = function () { st.formOpen = false; st.fa = st.fr = false; st.steps = 0; st.limit = false; st.wide = false; $("wide").checked = false; goBuild(); };
  $("ex1").onclick = function () { setExample("dec"); };
  $("ex2").onclick = function () { setExample("ball"); };
  $("ex3").onclick = function () { setExample("sq"); };
  $("aRange").addEventListener("input", function () { setA(this.value); });
  $("aNum").addEventListener("change", function () { setA(this.value); });
  $("rNum").addEventListener("change", function () { setR(this.value); });
  $("rDown").onclick = function () { setR(st.r - 0.05); };
  $("rUp").onclick = function () { setR(st.r + 0.05); };
  $("wide").addEventListener("change", function () { st.wide = this.checked; setR(st.r); });
  $("bIns").onclick = insertOne;
  $("bTen").onclick = insertTen;
  $("bUndo").onclick = undo;
  $("bLim").onclick = function () { st.limit = !st.limit; update(); };
  $("bForm").onclick = function () { st.formOpen = !st.formOpen; update(); };
  var dialDrag = false;
  $("dial").addEventListener("pointerdown", function (e) { dialDrag = true; try { this.setPointerCapture(e.pointerId); } catch (x) {} dialPick(e); e.preventDefault(); });
  $("dial").addEventListener("pointermove", function (e) { if (dialDrag) dialPick(e); });
  $("dial").addEventListener("pointerup", function () { dialDrag = false; });
  $("dial").addEventListener("pointercancel", function () { dialDrag = false; });
  window.addEventListener("resize", resize);

  resize();
  update();
})();
</script>
</body>
</html>
$hands_on$::text),
  true, null
)
on conflict (slug) do update
  set type = excluded.type, config = excluded.config, updated_at = now();

-- 기울기가 높이와 같아지는 밑 — e 를 손으로 찾기  (원본: content/hands-on/calc2-find-e-slope.html)
insert into public.manipulatives
  (slug, title, summary, topic, school_level, order_index, type, config, is_published, owner_id)
values (
  'calc2-find-e-slope',
  '기울기가 높이와 같아지는 밑 — e 를 손으로 찾기',
  '지수함수 위의 점을 끌어 보면 접선의 기울기가 언제나 높이의 일정한 배수예요. 밑을 바꿔 그 배수가 1이 되는 밑을 찾으면, 그것이 e 입니다.',
  '미적분Ⅱ · 지수함수와 로그함수의 미분', 'high', 6, 'html',
  jsonb_build_object('height', 660, 'html', $hands_on$<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>e 를 손으로 찾기 — 기울기가 높이와 같아지는 밑</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif; color: #1f2937; }
  #app { height: 660px; display: flex; flex-direction: column; padding: 6px 8px 6px; gap: 5px; overflow: hidden; }
  h1 { margin: 0; font-size: 15px; line-height: 20px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  h1 small { font-weight: 400; color: #6b7280; font-size: 12px; display: none; }
  #hint { font-size: 14px; line-height: 1.35; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 5px 9px; min-height: 40px; color: #1e3a8a; }
  #stage { position: relative; flex: 1 1 auto; min-height: 150px; border: 1px solid #e5e7eb; border-radius: 10px; background: #fdfdfb; overflow: hidden; touch-action: none; }
  #cv { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
  .row { display: flex; align-items: center; gap: 6px; }
  button { font: inherit; font-size: 13px; border: 1px solid #d1d5db; background: #fff; color: #374151; border-radius: 8px; padding: 0 8px; min-height: 36px; cursor: pointer; line-height: 1; white-space: nowrap; touch-action: manipulation; }
  button.on { background: #2563eb; border-color: #2563eb; color: #fff; }
  .step { width: 40px; font-size: 18px; padding: 0; }
  #aRow label { font-size: 14px; font-weight: 700; min-width: 74px; font-variant-numeric: tabular-nums; }
  #aRng { flex: 1; min-width: 0; height: 36px; margin: 0; accent-color: #2563eb; }
  #hRow { gap: 4px; }
  #hRow span { font-size: 13px; color: #4b5563; margin-right: 2px; }
  #hRow button { flex: 1; padding: 0 2px; }
  #res { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
  .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 4px 8px; background: #fff; }
  .card .t { font-size: 12px; color: #6b7280; }
  .card .v { font-size: 17px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .card.wide { grid-column: 1 / 3; display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  .card.wide .v { font-size: 22px; color: #2563eb; }
  .card.ok { border: 2px solid #16a34a; background: #f0fdf4; }
  .badge { display: none; background: #16a34a; color: #fff; border-radius: 999px; font-size: 12px; padding: 2px 8px; }
  .card.ok .badge { display: inline-block; }
  #lnBox { display: none; font-size: 13px; color: #92400e; }
  #lnBox b { font-variant-numeric: tabular-nums; }
  #q { border: 1px solid #e5e7eb; border-radius: 10px; background: #f9fafb; padding: 3px 6px; }
  #qBar { display: flex; align-items: center; gap: 4px; }
  #qBar .tog { flex: 1; text-align: left; border: 0; background: none; font-weight: 700; min-height: 32px; }
  #qBar .nv { width: 36px; min-height: 32px; padding: 0; }
  #qBody { display: none; font-size: 13px; line-height: 1.45; padding: 2px 4px 4px; max-height: 120px; overflow: auto; }
  #q.open #qBody { display: block; }
  #tg { display: none; gap: 4px; padding: 0 4px 4px; }
  #tg button { min-height: 30px; font-size: 12px; }
  #note { font-size: 11.5px; color: #6b7280; line-height: 1.3; }
  @media (min-width: 560px) { h1 small { display: inline; } }
  @media (max-width: 380px) { .card .v { font-size: 15px; } .card.wide .v { font-size: 19px; } #hint { font-size: 13.5px; } #aRow label { font-size: 13px; min-width: 66px; } }
</style>
</head>
<body>
<div id="app">
  <h1>e 를 손으로 찾기 <small>— 기울기가 높이와 같아지는 밑</small></h1>
  <div id="hint"></div>
  <div id="stage"><canvas id="cv"></canvas></div>
  <div class="row" id="aRow">
    <button class="step" id="aM" aria-label="a 줄이기">−</button>
    <input type="range" id="aRng" min="1.5" max="4" step="0.001" value="2.700" aria-label="밑 a">
    <button class="step" id="aP" aria-label="a 늘리기">+</button>
    <label id="aLab">a = 2.700</label>
  </div>
  <div class="row" id="hRow"><span>h =</span>
    <button data-h="1">1</button><button data-h="0.1">0.1</button><button data-h="0.01">0.01</button><button data-h="0.001" class="on">0.001</button>
  </div>
  <div id="res">
    <div class="card"><div class="t">높이 aˣ</div><div class="v" id="vF">–</div></div>
    <div class="card"><div class="t">기울기 (할선)</div><div class="v" id="vS">–</div></div>
    <div class="card wide" id="cR">
      <div><div class="t">기울기 ÷ 높이</div><div class="v" id="vR">–</div></div>
      <div style="text-align:right"><span class="badge">거의 1!</span><div id="lnBox">ln a = <b id="vLn">–</b></div></div>
    </div>
  </div>
  <div id="q">
    <div id="qBar"><button class="nv" id="qPrev" aria-label="이전 질문">◂</button><button class="tog" id="qTog">질문 1/4 ▸</button><button class="nv" id="qNext" aria-label="다음 질문">▸</button></div>
    <div id="qBody"></div>
    <div id="tg" class="row"><button id="tLn">ln a 보기</button><button id="tE">e 곡선 보기</button></div>
  </div>
  <div id="note">h 는 0 이 될 수 없어서 화면 값은 근삿값이에요 — 가까이 갈 뿐이에요.</div>
</div>
<script>
(function () {
  "use strict";
  var XMIN = -2, XMAX = 2.5, YMIN = -0.5, YMAX = 8;
  var cv = document.getElementById("cv"), ctx = cv.getContext("2d");
  var W = 0, H = 0, DPR = 1;
  var a = 2.7, h = 0.001, px = 0.5;
  var touchedA = false, found = false, showLn = false, showE = false, qi = 0;
  var $ = function (id) { return document.getElementById(id); };

  var QS = [
    "P 를 아무리 옮겨도 '기울기 ÷ 높이' 가 변하지 않아요. 식 (a^(x+h) − aˣ)/h ÷ aˣ 를 정리해 그 이유를 설명해 보세요.",
    "h 를 1 → 0.001 로 줄이면 a=2 일 때 값이 어디로 다가가나요? 이 값은 lim(h→0) (2ʰ − 1)/h 의 근삿값이에요.",
    "'기울기 ÷ 높이' 가 1 이 되는 밑을 찾았나요? 그 밑을 e 라 하면 lim(h→0) (eʰ − 1)/h 는 얼마이고, (eˣ)' 는 무엇일까요?",
    "'ln a 보기' 를 켜고 a 를 바꿔 보세요. 비율과 ln a 는 어떤 관계인가요? 이를 써서 (aˣ)' 을 나타내고, y=ln x 가 y=eˣ 의 역함수임을 이용해 (ln x)' 도 추측해 보세요."
  ];

  function f(x) { return Math.exp(x * Math.log(a)); }
  function maxX() { return Math.min(2, Math.log(YMAX) / Math.log(a)); } // y≤8 이 되는 x 까지만
  function fmt(v, d) { return isFinite(v) ? v.toFixed(d) : "–"; }
  function sx(x) { return (x - XMIN) / (XMAX - XMIN) * W; }
  function sy(y) { return H - (y - YMIN) / (YMAX - YMIN) * H; }

  function resize() {
    var r = $("stage").getBoundingClientRect();
    DPR = window.devicePixelRatio || 1;
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    draw();
  }

  function curve(fn, color, lw) {
    ctx.beginPath(); var on = false;
    for (var i = 0; i <= 240; i++) {
      var x = XMIN + (XMAX - XMIN) * i / 240, y = fn(x);
      if (y > YMAX + 0.5) { on = false; continue; }
      if (!on) { ctx.moveTo(sx(x), sy(y)); on = true; } else ctx.lineTo(sx(x), sy(y));
    }
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke();
  }
  function line(x1, y1, x2, y2, color, lw, dash) {
    ctx.beginPath(); ctx.setLineDash(dash || []);
    ctx.moveTo(sx(x1), sy(y1)); ctx.lineTo(sx(x2), sy(y2));
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke(); ctx.setLineDash([]);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.font = "11px sans-serif"; ctx.fillStyle = "#9ca3af"; ctx.textAlign = "center";
    for (var gx = -2; gx <= 2; gx++) { line(gx, YMIN, gx, YMAX, "#f1f5f9", 1); ctx.fillText(gx, sx(gx), sy(0) + 12); }
    ctx.textAlign = "left";
    for (var gy = 1; gy <= 8; gy++) { line(XMIN, gy, XMAX, gy, "#f1f5f9", 1); if (gy % 2 === 0) ctx.fillText(gy, sx(0) + 3, sy(gy) - 2); }
    line(XMIN, 0, XMAX, 0, "#9ca3af", 1.2); line(0, YMIN, 0, YMAX, "#9ca3af", 1.2);
    if (showE) curve(Math.exp, "#cbd5e1", 1.5);
    curve(f, "#2563eb", 2.5);

    var y = f(px), ln = Math.log(a), t = y * ln, s = (f(px + h) - y) / h;
    // 높이 막대
    line(px, 0, px, y, "#9ca3af", 3);
    // 접선(정확값, 초록)
    var xa = XMIN, xb = XMAX;
    line(xa, y + t * (xa - px), xb, y + t * (xb - px), "#16a34a", 2);
    // 기울기 삼각형: 밑변 1, 높이 = 기울기
    ctx.beginPath(); ctx.moveTo(sx(px), sy(y)); ctx.lineTo(sx(px + 1), sy(y)); ctx.lineTo(sx(px + 1), sy(y + t));
    ctx.strokeStyle = "rgba(22,163,74,.6)"; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.stroke(); ctx.setLineDash([]);
    // 할선(주황 점선)
    line(XMIN, y + s * (XMIN - px), XMAX, y + s * (XMAX - px), "#f59e0b", 2, [6, 4]);
    var q = px + h;
    ctx.beginPath(); ctx.arc(sx(q), sy(f(q)), 3.5, 0, 6.2832); ctx.fillStyle = "#f59e0b"; ctx.fill();
    // 점 P
    ctx.beginPath(); ctx.arc(sx(px), sy(y), 9, 0, 6.2832); ctx.fillStyle = "#2563eb"; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = "#fff"; ctx.stroke();
    ctx.fillStyle = "#1e3a8a"; ctx.textAlign = "left"; ctx.fillText("P", sx(px) + 11, sy(y) - 9);
    // 범례
    ctx.font = "11px sans-serif";
    ctx.fillStyle = "#16a34a"; ctx.fillText("— 접선", W - 112, 14);
    ctx.fillStyle = "#d97706"; ctx.fillText("┅ 할선", W - 58, 14);
    update();
  }

  function update() {
    var y = f(px), s = (f(px + h) - y) / h;
    var r = Math.round(((Math.pow(a, h) - 1) / h) * 1e4) / 1e4; // x 와 무관한 값(소수 4자리)
    $("vF").textContent = fmt(y, 3);
    $("vS").textContent = fmt(s, 3);
    $("vR").textContent = fmt(r, 4);
    $("vLn").textContent = fmt(Math.log(a), 4);
    var near = Math.abs(r - 1) < 0.005;
    var ok = near && h === 0.001; // h 가 충분히 작을 때만 e 를 찾은 것으로 본다
    $("cR").className = "card wide" + (ok ? " ok" : "");
    if (ok) found = true;
    $("lnBox").style.display = showLn ? "block" : "none";
    $("hint").textContent = ok ? "찾았어요! 이 밑이 e ≈ 2.71828 입니다. 이때 (eˣ)' = eˣ."
      : near ? "아직 h 가 커요 — h 를 더 줄여 보세요."
      : touchedA ? "밑 a 를 바꿔 '기울기 ÷ 높이' 가 1 이 되게 해 보세요. h 를 작게 할수록 접선에 가까워져요."
      : "곡선 위 파란 점 P 를 끌어 보세요. '기울기 ÷ 높이' 는 어떻게 되나요?";
    $("aLab").textContent = "a = " + a.toFixed(3);
    $("tg").style.display = (qi === 3 || found) && $("q").classList.contains("open") ? "flex" : "none";
    $("tLn").style.display = qi === 3 ? "" : "none";
    $("tE").style.display = found ? "" : "none";
  }

  function setA(v) {
    a = Math.min(4, Math.max(1.5, Math.round(v * 1000) / 1000)); touchedA = true;
    $("aRng").value = a; px = Math.min(px, maxX()); draw();
  }

  // ── P 끌기: 캔버스 어디를 눌러도 그 x 로 이동 ──
  var drag = false;
  function moveTo(e) {
    var r = cv.getBoundingClientRect();
    var x = XMIN + (e.clientX - r.left) / r.width * (XMAX - XMIN);
    px = Math.max(-2, Math.min(maxX(), x)); draw();
  }
  cv.addEventListener("pointerdown", function (e) { drag = true; cv.setPointerCapture(e.pointerId); moveTo(e); e.preventDefault(); });
  cv.addEventListener("pointermove", function (e) { if (drag) { moveTo(e); e.preventDefault(); } });
  cv.addEventListener("pointerup", function () { drag = false; });
  cv.addEventListener("pointercancel", function () { drag = false; });

  $("aRng").addEventListener("input", function (e) { setA(parseFloat(e.target.value)); });
  // −/+ : 누르고 있으면 가속
  function hold(btn, dir) {
    var t0, tm;
    function tick() { var d = (Date.now() - t0) > 1200 ? 0.01 : (Date.now() - t0) > 500 ? 0.003 : 0.001; setA(a + dir * d); tm = setTimeout(tick, 90); }
    btn.addEventListener("pointerdown", function (e) { t0 = Date.now(); setA(a + dir * 0.001); tm = setTimeout(tick, 400); e.preventDefault(); });
    function stop() { clearTimeout(tm); }
    btn.addEventListener("pointerup", stop); btn.addEventListener("pointerleave", stop); btn.addEventListener("pointercancel", stop);
  }
  hold($("aM"), -1); hold($("aP"), 1);

  var hb = document.querySelectorAll("#hRow button");
  for (var i = 0; i < hb.length; i++) hb[i].addEventListener("click", function () {
    h = parseFloat(this.getAttribute("data-h"));
    for (var j = 0; j < hb.length; j++) hb[j].classList.toggle("on", hb[j] === this);
    draw();
  });

  function showQ() {
    $("qTog").textContent = "질문 " + (qi + 1) + "/4 " + ($("q").classList.contains("open") ? "▾" : "▸");
    $("qBody").textContent = QS[qi]; update();
  }
  $("qTog").addEventListener("click", function () { $("q").classList.toggle("open"); showQ(); });
  $("qPrev").addEventListener("click", function () { qi = (qi + 3) % 4; showQ(); });
  $("qNext").addEventListener("click", function () { qi = (qi + 1) % 4; showQ(); });
  $("tLn").addEventListener("click", function () { showLn = !showLn; this.classList.toggle("on", showLn); update(); });
  $("tE").addEventListener("click", function () { showE = !showE; this.classList.toggle("on", showE); draw(); });

  window.addEventListener("resize", resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe($("stage"));
  showQ(); resize();
})();
</script>
</body>
</html>
$hands_on$::text),
  true, null
)
on conflict (slug) do update
  set type = excluded.type, config = excluded.config, updated_at = now();
