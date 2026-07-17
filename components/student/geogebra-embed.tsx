"use client";

import { useEffect, useRef } from "react";

// deployggb.js의 GGBApplet 최소 타입
type GGBAppletCtor = new (
  params: Record<string, unknown>,
  html5NoWebSimple?: boolean
) => { inject: (el: HTMLElement) => void };

declare global {
  interface Window {
    GGBApplet?: GGBAppletCtor;
  }
}

const SCRIPT_SRC = "https://www.geogebra.org/apps/deployggb.js";

export default function GeoGebraEmbed({
  materialId,
  height,
}: {
  materialId: string;
  height: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    function inject() {
      const el = containerRef.current;
      if (cancelled || !el || !window.GGBApplet) return;
      el.innerHTML = "";
      const applet = new window.GGBApplet(
        {
          material_id: materialId,
          width: el.clientWidth,
          height,
          showMenuBar: false,
          showToolBar: false,
          showAlgebraInput: false,
          enableShiftDragZoom: true,
          showFullscreenButton: true,
        },
        true
      );
      applet.inject(el);
    }

    if (window.GGBApplet) {
      inject();
    } else {
      // 스크립트는 한 번만 로드하고, 이미 로딩 중이면 onload에 편승한다
      let script = document.querySelector<HTMLScriptElement>(
        `script[src="${SCRIPT_SRC}"]`
      );
      if (!script) {
        script = document.createElement("script");
        script.src = SCRIPT_SRC;
        script.async = true;
        document.body.appendChild(script);
      }
      script.addEventListener("load", inject);
      return () => {
        cancelled = true;
        script?.removeEventListener("load", inject);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [materialId, height]);

  return (
    <div
      ref={containerRef}
      style={{ minHeight: height }}
      className="w-full overflow-hidden rounded-lg border border-zinc-200 bg-white"
    />
  );
}
