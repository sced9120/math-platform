"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/icon";

// 손으로 그리는 칸.
//  - 마우스·손가락·스타일러스 모두 pointer 이벤트 하나로 받는다.
//  - 획을 점 배열로 쌓아 두고 매번 다시 그린다(되돌리기가 공짜로 된다).
//  - 결과는 PNG data URL 로 내보내고, 기록칸이 사진과 같은 경로로 올린다.

export type DrawBackground = "plain" | "grid" | "axes";

export const DRAW_BG_LABEL: Record<DrawBackground, string> = {
  plain: "빈 종이",
  grid: "모눈",
  axes: "좌표평면",
};

type Pt = { x: number; y: number; w: number };
type Stroke = { color: string; width: number; erase: boolean; pts: Pt[] };

const COLORS = [
  { v: "#27272a", n: "검정" },
  { v: "#2563eb", n: "파랑" },
  { v: "#e11d48", n: "빨강" },
  { v: "#059669", n: "초록" },
  { v: "#d97706", n: "주황" },
];
const WIDTHS = [
  { v: 2, n: "가늘게" },
  { v: 4, n: "보통" },
  { v: 8, n: "굵게" },
];

// 내부 해상도 — 화면보다 크게 잡아야 확대해도 깨지지 않는다
const W = 1200;
const H = 800;

/** 배경(모눈·좌표평면)을 그린다. 내보내기와 화면 표시가 같은 그림을 쓰도록 따로 뺐다. */
function paintBackground(c: CanvasRenderingContext2D, bg: DrawBackground) {
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, W, H);
  if (bg === "plain") return;

  const step = 40;
  c.strokeStyle = "#e4e4e7";
  c.lineWidth = 1;
  c.beginPath();
  for (let x = 0; x <= W; x += step) {
    c.moveTo(x + 0.5, 0);
    c.lineTo(x + 0.5, H);
  }
  for (let y = 0; y <= H; y += step) {
    c.moveTo(0, y + 0.5);
    c.lineTo(W, y + 0.5);
  }
  c.stroke();

  if (bg === "axes") {
    const cx = Math.round(W / 2);
    const cy = Math.round(H / 2);
    c.strokeStyle = "#a1a1aa";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, cy + 0.5);
    c.lineTo(W, cy + 0.5);
    c.moveTo(cx + 0.5, 0);
    c.lineTo(cx + 0.5, H);
    c.stroke();
    // 눈금
    c.fillStyle = "#71717a";
    c.font = "13px system-ui, sans-serif";
    c.textAlign = "center";
    c.textBaseline = "top";
    for (let x = cx + step, n = 1; x < W; x += step, n++) {
      c.fillText(String(n), x, cy + 6);
      c.fillText(String(-n), cx - (x - cx), cy + 6);
    }
    c.textAlign = "right";
    c.textBaseline = "middle";
    for (let y = cy - step, n = 1; y > 0; y -= step, n++) {
      c.fillText(String(n), cx - 6, y);
      c.fillText(String(-n), cx - 6, cy + (cy - y));
    }
    c.fillStyle = "#71717a";
    c.textAlign = "right";
    c.textBaseline = "top";
    c.fillText("O", cx - 6, cy + 6);
  }
}

function paintStrokes(c: CanvasRenderingContext2D, strokes: Stroke[]) {
  c.lineCap = "round";
  c.lineJoin = "round";
  for (const s of strokes) {
    if (s.pts.length === 0) continue;
    // 지우개는 '흰 펜' 이 아니라 실제로 지운다(모눈 배경까지 뚫리지 않도록
    // 배경은 따로 칠하므로, 획 레이어에서만 지우면 된다)
    c.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
    c.strokeStyle = s.color;
    if (s.pts.length === 1) {
      const p = s.pts[0];
      c.beginPath();
      c.arc(p.x, p.y, Math.max(p.w, s.width) / 2, 0, Math.PI * 2);
      c.fillStyle = s.color;
      c.fill();
      continue;
    }
    for (let i = 1; i < s.pts.length; i++) {
      const a = s.pts[i - 1];
      const b = s.pts[i];
      c.lineWidth = b.w;
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
      c.stroke();
    }
  }
  c.globalCompositeOperation = "source-over";
}

export default function DrawPad({
  background = "plain",
  initial,
  onCancel,
  onSave,
}: {
  background?: DrawBackground;
  /** 다시 열었을 때 이어 그릴 밑그림 (data URL) */
  initial?: string | null;
  onCancel: () => void;
  onSave: (dataUrl: string) => void;
}) {
  const viewRef = useRef<HTMLCanvasElement>(null); // 눈에 보이는 캔버스
  const inkRef = useRef<HTMLCanvasElement | null>(null); // 획만 담는 레이어
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef<Stroke | null>(null);
  const baseRef = useRef<HTMLImageElement | null>(null); // 이어 그리기용 밑그림

  const [color, setColor] = useState(COLORS[0].v);
  const [width, setWidth] = useState(WIDTHS[1].v);
  const [erase, setErase] = useState(false);
  const [count, setCount] = useState(0); // 되돌리기 버튼 활성화용

  // 획 레이어를 한 번만 만든다
  if (!inkRef.current && typeof document !== "undefined") {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    inkRef.current = c;
  }

  const repaint = useCallback(() => {
    const view = viewRef.current;
    const ink = inkRef.current;
    if (!view || !ink) return;

    // ① 획 레이어
    const ic = ink.getContext("2d");
    if (!ic) return;
    ic.clearRect(0, 0, W, H);
    paintStrokes(ic, strokesRef.current);

    // ② 화면 = 배경 + 밑그림 + 획
    const vc = view.getContext("2d");
    if (!vc) return;
    paintBackground(vc, background);
    if (baseRef.current) vc.drawImage(baseRef.current, 0, 0, W, H);
    vc.drawImage(ink, 0, 0);
  }, [background]);

  // 밑그림 불러오기
  useEffect(() => {
    if (!initial) {
      repaint();
      return;
    }
    const img = new Image();
    img.onload = () => {
      baseRef.current = img;
      repaint();
    };
    img.onerror = () => repaint();
    img.src = initial;
  }, [initial, repaint]);

  function toCanvas(e: React.PointerEvent<HTMLCanvasElement>) {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * W,
      y: ((e.clientY - r.top) / r.height) * H,
    };
  }

  function penWidth(e: React.PointerEvent<HTMLCanvasElement>) {
    // 스타일러스 필압이 오면 굵기에 반영한다(없으면 0.5 로 들어온다)
    const p = e.pressure > 0 && e.pressure !== 0.5 ? e.pressure : 0.5;
    const base = erase ? width * 3 : width;
    return base * (0.6 + p * 0.8);
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = toCanvas(e);
    drawingRef.current = {
      color,
      width: erase ? width * 3 : width,
      erase,
      pts: [{ x, y, w: penWidth(e) }],
    };
    strokesRef.current = [...strokesRef.current, drawingRef.current];
    setCount(strokesRef.current.length);
    repaint();
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const cur = drawingRef.current;
    if (!cur) return;
    const { x, y } = toCanvas(e);
    const last = cur.pts[cur.pts.length - 1];
    // 너무 촘촘한 점은 버린다(획이 무거워지는 것 방지)
    if (last && Math.hypot(x - last.x, y - last.y) < 1.2) return;
    cur.pts.push({ x, y, w: penWidth(e) });
    repaint();
  }

  function onUp(e: React.PointerEvent<HTMLCanvasElement>) {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* 이미 풀렸으면 무시 */
    }
    drawingRef.current = null;
  }

  function undo() {
    strokesRef.current = strokesRef.current.slice(0, -1);
    setCount(strokesRef.current.length);
    repaint();
  }

  function clearAll() {
    strokesRef.current = [];
    baseRef.current = null;
    setCount(0);
    repaint();
  }

  function save() {
    const out = document.createElement("canvas");
    out.width = W;
    out.height = H;
    const c = out.getContext("2d");
    if (!c) return;
    paintBackground(c, background);
    if (baseRef.current) c.drawImage(baseRef.current, 0, 0, W, H);
    if (inkRef.current) c.drawImage(inkRef.current, 0, 0);
    // 선과 모눈처럼 경계가 또렷한 그림은 JPEG 이 가장 나쁘다(모눈 한 장에 66KB).
    // WebP 가 같은 그림을 15KB 로 줄인다. 안 되는 브라우저에서는 PNG(43KB)로 떨어진다.
    let url = out.toDataURL("image/webp", 0.9);
    if (!url.startsWith("data:image/webp")) url = out.toDataURL("image/png");
    onSave(url);
  }

  const nothingDrawn = count === 0 && !baseRef.current;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-300 bg-white p-3">
      {/* 도구 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c.v}
              type="button"
              onClick={() => {
                setColor(c.v);
                setErase(false);
              }}
              aria-label={c.n}
              aria-pressed={!erase && color === c.v}
              title={c.n}
              className={`h-7 w-7 rounded-full border-2 transition ${
                !erase && color === c.v
                  ? "border-zinc-900 scale-110"
                  : "border-zinc-200 hover:border-zinc-400"
              }`}
              style={{ background: c.v }}
            />
          ))}
        </div>

        <div className="flex items-center gap-1">
          {WIDTHS.map((w) => (
            <button
              key={w.v}
              type="button"
              onClick={() => setWidth(w.v)}
              aria-pressed={width === w.v}
              title={w.n}
              className={`flex h-7 w-9 items-center justify-center rounded-md border text-xs ${
                width === w.v
                  ? "border-blue-600 bg-blue-50"
                  : "border-zinc-300 bg-white hover:bg-zinc-50"
              }`}
            >
              <span
                className="rounded-full bg-zinc-800"
                style={{ width: w.v + 2, height: w.v + 2 }}
              />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setErase((v) => !v)}
          aria-pressed={erase}
          className={`rounded-md border px-2.5 py-1.5 text-sm ${
            erase
              ? "border-blue-600 bg-blue-50 text-blue-700"
              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          지우개
        </button>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={undo}
            disabled={count === 0}
            className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
          >
            되돌리기
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={nothingDrawn}
            className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
          >
            전부 지우기
          </button>
        </div>
      </div>

      {/* 그리는 곳 */}
      <canvas
        ref={viewRef}
        width={W}
        height={H}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={onUp}
        className="w-full cursor-crosshair rounded-md border border-zinc-200 bg-white"
        style={{ touchAction: "none", aspectRatio: `${W} / ${H}` }}
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={nothingDrawn}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Icon name="check" /> 그림 넣기
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          취소
        </button>
        <span className="text-xs text-zinc-500">
          손가락·펜·마우스 모두 됩니다. 넣은 뒤에도 다시 그릴 수 있어요.
        </span>
      </div>
    </div>
  );
}
