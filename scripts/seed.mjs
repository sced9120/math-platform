// 시드 데이터: 예시 단원 1개 + geogebra/content/problem 활동 각 1개
// 실행: npm run seed  (내부적으로 node --env-file=.env.local scripts/seed.mjs)
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다. (.env.local 확인)");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const SEED_TITLE = "예시 단원 — 이차함수";

const { data: existing } = await supabase
  .from("units")
  .select("id")
  .eq("title", SEED_TITLE)
  .maybeSingle();

if (existing) {
  console.log(`이미 시드 단원이 있습니다: ${SEED_TITLE} (건너뜀)`);
  process.exit(0);
}

const { data: unit, error: unitError } = await supabase
  .from("units")
  .insert({ title: SEED_TITLE, grade: 1, order_index: 0, is_published: true })
  .select()
  .single();

if (unitError) {
  console.error("단원 생성 실패:", unitError.message);
  process.exit(1);
}

const activities = [
  {
    unit_id: unit.id,
    type: "geogebra",
    title: "그래프 조작해 보기 (GeoGebra)",
    // materialId는 예시입니다. geogebra.org 자료 주소 끝부분으로 교체하세요.
    content: { materialId: "RHYH3UQ8", height: 600 },
    order_index: 0,
    is_published: true,
  },
  {
    unit_id: unit.id,
    type: "content",
    title: "이차함수 핵심 정리",
    content: {
      body:
        "이차함수 y = ax² + bx + c (a ≠ 0)\n\n" +
        "1. a > 0 이면 아래로 볼록, a < 0 이면 위로 볼록\n" +
        "2. 꼭짓점: x = -b/2a\n" +
        "3. 판별식 D = b² - 4ac 로 x축과의 교점 개수를 판단\n\n" +
        "위 내용을 읽고 '학습 완료'를 눌러 주세요.",
    },
    order_index: 1,
    is_published: true,
  },
  {
    unit_id: unit.id,
    type: "problem",
    title: "최솟값 구하기",
    content: {
      question: "이차함수 y = x² - 4x + 3 의 최솟값을 구하시오.",
      answer: "-1",
      tolerance: 0,
    },
    order_index: 2,
    is_published: true,
  },
];

const { error: actError } = await supabase.from("activities").insert(activities);
if (actError) {
  console.error("활동 생성 실패:", actError.message);
  process.exit(1);
}

console.log(`시드 완료: "${SEED_TITLE}" (1학년, 공개) + 활동 3개`);
console.log("교사 화면(/teacher/units)에서 수정하거나 삭제할 수 있습니다.");
