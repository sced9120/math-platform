// 교사·관리자 비밀번호 재설정 (아이디를 잊었을 땐 --list)
//
// 왜 따로 필요한가
//   이 플랫폼은 이메일을 수집하지 않으려고 가상 주소(<아이디>@school.local)를 쓴다.
//   그래서 Supabase 대시보드의 "Reset password"(메일 발송)는 쓸 수 없다 —
//   보낼 주소가 실재하지 않아 "Email address is invalid" 로 실패한다.
//   대신 계정을 만들 때와 같은 Admin API 로 비밀번호를 직접 바꾼다.
//
// 실행
//   npm run reset-password -- --list                 교사·관리자 계정 목록 보기
//   npm run reset-password -- admin                  무작위 비밀번호로 재설정(화면에 출력)
//   npm run reset-password -- admin 내가정한비밀번호      직접 정한 비밀번호로 재설정
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다. (.env.local 확인)");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

// auth.users 는 PostgREST 로 못 읽으므로 Admin API 로 훑는다
async function allUsers() {
  const out = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) { console.error("계정 목록 조회 실패:", error.message); process.exit(1); }
    out.push(...data.users);
    if (data.users.length < 200) break;
  }
  return out;
}

const args = process.argv.slice(2);

// ── 목록 보기 ───────────────────────────────────────────────────────────────
if (args.includes("--list")) {
  const { data: staff, error } = await supabase
    .from("profiles")
    .select("id, name, role")
    .in("role", ["teacher", "admin"]);
  if (error) { console.error("프로필 조회 실패:", error.message); process.exit(1); }

  const byId = new Map((await allUsers()).map((u) => [u.id, u.email ?? ""]));
  if (!staff.length) {
    console.log("교사·관리자 계정이 없습니다. npm run create-teacher 로 먼저 만드세요.");
    process.exit(0);
  }
  console.log(`교사·관리자 계정 ${staff.length}개\n`);
  for (const p of staff) {
    const loginId = (byId.get(p.id) ?? "").replace(/@school\.local$/, "") || "(알 수 없음)";
    console.log(`  ${p.role === "admin" ? "관리자" : "교사  "}  아이디: ${loginId.padEnd(14)} 이름: ${p.name}`);
  }
  console.log("\n비밀번호를 바꾸려면:  npm run reset-password -- <아이디>");
  process.exit(0);
}

// ── 재설정 ─────────────────────────────────────────────────────────────────
const [loginId, passwordArg] = args;
if (!loginId) {
  console.error("사용법: npm run reset-password -- <아이디> [새비밀번호]");
  console.error("        npm run reset-password -- --list      (계정 목록 보기)");
  process.exit(1);
}

const email = `${loginId}@school.local`;
const user = (await allUsers()).find((u) => u.email === email);
if (!user) {
  console.error(`그런 아이디가 없습니다: ${loginId}`);
  console.error("npm run reset-password -- --list 로 목록을 확인하세요.");
  process.exit(1);
}

const PW_CHARS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
const password =
  passwordArg ??
  Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => PW_CHARS[b % PW_CHARS.length]).join("");

const { error: pwError } = await supabase.auth.admin.updateUserById(user.id, { password });
if (pwError) { console.error("비밀번호 변경 실패:", pwError.message); process.exit(1); }

// 다음 로그인 때 본인이 다시 정하게 한다 (화면에 찍힌 비밀번호가 남지 않도록)
const { error: flagError } = await supabase
  .from("profiles")
  .update({ must_change_password: true })
  .eq("id", user.id);
if (flagError) console.error("경고: 비밀번호 변경 강제 플래그를 세우지 못했습니다 —", flagError.message);

console.log("비밀번호를 재설정했습니다.");
console.log(`  아이디:      ${loginId}`);
console.log(`  새 비밀번호:  ${password}`);
console.log("\n이 비밀번호로 로그인하면 곧바로 새 비밀번호를 정하는 화면이 뜹니다.");
console.log("터미널 기록에 남으니, 로그인해서 바꾸신 뒤 창을 닫아 주세요.");
