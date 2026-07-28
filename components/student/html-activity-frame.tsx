"use client";

import { useEffect, useRef, useState } from "react";

// 활동 HTML 안에 주입하는 높이 보고 스크립트.
// iframe 은 sandbox="allow-scripts" (allow-same-origin 없음) 이라 부모가 내부 문서를 읽을 수 없다.
// 그래서 안쪽에서 실제 콘텐츠 높이를 재어 postMessage 로 알려 준다.
const HEIGHT_REPORTER = `
<script>
(function () {
  // documentElement/scrollHeight 는 "뷰포트 높이"만큼 부풀기 때문에 쓰지 않는다.
  // (부모가 그 값으로 iframe 을 키우면 다음 측정이 또 커지는 되먹임이 생긴다)
  // 실제 콘텐츠의 바닥 위치만 잰다.
  function measure() {
    var b = document.body;
    if (!b) return 0;
    var max = 0, kids = b.children;
    for (var i = 0; i < kids.length; i++) {
      var r = kids[i].getBoundingClientRect();
      if (r.height > 0) {
        var bottom = r.bottom + (window.pageYOffset || 0);
        if (bottom > max) max = bottom;
      }
    }
    var cs = window.getComputedStyle(b);
    max += (parseFloat(cs.paddingBottom) || 0) + (parseFloat(cs.marginBottom) || 0);
    return Math.ceil(max);
  }
  var prev = 0;
  function send() {
    // 아직 레이아웃 전이거나 숨겨져 폭이 0이면 줄바꿈이 극단적으로 일어나 높이가 폭발한다.
    // 폭이 제대로 잡힌 뒤에만 보고한다(폭이 생기면 ResizeObserver 가 다시 부른다).
    if (!document.body || document.body.clientWidth < 50) return;
    var h = measure();
    if (h > 0 && Math.abs(h - prev) > 2) {
      prev = h;
      parent.postMessage({ __activityHeight: h }, "*");
    }
  }
  document.addEventListener("DOMContentLoaded", send);
  window.addEventListener("load", send);
  window.addEventListener("resize", send);
  // 화면 전환(스테퍼)·슬라이더 조작으로 내용이 바뀌는 즉시 반영
  document.addEventListener("click", function () { setTimeout(send, 60); }, true);
  document.addEventListener("input", function () { setTimeout(send, 60); }, true);
  if (window.ResizeObserver) {
    try { new ResizeObserver(send).observe(document.documentElement); } catch (e) {}
  }
  setTimeout(send, 100);
  setTimeout(send, 400);
})();
<\/script>`;

export default function HtmlActivityFrame({
  html,
  title,
  initialHeight,
}: {
  html: string;
  title: string;
  initialHeight?: number;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  // 스크립트가 높이를 알려 주기 전까지 쓰는 임시 높이
  const [height, setHeight] = useState<number>(initialHeight ?? 600);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const frame = ref.current;
      if (!frame || event.source !== frame.contentWindow) return; // 우리 iframe 이 보낸 것만
      const data = event.data as { __activityHeight?: unknown } | null;
      const value = data && typeof data === "object" ? data.__activityHeight : null;
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        setHeight(Math.ceil(value));
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <iframe
      ref={ref}
      srcDoc={html + HEIGHT_REPORTER}
      sandbox="allow-scripts"
      scrolling="no"
      style={{ height }}
      className="w-full rounded-lg border border-zinc-200 bg-white transition-[height] duration-200"
      title={title}
    />
  );
}
