"use client";

import { useEffect, useRef, useState } from "react";

// 활동 HTML 이 지금 어느 화면을 보여 주고 있는지 (기록칸 질문을 고르는 데 쓴다)
export type ScreenInfo = {
  index: number;
  total: number;
  key: string;
  prompt: string;   // 빈 문자열이면 그 화면에는 기록칸을 두지 않는다
  photo: boolean;   // 사진 첨부 허용 화면인가
  title: string;
  hasPrompts: boolean; // 이 활동 HTML 이 화면별 질문을 갖고 있는가(옛 활동 구분용)
};

// 활동 HTML 안에 주입하는 다리(bridge) 스크립트.
// iframe 은 sandbox="allow-scripts" (allow-same-origin 없음) 이라 부모가 내부 문서를 읽을 수 없다.
// 그래서 안쪽에서 ① 실제 콘텐츠 높이 ② 지금 열린 화면 정보를 재어 postMessage 로 알려 준다.
const FRAME_BRIDGE = `
<script>
(function () {
  // ── ① 높이 보고 ─────────────────────────────────────────────
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
  function sendHeight() {
    // 아직 레이아웃 전이거나 숨겨져 폭이 0이면 줄바꿈이 극단적으로 일어나 높이가 폭발한다.
    // 폭이 제대로 잡힌 뒤에만 보고한다(폭이 생기면 ResizeObserver 가 다시 부른다).
    if (!document.body || document.body.clientWidth < 50) return;
    var h = measure();
    if (h > 0 && Math.abs(h - prev) > 2) {
      prev = h;
      parent.postMessage({ __activityHeight: h }, "*");
    }
  }

  // ── ② 화면 보고 ─────────────────────────────────────────────
  // 활동 HTML 의 스테퍼는 보이는 화면에만 .on 을 붙인다.
  // 질문은 그 <section> 의 data-prompt 에 적혀 있다(없으면 기록칸을 띄우지 않는다).
  function heading(el) {
    var h = el.querySelector("h1");
    return h ? (h.textContent || "").trim() : "";
  }
  var prevKey = null;
  function sendScreen() {
    var all = document.querySelectorAll(".screen");
    if (!all.length) return;
    var cur = null, idx = 0;
    for (var i = 0; i < all.length; i++) {
      if (all[i].classList.contains("on")) { cur = all[i]; idx = i; break; }
    }
    if (!cur) return;
    var key = cur.getAttribute("data-key") || ("screen-" + (idx + 1));
    var info = {
      index: idx,
      total: all.length,
      key: key,
      prompt: cur.getAttribute("data-prompt") || "",
      photo: cur.getAttribute("data-photo") === "1",
      title: heading(cur),
      hasPrompts: !!document.querySelector(".screen[data-prompt]")
    };
    // 같은 화면을 반복해서 알리지 않는다(부모의 입력 중 리렌더 방지)
    if (key === prevKey) return;
    prevKey = key;
    parent.postMessage({ __activityScreen: info }, "*");
  }

  function send() { sendHeight(); sendScreen(); }

  document.addEventListener("DOMContentLoaded", send);
  window.addEventListener("load", send);
  window.addEventListener("resize", sendHeight);
  // 화면 전환(스테퍼)·슬라이더 조작으로 내용이 바뀌는 즉시 반영
  document.addEventListener("click", function () { setTimeout(send, 60); }, true);
  document.addEventListener("input", function () { setTimeout(sendHeight, 60); }, true);
  if (window.ResizeObserver) {
    try { new ResizeObserver(sendHeight).observe(document.documentElement); } catch (e) {}
  }
  // 키보드 조작 등 클릭이 아닌 경로로 화면이 바뀌는 경우까지 잡는다
  if (window.MutationObserver) {
    try {
      new MutationObserver(function () { setTimeout(send, 0); }).observe(document.body, {
        attributes: true, attributeFilter: ["class"], subtree: true
      });
    } catch (e) {}
  }
  setTimeout(send, 100);
  setTimeout(send, 400);
})();
<\/script>`;

export default function HtmlActivityFrame({
  html,
  title,
  initialHeight,
  onScreen,
}: {
  html: string;
  title: string;
  initialHeight?: number;
  onScreen?: (info: ScreenInfo) => void;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  // 스크립트가 높이를 알려 주기 전까지 쓰는 임시 높이
  const [height, setHeight] = useState<number>(initialHeight ?? 600);
  // onScreen 이 매 렌더 새 함수여도 리스너를 다시 달지 않도록 ref 로 들고 있는다
  const onScreenRef = useRef(onScreen);
  onScreenRef.current = onScreen;

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const frame = ref.current;
      if (!frame || event.source !== frame.contentWindow) return; // 우리 iframe 이 보낸 것만
      const data = event.data as
        | { __activityHeight?: unknown; __activityScreen?: unknown }
        | null;
      if (!data || typeof data !== "object") return;

      const value = data.__activityHeight;
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        setHeight(Math.ceil(value));
      }

      const screen = data.__activityScreen as ScreenInfo | undefined;
      if (screen && typeof screen === "object" && typeof screen.key === "string") {
        onScreenRef.current?.({
          index: Number(screen.index) || 0,
          total: Number(screen.total) || 0,
          key: String(screen.key).slice(0, 40),
          prompt: String(screen.prompt ?? "").slice(0, 1000),
          photo: !!screen.photo,
          title: String(screen.title ?? "").slice(0, 120),
          hasPrompts: !!screen.hasPrompts,
        });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <iframe
      ref={ref}
      srcDoc={html + FRAME_BRIDGE}
      sandbox="allow-scripts"
      scrolling="no"
      style={{ height }}
      className="w-full rounded-lg border border-zinc-200 bg-white transition-[height] duration-200"
      title={title}
    />
  );
}
