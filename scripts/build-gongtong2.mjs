// 공통수학2 전체 콘텐츠 빌드 (멱등)
// 실행: node --env-file=.env.local scripts/build-gongtong2.mjs [--publish]
//
// 구조: 교과(공통수학2) → 단원(대단원 3개) → 활동 22개
//  - 교과/단원이 없으면 만들고, 있으면 재사용한다.
//  - 활동은 제목으로 찾아 내용을 갱신하고, 소속 단원·순서를 맞춰 준다(옛 위치에서 옮겨짐).
//  - RETIRE 목록의 활동은 삭제한다.
//  - 기본은 기존 공개 상태 유지, --publish 를 주면 교과·단원·활동을 전부 공개한다.
//
// * 사전 조건: supabase/migrations/0010_subjects.sql 이 적용되어 있어야 한다.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("env 필요 (.env.local)"); process.exit(1); }
const s = createClient(url, key, { auth: { persistSession: false } });
const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, "..", "docs", "activities");
const PUBLISH = process.argv.includes("--publish");

const SUBJECT = { title: "공통수학2", grade: 1, order_index: 0 };

// 교과서(전인태) 대단원 = 단원
const UNITS = [
  { key: "I",   title: "Ⅰ. 도형의 방정식", order_index: 0 },
  { key: "II",  title: "Ⅱ. 집합과 명제",   order_index: 1 },
  { key: "III", title: "Ⅲ. 함수와 그래프", order_index: 2 },
];

// unit: 소속 단원 key, order: 단원 안에서의 순서
const REG = [
  // ── Ⅰ. 도형의 방정식 ──────────────────────────────────────────
  { unit: "I", order: 0, title: "두 점 사이의 거리", file: "gongtong2-00-distance-two-points.html", height: 980,
    rp: "두 점 사이의 거리 공식이 피타고라스 정리에서 어떻게 나오는지 자신의 말로 설명하고, 세 점 A(0,0), B(4,0), C(0,3)으로 만든 삼각형의 세 변의 길이를 구해 어떤 삼각형인지 판정하세요." },
  { unit: "I", order: 1, title: "선분의 내분", file: "gongtong2-01-segment-division.html", height: 980,
    rp: "[심화 과제] 세 꼭짓점 A(0,0)·200g, B(6,0)·300g, C(0,8)·400g 의 전체 무게중심 G 좌표를 풀이과정과 함께 구하고, 무게가 클수록 G 가 어느 쪽으로 끌리는지 내분(가중평균) 관점에서 설명하세요." },
  { unit: "I", order: 2, title: "직선의 방정식", file: "gongtong2-02b-line-equation.html", height: 980,
    rp: "두 점 (1, 2), (3, 8)을 지나는 직선의 방정식을 기울기부터 차례로 구해 보고, 왜 '한 점 + 기울기'만으로 직선이 하나로 정해지는지 설명하세요." },
  { unit: "I", order: 3, title: "두 직선의 평행과 수직", file: "gongtong2-02-parallel-perpendicular.html", height: 980,
    rp: "직접 두 직선을 움직여 본 뒤, 두 직선이 (1) 평행할 조건과 (2) 수직일 조건을 기울기 m₁, m₂ 로 각각 정리하고, 왜 수직이면 기울기의 곱이 −1 이 되는지 자신의 말로 설명하세요." },
  { unit: "I", order: 4, title: "점과 직선 사이의 거리", file: "gongtong2-03-point-line-distance.html", height: 980,
    rp: "점 (2,3) 과 직선 3x−4y+1=0 사이의 거리를 공식으로 구하고, 이 거리가 '점에서 직선에 내린 수선의 길이'와 같은 이유를 설명하세요." },
  { unit: "I", order: 5, title: "원의 방정식", file: "gongtong2-04-circle-equation.html", height: 980,
    rp: "중심 (a,b), 반지름 r 인 원의 방정식이 (x−a)²+(y−b)²=r² 인 이유를 거리로 설명하고, x²+y²+Ax+By+C=0 꼴을 완전제곱으로 고쳐 중심·반지름을 찾는 과정을 예로 보이세요." },
  { unit: "I", order: 6, title: "원과 직선의 위치 관계", file: "gongtong2-05-circle-line.html", height: 980,
    rp: "원의 중심과 직선 사이의 거리 d, 반지름 r 을 비교해 (서로 다른 두 점에서 만남 / 접함 / 만나지 않음)의 세 경우를 d 와 r 의 대소로 정리하세요." },
  { unit: "I", order: 7, title: "원의 접선의 방정식", file: "gongtong2-05b-circle-tangent.html", height: 980,
    rp: "원 x² + y² = 5 위의 점 (1, 2) 에서의 접선의 방정식을 구하고, 그 접선이 반지름과 수직임을 두 기울기의 곱으로 확인하세요. 또 접선 공식들이 모두 '중심에서 접선까지 거리 = 반지름'에서 나온다는 점을 설명해 보세요." },
  { unit: "I", order: 8, title: "평행이동", file: "gongtong2-06-translation.html", height: 960,
    rp: "도형 f(x,y)=0 을 x축으로 a, y축으로 b 만큼 평행이동하면 왜 f(x−a, y−b)=0 이 되는지, 부호가 반대인 이유를 예를 들어 설명하세요." },
  { unit: "I", order: 9, title: "대칭이동", file: "gongtong2-07-reflection.html", height: 980,
    rp: "점 (x,y) 를 x축, y축, 원점, 직선 y=x 에 대해 각각 대칭이동한 좌표를 정리하고, 도형의 방정식에서는 x·y 를 어떻게 바꾸는지 규칙으로 쓰세요." },

  // ── Ⅱ. 집합과 명제 ────────────────────────────────────────────
  { unit: "II", order: 0, title: "집합의 뜻과 포함관계", file: "gongtong2-08-sets-subset.html", height: 960,
    rp: "'집합'이 되려면 어떤 조건을 만족해야 하는지 쓰고, 부분집합(⊂)과 진부분집합의 차이를 예를 들어 설명하세요. 원소가 n개인 집합의 부분집합 개수가 2ⁿ 인 이유도 적어보세요." },
  { unit: "II", order: 1, title: "교집합과 합집합", file: "gongtong2-09-intersection-union.html", height: 1000,
    rp: "벤 다이어그램을 움직여 본 뒤, n(A∪B)=n(A)+n(B)−n(A∩B) 가 성립하는 이유를 '겹치는 부분을 두 번 세지 않기'로 설명하세요. 또 분배법칙 A∩(B∪C)=(A∩B)∪(A∩C) 를 벤 다이어그램으로 확인한 과정을 적어보세요." },
  { unit: "II", order: 2, title: "여집합과 차집합", file: "gongtong2-10-complement-difference.html", height: 980,
    rp: "여집합 Aᶜ, 차집합 A−B 를 정의하고, 드모르간 법칙 (A∪B)ᶜ=Aᶜ∩Bᶜ 를 벤 다이어그램으로 확인한 과정을 설명하세요." },
  { unit: "II", order: 3, title: "명제와 조건", file: "gongtong2-11-proposition-condition.html", height: 960,
    rp: "'명제'와 '조건'의 차이를 예로 설명하고, 조건 p, q 에 대해 진리집합 P, Q 를 이용해 'p이면 q이다'가 참일 조건을 P, Q 의 포함관계로 나타내세요." },
  { unit: "II", order: 4, title: "명제 사이의 관계", file: "gongtong2-12-proposition-relations.html", height: 980,
    rp: "명제 'p→q' 의 역·이·대우를 각각 쓰고, 원명제와 대우의 참·거짓이 항상 일치하는 이유를 진리집합으로 설명하세요." },
  { unit: "II", order: 5, title: "명제의 증명", file: "gongtong2-13-proof.html", height: 960,
    rp: "'√2 는 무리수이다'를 귀류법으로 증명하는 큰 흐름을 자신의 말로 정리하고, 귀류법이 왜 타당한 증명 방법인지 설명하세요." },
  { unit: "II", order: 6, title: "범인을 찾아라 (논리 추론)", file: "gongtong2-16b-logic-detective.html", height: 980,
    rp: "(1) 용의자 C와 D의 증언을 대우로 바꾼 과정을 쓰고, (2) 왜 범인이 A와 C 로 유일하게 결정되는지 연쇄 s⟹q⟹p⟹r 를 이용해 설명하세요. (3) 일상 문장을 명제 기호로 바꾸는 일이 왜 유용한지도 적어보세요." },

  // ── Ⅲ. 함수와 그래프 ──────────────────────────────────────────
  { unit: "III", order: 0, title: "함수", file: "gongtong2-14-function.html", height: 980,
    rp: "대응이 '함수'가 되기 위한 조건을 쓰고, 일대일함수·일대일대응의 차이를 그림(대응)으로 설명하세요." },
  { unit: "III", order: 1, title: "합성함수", file: "gongtong2-15-composite.html", height: 980,
    rp: "합성함수 (g∘f)(x)=g(f(x)) 의 계산 순서를 설명하고, 일반적으로 g∘f ≠ f∘g 임을 구체적인 예로 보이세요." },
  { unit: "III", order: 2, title: "역함수", file: "gongtong2-16-inverse.html", height: 980,
    rp: "역함수가 존재하기 위한 조건(일대일대응)을 쓰고, y=f(x) 와 y=f⁻¹(x) 의 그래프가 직선 y=x 에 대해 대칭인 이유를 설명하세요." },
  { unit: "III", order: 3, title: "유리함수", file: "gongtong2-20-rational-function.html", height: 1000,
    rp: "유리함수 y=(ax+b)/(cx+d) 를 y=k/(x−p)+q 꼴로 변형해 점근선을 찾는 과정을, 예를 하나 들어 직접 계산해 보이세요. (예: y=(2x−1)/(x+1))" },
  { unit: "III", order: 4, title: "무리함수", file: "gongtong2-21-irrational-function.html", height: 1000,
    rp: "무리함수 y=√(ax+b)+c 의 정의역·치역이 a 의 부호에 따라 어떻게 달라지는지 그래프를 움직여 관찰한 내용을 바탕으로 정리하고, y=√x 와 y=x²(x≥0) 이 역함수 관계인 이유를 설명하세요." },
];

const RETIRE = ["유리함수와 무리함수"];

// 0) 마이그레이션 확인 -------------------------------------------------------
{
  const probe = await s.from("subjects").select("id").limit(1);
  if (probe.error) {
    console.error("✗ subjects 테이블이 없습니다. 먼저 supabase/migrations/0010_subjects.sql 을 실행하세요.");
    console.error("  (Supabase 대시보드 → SQL Editor 에 붙여넣고 Run)");
    process.exit(1);
  }
}

// 1) 교과 보장 ---------------------------------------------------------------
let { data: subject } = await s.from("subjects").select("id, is_published")
  .eq("title", SUBJECT.title).eq("grade", SUBJECT.grade).maybeSingle();
if (!subject) {
  const ins = await s.from("subjects")
    .insert({ ...SUBJECT, is_published: PUBLISH })
    .select("id, is_published").single();
  if (ins.error) { console.error("교과 생성 실패:", ins.error.message); process.exit(1); }
  subject = ins.data;
  console.log(`✔ 교과 생성: ${SUBJECT.title}`);
} else if (PUBLISH && !subject.is_published) {
  await s.from("subjects").update({ is_published: true }).eq("id", subject.id);
  console.log(`✔ 교과 공개: ${SUBJECT.title}`);
}

// 2) 단원 보장 (기존 '공통수학2' 단원은 Ⅰ단원으로 재활용) --------------------
const legacy = await s.from("units").select("id")
  .eq("title", "공통수학2").eq("grade", SUBJECT.grade).maybeSingle();

const unitIdByKey = {};
for (const u of UNITS) {
  let { data: row } = await s.from("units").select("id, is_published")
    .eq("title", u.title).eq("grade", SUBJECT.grade).maybeSingle();

  if (!row && u.key === "I" && legacy.data) {
    // 옛 '공통수학2' 단원의 이름을 바꿔 그대로 쓴다(활동이 딸려 있으므로 이동 최소화)
    const upd = await s.from("units")
      .update({ title: u.title, order_index: u.order_index, subject_id: subject.id,
                ...(PUBLISH ? { is_published: true } : {}) })
      .eq("id", legacy.data.id).select("id, is_published").single();
    if (upd.error) { console.error("단원 전환 실패:", upd.error.message); process.exit(1); }
    row = upd.data;
    console.log(`✔ 단원 전환: "공통수학2" → "${u.title}"`);
  }

  if (!row) {
    const ins = await s.from("units").insert({
      title: u.title, grade: SUBJECT.grade, order_index: u.order_index,
      subject_id: subject.id, is_published: PUBLISH,
    }).select("id, is_published").single();
    if (ins.error) { console.error(`단원 생성 실패(${u.title}):`, ins.error.message); process.exit(1); }
    row = ins.data;
    console.log(`✔ 단원 생성: ${u.title}`);
  } else {
    await s.from("units").update({
      order_index: u.order_index, subject_id: subject.id,
      ...(PUBLISH ? { is_published: true } : {}),
    }).eq("id", row.id);
  }
  unitIdByKey[u.key] = row.id;
}

const unitIds = Object.values(unitIdByKey);

// 3) 폐기 활동 삭제 ----------------------------------------------------------
for (const t of RETIRE) {
  const { data: olds } = await s.from("activities").select("id")
    .in("unit_id", unitIds).eq("title", t);
  for (const o of olds ?? []) {
    await s.from("activities").delete().eq("id", o.id);
    console.log(`🗑  폐기: "${t}"`);
  }
}

// 4) 활동 upsert (제목으로 찾아 소속 단원·순서까지 맞춘다) -------------------
const { data: existing } = await s.from("activities")
  .select("id, title, unit_id").in("unit_id", unitIds);
const byTitle = new Map((existing ?? []).map((a) => [a.title, a]));

let done = 0, skipped = 0, moved = 0;
for (const a of REG) {
  const path = join(dir, a.file);
  if (!existsSync(path)) { console.log(`⬜ 건너뜀(파일없음): ${a.title}`); skipped++; continue; }
  const html = readFileSync(path, "utf8");
  const content = { html, height: a.height, response_prompt: a.rp };
  const unit_id = unitIdByKey[a.unit];
  const patch = { type: "html", content, order_index: a.order, unit_id };
  if (PUBLISH) patch.is_published = true;

  const prev = byTitle.get(a.title);
  if (prev) {
    const upd = await s.from("activities").update(patch).eq("id", prev.id);
    if (upd.error) { console.error(`✗ 갱신 실패 ${a.title}:`, upd.error.message); continue; }
    const tag = prev.unit_id !== unit_id ? " ↪ 단원 이동" : "";
    if (tag) moved++;
    console.log(`🔵 갱신: [${a.unit}] ${a.title} (${(html.length / 1024).toFixed(1)}KB)${tag}`);
  } else {
    const ins = await s.from("activities")
      .insert({ title: a.title, is_published: PUBLISH, ...patch })
      .select("id").single();
    if (ins.error) { console.error(`✗ 삽입 실패 ${a.title}:`, ins.error.message); continue; }
    console.log(`🟢 신규: [${a.unit}] ${a.title} (${(html.length / 1024).toFixed(1)}KB)`);
  }
  done++;
}

console.log(`\n완료: ${done}개 반영${moved ? `, ${moved}개 단원 이동` : ""}${skipped ? `, ${skipped}개 건너뜀` : ""}.`);
console.log(PUBLISH ? "교과·단원·활동 전부 공개 상태." : "공개 상태는 기존값 유지(--publish 로 전체 공개).");
