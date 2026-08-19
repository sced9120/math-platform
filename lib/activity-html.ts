// 활동 HTML 을 "화면" 단위로 뜯고 다시 붙인다.
// 교사가 UI 에서 화면 순서·질문·본문을 고칠 수 있게 하기 위한 것으로,
// 조작(SVG·슬라이더) 코드는 건드리지 않고 통째로 보존한다.
//
// 활동 HTML 의 생김새 (docs/04_HTML_ACTIVITY_PROMPT.md 참고)
//   …스타일·안내…  <div class="wrap"> <div class="steps"> 화면들… <div class="nav"> …  <script>…
//   화면 = <section class="screen" data-key data-prompt data-photo> … </section>
//   확장 탐구·자유 기록 화면은 <!-- EXT:START --> 같은 주석으로 감싸여 있다(스크립트가 찾는 표시).

export type ScreenBlock = {
  key: string;
  prompt: string;
  photo: boolean;
  heading: string; // 화면 제목(h1) — 목록에 보여 주기 위한 읽기 전용 값
  lead: string; // 화면 앞에 붙어 있던 주석 (EXT:START 등)
  open: string; // <section …> 여는 태그
  body: string; // 화면 내용
  tail: string; // 화면 뒤에 붙어 있던 주석 (EXT:END 등)
};

export type ParsedActivity = {
  before: string; // 첫 화면 앞부분 (스타일·안내·steps)
  screens: ScreenBlock[];
  after: string; // nav 부터 끝까지 (버튼·스크립트)
};

const SECTION =
  /(?:(<!--\s*\w+:START\s*-->)\s*)?(<section class="screen[^"]*"[^>]*>)([\s\S]*?)<\/section>(?:\s*(<!--\s*\w+:END\s*-->))?/g;

// 속성 안의 &lt; 같은 표기를 원래 문자로 되돌린다.
// (되돌리지 않고 다시 저장하면 &amp;lt; 처럼 이중으로 변환된다)
export function unescapeAttr(v: string): string {
  return v
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#3(?:9|4);/g, "'")
    .replace(/&amp;/g, "&");
}

function attr(tag: string, name: string): string {
  const raw = tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? "";
  return unescapeAttr(raw);
}

export function parseActivityHtml(html: string): ParsedActivity | null {
  const start = html.search(/(?:<!--\s*\w+:START\s*-->\s*)?<section class="screen/);
  const navAt = html.lastIndexOf('<div class="nav">');
  if (start === -1 || navAt === -1 || navAt < start) return null;

  const middle = html.slice(start, navAt);
  const screens: ScreenBlock[] = [];
  let m: RegExpExecArray | null;
  SECTION.lastIndex = 0;
  while ((m = SECTION.exec(middle)) !== null) {
    const [, lead, open, body, tail] = m;
    screens.push({
      key: attr(open, "data-key"),
      prompt: attr(open, "data-prompt"),
      photo: attr(open, "data-photo") === "1",
      heading: body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]*>/g, "").trim() ?? "",
      lead: lead ?? "",
      open,
      body,
      tail: tail ?? "",
    });
  }
  if (screens.length === 0) return null;

  return { before: html.slice(0, start), screens, after: html.slice(navAt) };
}

// 속성 값에 들어갈 수 있는 문자를 막아 둔다 (따옴표가 들어가면 태그가 깨진다)
export function escapeAttr(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\s+/g, " ")
    .trim();
}

export function serializeActivityHtml(p: ParsedActivity): string {
  const body = p.screens
    .map((s, i) => {
      // 여는 태그는 다시 만든다 — 첫 화면만 열려 있어야 하고, data-* 는 편집 결과를 따른다
      const cls = `screen${i === 0 ? " on" : ""}`;
      const rest = s.open
        .replace(/^<section\s+/, "")
        .replace(/class="[^"]*"\s*/, "")
        .replace(/data-(?:key|prompt|photo)="[^"]*"\s*/g, "")
        .replace(/>$/, "")
        .trim();
      const attrs = [
        `class="${cls}"`,
        `data-key="${escapeAttr(s.key)}"`,
        s.prompt ? `data-prompt="${escapeAttr(s.prompt)}"` : "",
        s.photo ? `data-photo="1"` : "",
        rest,
      ]
        .filter(Boolean)
        .join(" ");
      return `${s.lead ? s.lead + "\n  " : ""}<section ${attrs}>${s.body}</section>${
        s.tail ? "\n  " + s.tail : ""
      }`;
    })
    .join("\n\n  ");

  return `${p.before}${body}\n\n  ${p.after}`;
}

// 화면을 지우면 그 화면을 다루던 조작 코드가 남아 오류를 낼 수 있다.
// 지워진 화면의 id 를 스크립트가 참조하는지 미리 알려 준다.
export function danglingIds(removed: ScreenBlock[], after: string): string[] {
  const ids = new Set<string>();
  for (const s of removed) {
    for (const m of s.body.matchAll(/id="([^"]+)"/g)) ids.add(m[1]);
  }
  return [...ids].filter((id) => after.includes(`"${id}"`));
}
