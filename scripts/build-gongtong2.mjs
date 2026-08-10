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

import { SUBJECT, UNITS, REG, RETIRE } from "./gongtong2-registry.mjs";

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

// 2) 단원 보장 (옛 이름의 단원이 남아 있으면 이름만 바꿔 재사용) --------------
const unitIdByKey = {};
const claimed = new Set();          // 한 단원을 두 key 가 가져가지 않도록
for (const u of UNITS) {
  let { data: row } = await s.from("units").select("id, is_published")
    .eq("title", u.title).eq("grade", SUBJECT.grade).maybeSingle();

  for (const old of row ? [] : (u.legacy ?? [])) {
    const { data: prev } = await s.from("units").select("id")
      .eq("title", old).eq("grade", SUBJECT.grade).maybeSingle();
    if (!prev || claimed.has(prev.id)) continue;
    // 활동이 딸려 있으므로 새로 만들지 않고 이름만 바꿔 그대로 쓴다
    const upd = await s.from("units")
      .update({ title: u.title, order_index: u.order_index, subject_id: subject.id,
                ...(PUBLISH ? { is_published: true } : {}) })
      .eq("id", prev.id).select("id, is_published").single();
    if (upd.error) { console.error("단원 전환 실패:", upd.error.message); process.exit(1); }
    row = upd.data; claimed.add(prev.id);
    console.log(`✔ 단원 전환: "${old}" → "${u.title}"`);
    break;
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
  claimed.add(row.id);
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
