"""오르빗 승인함 페이지 만들기 (아침 브리핑이 쓴다)

    python3 hands-on-team/tools/build_inbox.py [--out hands-on-team/inbox/index.html]

queue.json 에서 승인 대기(awaiting_ok)·선생님 확인(needs_teacher) 항목을 모아
활동을 실제 사이트와 같은 샌드박스 iframe 으로 직접 만져 볼 수 있는 한 페이지를 만든다.
출력 파일을 Artifact 로 publish 한다(주소는 state.json 의 inbox_artifact_url).
마지막 줄에 JSON 요약(대기 개수 등)을 출력한다.
"""
import html
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TEAM = ROOT / "hands-on-team"
KST = timezone(timedelta(hours=9))

STATUS = {
    "awaiting_ok": ("승인 대기", "wait"),
    "needs_teacher": ("선생님 확인 필요", "warn"),
}


def esc(s):
    return html.escape(str(s or ""), quote=True)


def progress(items):
    rows = []
    for subj in dict.fromkeys(i["subject"] for i in items):
        group = [i for i in items if i["subject"] == subj]
        done = sum(i["status"] == "published" for i in group)
        rows.append(f"{subj} {done}/{len(group)}")
    return " · ".join(rows)


def card(it):
    label, cls = STATUS[it["status"]]
    slug = it.get("slug")
    src = ROOT / "content" / "hands-on" / f"{slug}.html" if slug else None
    activity = src.read_text(encoding="utf-8") if src and src.exists() else ""
    height = int(it.get("height") or 660)
    summary = it.get("orbit_summary") or it.get("notes") or "오르빗 보고가 없습니다."
    levels = it.get("levels_used") or {}
    level_txt = " · ".join(f"{k} {v}" for k, v in levels.items()) if isinstance(levels, dict) else str(levels)
    ok_text = f"OK {it['id']}"
    fix_text = f"수정 {it['id']}: "
    payload = json.dumps(activity).replace("</", "<\\/")
    frame = (
        f'<div class="frame"><iframe title="{esc(it.get("title") or it["id"])} 미리보기" '
        f'sandbox="allow-scripts" style="height:{height}px" data-src="act-{esc(it["id"])}"></iframe></div>'
        f'<script type="application/json" id="act-{esc(it["id"])}">'
        f'{payload}</script>'
        if activity else '<p class="muted">활동 파일이 아직 없습니다.</p>'
    )
    return f"""
<article class="item" id="{esc(it['id'])}">
  <header class="item-head">
    <div class="item-title">
      <span class="pill {cls}">{label}</span>
      <h2>{esc(it.get('title') or it['standard'])}</h2>
      <p class="std"><span class="code">{esc(it['code'])}</span> {esc(it['standard'])}</p>
      <p class="meta">{esc(it['subject'])} · {esc(it['unit'])}{(' · ' + esc(slug)) if slug else ''}</p>
    </div>
    <div class="actions">
      <button type="button" class="copy primary" data-copy="{esc(ok_text)}">“{esc(ok_text)}” 복사</button>
      <button type="button" class="copy" data-copy="{esc(fix_text)}">수정 요청 문구 복사</button>
    </div>
  </header>
  <div class="body">
    <section class="report" aria-label="오르빗 보고">
      <h3>오르빗 보고</h3>
      <pre>{esc(summary)}</pre>
      {f'<p class="levels">투입 수준 · {esc(level_txt)}</p>' if level_txt else ''}
    </section>
    <section class="try" aria-label="직접 만져 보기">
      <h3>직접 만져 보기</h3>
      {frame}
    </section>
  </div>
</article>"""


PAGE = """<title>오르빗 승인함</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;600&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
/* 레이아웃: 위에 오늘 요약 한 줄, 아래로 활동 카드 — 카드마다 오르빗 보고(왼쪽)와 실제 활동(오른쪽), 좁으면 위아래 */
:root {
  --paper: #f6f3ec; --sheet: #fffdf8; --ink: #23211d; --muted: #6b665c; --line: #ddd6c8;
  --orange: #d9631e; --orange-ink: #ffffff; --wait-bg: #fbe7d9; --wait-fg: #8a3a0c;
  --warn-bg: #f6e3e1; --warn-fg: #8f2a22;
  --font-body: "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --paper: #1b1a17; --sheet: #24221e; --ink: #ece7dc; --muted: #a39d90; --line: #3a3731;
  --orange: #f08a4b; --orange-ink: #1b1a17; --wait-bg: #4a2d1b; --wait-fg: #f6c7a6;
  --warn-bg: #4a2422; --warn-fg: #f2b9b3; color-scheme: dark } }
:root[data-theme="dark"] {
  --paper: #1b1a17; --sheet: #24221e; --ink: #ece7dc; --muted: #a39d90; --line: #3a3731;
  --orange: #f08a4b; --orange-ink: #1b1a17; --wait-bg: #4a2d1b; --wait-fg: #f6c7a6;
  --warn-bg: #4a2422; --warn-fg: #f2b9b3; color-scheme: dark }
body { background: var(--paper); color: var(--ink); font-family: var(--font-body); font-size: 15px; line-height: 1.6;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 20px 48px; }
.wrap { max-width: 1180px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
.top { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 12px; border-bottom: 2px solid var(--ink); padding-bottom: 12px; }
.top h1 { margin: 0; font-size: 26px; font-weight: 600; letter-spacing: -0.01em; text-wrap: balance; }
.top .when { margin: 2px 0 0; color: var(--muted); font-size: 13px; }
.howto { margin: 0; color: var(--muted); font-size: 13.5px; max-width: 60ch; }
.howto b { color: var(--ink); }
.tally { font-family: var(--font-mono); font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
.item { background: var(--sheet); border: 1px solid var(--line); border-radius: 6px; padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.item-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; }
.item-title { min-width: 0; flex: 1 1 320px; display: flex; flex-direction: column; gap: 4px; }
.item-title h2 { margin: 0; font-size: 19px; font-weight: 600; text-wrap: balance; }
.std, .meta { margin: 0; font-size: 13.5px; }
.meta { color: var(--muted); }
.code { font-family: var(--font-mono); font-size: 12.5px; color: var(--orange); }
.pill { align-self: flex-start; font-size: 12px; font-weight: 600; letter-spacing: .02em; padding: 2px 9px; border-radius: 999px; }
.pill.wait { background: var(--wait-bg); color: var(--wait-fg); }
.pill.warn { background: var(--warn-bg); color: var(--warn-fg); }
.actions { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8px; }
button.copy { font: inherit; font-size: 14px; padding: 9px 14px; border-radius: 6px; border: 1px solid var(--line); background: var(--sheet); color: var(--ink); cursor: pointer; }
button.copy.primary { background: var(--orange); border-color: var(--orange); color: var(--orange-ink); font-weight: 600; }
button.copy:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
.body { display: grid; grid-template-columns: minmax(0, 340px) minmax(0, 1fr); gap: 16px; }
@media (max-width: 860px) { .body { grid-template-columns: minmax(0, 1fr); } }
h3 { margin: 0 0 6px; font-size: 12px; font-weight: 600; letter-spacing: .06em; color: var(--muted); }
.report pre { margin: 0; white-space: pre-wrap; word-break: keep-all; overflow-wrap: anywhere; font-family: var(--font-body); font-size: 13.5px; line-height: 1.65; }
.levels { margin: 10px 0 0; font-size: 12.5px; color: var(--muted); }
.try { min-width: 0; }
.frame { border: 1px solid var(--line); border-radius: 4px; overflow: hidden; background: #fff; }
.frame iframe { display: block; width: 100%; border: 0; }
.muted, .empty { color: var(--muted); }
.empty { background: var(--sheet); border: 1px dashed var(--line); border-radius: 6px; padding: 28px 16px; text-align: center; }
.toast { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(16px + env(safe-area-inset-bottom, 0px)); background: var(--ink); color: var(--paper); padding: 8px 14px; border-radius: 6px; font-size: 14px; }
@media (prefers-reduced-motion: no-preference) { .toast { transition: opacity .2s; } }
</style>

<div class="wrap">
  <header class="top">
    <div>
      <h1>오르빗 승인함</h1>
      <p class="when">%WHEN% 기준 · 만져보는 수학</p>
    </div>
    <p class="tally">%TALLY%</p>
  </header>
  <p class="howto">직접 만져 보고 괜찮으면 <b>“OK 번호”</b>를 복사해 오르빗 아침 브리핑에 답장하세요. 여러 개는 “OK calc2-01-01, calc2-01-02”, 모두는 “OK 전부”. 고칠 점은 “수정 번호: 내용”으로 보내면 팀이 고친 뒤 다시 보여 드립니다.</p>
  %ITEMS%
</div>
<div class="toast" id="toast" role="status" hidden></div>

<script>
// 활동을 실제 사이트와 같은 sandbox="allow-scripts" iframe 으로 띄운다
document.querySelectorAll("iframe[data-src]").forEach(function (f) {
  var data = document.getElementById(f.getAttribute("data-src"));
  if (data) f.srcdoc = JSON.parse(data.textContent);
});
var toast = document.getElementById("toast"), timer;
function say(msg) { toast.textContent = msg; toast.hidden = false; clearTimeout(timer); timer = setTimeout(function () { toast.hidden = true; }, 1800); }
function fallbackSelect(text) {
  var t = document.createElement("textarea"); t.value = text; t.setAttribute("readonly", "");
  t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select();
  try { document.execCommand("copy"); say("복사했어요: " + text); } catch (e) { say("길게 눌러 직접 복사하세요: " + text); }
  document.body.removeChild(t);
}
document.querySelectorAll("button[data-copy]").forEach(function (b) {
  b.addEventListener("click", function () {
    var text = b.getAttribute("data-copy");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { say("복사했어요: " + text); }, function () { fallbackSelect(text); });
    } else { fallbackSelect(text); }
  });
});
</script>
"""


def build(out: Path):
    q = json.loads((TEAM / "queue.json").read_text(encoding="utf-8"))
    items = q["items"]
    pending = [i for i in items if i["status"] in STATUS]
    pending.sort(key=lambda i: (i["status"] != "awaiting_ok", items.index(i)))
    body = "\n".join(card(i) for i in pending) or (
        '<p class="empty">승인을 기다리는 활동이 없습니다. 밤 실행이 새 활동을 만들면 여기에 나타납니다.</p>')
    waiting = sum(i["status"] == "awaiting_ok" for i in pending)
    tally = f"승인 대기 {waiting} · 확인 필요 {len(pending) - waiting} · {progress(items)}"
    now = datetime.now(KST).strftime("%-m월 %-d일 %H:%M")
    page = PAGE.replace("%WHEN%", now).replace("%TALLY%", esc(tally)).replace("%ITEMS%", body)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page, encoding="utf-8")
    return {"out": str(out), "awaiting_ok": waiting, "needs_teacher": len(pending) - waiting,
            "ids": [i["id"] for i in pending], "bytes": len(page.encode())}


if __name__ == "__main__":
    out = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else TEAM / "inbox" / "index.html"
    print(json.dumps(build(out.resolve()), ensure_ascii=False))
