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
