"use client";

import { useRef, useState } from "react";
import type { PlaneConfig } from "@/lib/screens";

// 좌표평면 화면 — 설정(PlaneConfig)만으로 그린다. 활동마다 코드를 새로 쓰지 않기 위한 것.
// 활동 HTML 마다 복사돼 있던 Plane 헬퍼를 여기 한 곳으로 모았다.
const SIZE = 400;
const PAD = 28;

function fmt(v: number): string {
  const r = Math.round(v * 100) / 100;
  return String(r === 0 ? 0 : r);
}

export default function PlaneCanvas({ config }: { config: PlaneConfig }) {
  const { min, max, grid } = config;
  const [pts, setPts] = useState(() =>
    Object.fromEntries(config.points.map((p) => [p.name, { x: p.x, y: p.y }]))
  );
  const [dragging, setDragging] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const scale = (SIZE - 2 * PAD) / (max - min);
  const px = (x: number) => PAD + (x - min) * scale;
  const py = (y: number) => SIZE - PAD - (y - min) * scale;

  function toData(e: React.PointerEvent) {
    const r = svgRef.current!.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * SIZE;
    const sy = ((e.clientY - r.top) / r.height) * SIZE;
    const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v)));
    return { x: clamp(min + (sx - PAD) / scale), y: clamp(min + (SIZE - PAD - sy) / scale) };
  }

  const ticks: number[] = [];
  for (let g = Math.ceil(min); g <= max; g++) ticks.push(g);

  const at = (name: string) => pts[name] ?? { x: 0, y: 0 };
  const dist = (a: string, b: string) => Math.hypot(at(a).x - at(b).x, at(a).y - at(b).y);

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_220px]">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full touch-none select-none rounded-xl border border-zinc-200 bg-white"
        onPointerMove={(e) => {
          if (!dragging) return;
          const p = toData(e);
          setPts((prev) => ({ ...prev, [dragging]: p }));
        }}
        onPointerUp={() => setDragging(null)}
        onPointerLeave={() => setDragging(null)}
      >
        {grid &&
          ticks.map((g) => (
            <g key={`g${g}`}>
              <line x1={px(g)} y1={py(min)} x2={px(g)} y2={py(max)} stroke="#f1f5f9" />
              <line x1={px(min)} y1={py(g)} x2={px(max)} y2={py(g)} stroke="#f1f5f9" />
            </g>
          ))}
        <line x1={px(min)} y1={py(0)} x2={px(max)} y2={py(0)} stroke="#cbd5e1" strokeWidth={1.5} />
        <line x1={px(0)} y1={py(min)} x2={px(0)} y2={py(max)} stroke="#cbd5e1" strokeWidth={1.5} />

        {config.lines.map((l, i) => (
          <line
            key={`l${i}`}
            x1={px(min)}
            y1={py(l.m * min + l.n)}
            x2={px(max)}
            y2={py(l.m * max + l.n)}
            stroke={l.color ?? "#2563eb"}
            strokeWidth={2.5}
          />
        ))}

        {config.circles.map((c, i) => (
          <circle
            key={`c${i}`}
            cx={px(at(c.center).x)}
            cy={py(at(c.center).y)}
            r={c.r * scale}
            fill="none"
            stroke={c.color ?? "#7c3aed"}
            strokeWidth={2.5}
          />
        ))}

        {config.segments.map((s, i) => (
          <g key={`s${i}`}>
            <line
              x1={px(at(s.from).x)}
              y1={py(at(s.from).y)}
              x2={px(at(s.to).x)}
              y2={py(at(s.to).y)}
              stroke={s.color ?? "#2563eb"}
              strokeWidth={3}
              strokeLinecap="round"
            />
            {s.label && (
              <text
                x={(px(at(s.from).x) + px(at(s.to).x)) / 2}
                y={(py(at(s.from).y) + py(at(s.to).y)) / 2 - 8}
                fontSize={12.5}
                fontWeight={700}
                fill={s.color ?? "#2563eb"}
                textAnchor="middle"
              >
                {fmt(dist(s.from, s.to))}
              </text>
            )}
          </g>
        ))}

        {config.points.map((p) => {
          const cur = at(p.name);
          return (
            <g key={p.name}>
              {p.draggable && (
                <circle
                  cx={px(cur.x)}
                  cy={py(cur.y)}
                  r={12}
                  fill={p.color ?? "#2563eb"}
                  fillOpacity={0.18}
                  stroke={p.color ?? "#2563eb"}
                  strokeWidth={2}
                  style={{ cursor: "grab" }}
                  onPointerDown={(e) => {
                    (e.target as Element).setPointerCapture?.(e.pointerId);
                    setDragging(p.name);
                  }}
                />
              )}
              <circle cx={px(cur.x)} cy={py(cur.y)} r={4.5} fill={p.color ?? "#2563eb"} />
              <text
                x={px(cur.x) + 9}
                y={py(cur.y) - 8}
                fontSize={12.5}
                fontWeight={700}
                fill={p.color ?? "#2563eb"}
              >
                {p.name}({fmt(cur.x)}, {fmt(cur.y)})
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex flex-col gap-2 text-sm">
        {config.points.some((p) => p.draggable) && (
          <p className="text-xs text-zinc-500">점을 끌어 움직여 보세요.</p>
        )}
        {config.readouts.map((r) => (
          <div key={r} className="rounded-lg border border-zinc-200 bg-white p-3">
            {r === "distance" &&
              config.segments.map((s, i) => (
                <p key={i}>
                  {s.from}
                  {s.to} = <b className="text-blue-600">{fmt(dist(s.from, s.to))}</b>
                </p>
              ))}
            {r === "slope" &&
              config.segments.map((s, i) => {
                const dx = at(s.to).x - at(s.from).x;
                const dy = at(s.to).y - at(s.from).y;
                return (
                  <p key={i}>
                    {s.from}
                    {s.to} 기울기 ={" "}
                    <b className="text-blue-600">{dx === 0 ? "없음" : fmt(dy / dx)}</b>
                  </p>
                );
              })}
            {r === "midpoint" &&
              config.segments.map((s, i) => (
                <p key={i}>
                  {s.from}
                  {s.to} 중점 ={" "}
                  <b className="text-blue-600">
                    ({fmt((at(s.from).x + at(s.to).x) / 2)},{" "}
                    {fmt((at(s.from).y + at(s.to).y) / 2)})
                  </b>
                </p>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
