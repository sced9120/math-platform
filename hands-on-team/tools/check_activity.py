"""만져보는 수학 활동 자동 점검 (오르빗·제작자가 함께 쓴다)

    python3 hands-on-team/tools/check_activity.py content/hands-on/<slug>.html [--out DIR]

실제 사이트처럼 sandbox="allow-scripts" iframe(srcdoc) 안에 활동을 띄우고
PC(1280×800)·모바일(390×844) 두 화면에서 다음을 확인한다.
  1. 정적 검사: 외부 요청 주소, localStorage/sessionStorage, alert/confirm/prompt, $hands_on$ 태그
  2. 실행 오류: console.error, 잡히지 않은 예외
  3. 외부 네트워크 요청 시도
  4. 조작 스모크 테스트: 버튼 모두 누르기, range 입력 최솟값·최댓값, 캔버스/SVG 끌기
  5. 화면 넘침: 가로 스크롤 발생 여부
결과는 JSON 으로 출력하고, 스크린샷을 --out 폴더(기본: hands-on-team/drafts/<slug>/)에 남긴다.
종료 코드: 0 통과, 1 실패(문제 목록은 JSON 의 problems).
"""
import json
import os
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def find_chrome():
    for p in (os.environ.get("CHROME_PATH"), shutil.which("google-chrome"),
              shutil.which("chromium"), shutil.which("chromium-browser")):
        if p and Path(p).exists():
            return p
    return None  # playwright 가 내려받은 chromium 을 쓴다


def static_checks(html: str):
    probs = []
    for m in re.finditer(r"""(?:src|href)\s*=\s*["'](https?:)?//[^"']+""", html):
        probs.append(f"외부 자원 참조: {m.group(0)[:80]}")
    if re.search(r"\b(fetch|XMLHttpRequest)\s*\(", html):
        probs.append("네트워크 요청 코드(fetch/XMLHttpRequest)가 있음")
    if re.search(r"\b(localStorage|sessionStorage|indexedDB)\b", html):
        probs.append("브라우저 저장소 사용 — 샌드박스 iframe 에서 예외가 납니다")
    if re.search(r"\b(alert|confirm|prompt)\s*\(", html):
        probs.append("alert/confirm/prompt 사용 — 샌드박스에서 막힙니다")
    if "$hands_on$" in html:
        probs.append("$hands_on$ 문자열이 있어 SQL 로 감쌀 수 없음")
    if "<title>" not in html:
        probs.append("<title> 없음")
    return probs


WRAPPER = """<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0}iframe{border:0;width:100%;height:%HEIGHT%px;display:block}</style>
</head><body><iframe id="f" sandbox="allow-scripts"></iframe>
<script>document.getElementById('f').srcdoc = %SRC%;</script></body></html>"""


def run(path: Path, out: Path, height: int):
    from playwright.sync_api import sync_playwright

    html = path.read_text(encoding="utf-8")
    report = {"file": str(path), "bytes": len(html.encode()), "problems": [], "views": {}}
    report["problems"] += static_checks(html)
    out.mkdir(parents=True, exist_ok=True)
    wrapper = WRAPPER.replace("%HEIGHT%", str(height)).replace("%SRC%", json.dumps(html).replace("</", "<\\/").replace("<!--", "<\\!--"))

    with sync_playwright() as p:
        chrome = find_chrome()
        browser = p.chromium.launch(executable_path=chrome) if chrome else p.chromium.launch()
        for name, vp, touch in (("pc", {"width": 1280, "height": 800}, False),
                                ("mobile", {"width": 390, "height": 844}, True)):
            ctx = browser.new_context(viewport=vp, has_touch=touch, is_mobile=touch)
            page = ctx.new_page()
            errors, external = [], []
            page.on("console", lambda m, e=errors: m.type == "error" and e.append(m.text[:200]))
            page.on("pageerror", lambda ex, e=errors: e.append(f"예외: {str(ex)[:200]}"))
            page.on("request", lambda r, x=external: r.url.startswith("http") and x.append(r.url[:120]))
            page.set_content(wrapper, wait_until="load")
            page.wait_for_timeout(800)
            frame = next((f for f in page.frames if f != page.main_frame), None)
            view = {"buttons": 0, "ranges": 0, "drags": 0}
            if frame is None:
                report["problems"].append(f"[{name}] iframe 을 찾지 못함")
                ctx.close()
                continue
            page.screenshot(path=str(out / f"{name}-start.png"), full_page=True)

            # 조작 스모크 테스트
            for b in frame.query_selector_all("button")[:60]:
                try:
                    if b.is_visible() and b.is_enabled():
                        b.click(timeout=1500)
                        view["buttons"] += 1
                except Exception:
                    pass
            for r in frame.query_selector_all("input[type=range]")[:20]:
                try:
                    r.evaluate("""el => { for (const v of [el.min || 0, el.max || 100, (+el.min + +el.max) / 2]) {
                        el.value = v; el.dispatchEvent(new Event('input', {bubbles:true}));
                        el.dispatchEvent(new Event('change', {bubbles:true})); } }""")
                    view["ranges"] += 1
                except Exception:
                    pass
            for c in frame.query_selector_all("canvas, svg")[:4]:
                try:
                    bb = c.bounding_box()
                    if not bb or bb["width"] < 40 or bb["height"] < 40:
                        continue
                    x0, y0 = bb["x"] + bb["width"] * 0.3, bb["y"] + bb["height"] * 0.5
                    page.mouse.move(x0, y0)
                    page.mouse.down()
                    for i in range(1, 8):
                        page.mouse.move(x0 + i * bb["width"] * 0.05, y0 - i * 4)
                    page.mouse.up()
                    view["drags"] += 1
                except Exception:
                    pass
            page.wait_for_timeout(400)
            overflow = frame.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
            if overflow > 4:
                report["problems"].append(f"[{name}] 가로 넘침 {overflow}px")
            visible_text = frame.evaluate("() => (document.body && document.body.innerText || '').trim().length")
            if visible_text < 20:
                report["problems"].append(f"[{name}] 화면에 보이는 글자가 거의 없음")
            page.screenshot(path=str(out / f"{name}-after.png"), full_page=True)
            for e in errors:
                report["problems"].append(f"[{name}] 실행 오류: {e}")
            for u in external:
                report["problems"].append(f"[{name}] 외부 요청: {u}")
            view["errors"] = len(errors)
            report["views"][name] = view
            ctx.close()
        browser.close()
    report["passed"] = not report["problems"]
    report["screenshots"] = sorted(str(p) for p in out.glob("*.png"))
    return report


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    target = Path(sys.argv[1]).resolve()
    out = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else ROOT / "hands-on-team" / "drafts" / target.stem
    height = int(sys.argv[sys.argv.index("--height") + 1]) if "--height" in sys.argv else 660
    result = run(target, out, height)
    print(json.dumps(result, ensure_ascii=False, indent=1))
    sys.exit(0 if result["passed"] else 1)
