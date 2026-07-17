// 교사 계정 생성 (최초 1회 또는 추가 교사)
// 실행: npm run create-teacher -- <아이디> <이름> [초기비밀번호]
//   예: npm run create-teacher -- teacher 김수학
// 초기비밀번호를 생략하면 무작위로 생성해 출력합니다.
// 생성된 계정은 최초 로그인 시 비밀번호 변경이 강제됩니다.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다. (.env.local 확인)");
  process.exit(1);
}

const [loginId, name, passwordArg] = process.argv.slice(2);
if (!loginId || !name) {
  console.error("사용법: npm run create-teacher -- <아이디> <이름> [초기비밀번호]");
  console.error("  예:   npm run create-teacher -- teacher 김수학");
  process.exit(1);
}

const PW_CHARS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
const password =
  passwordArg ??
  Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => PW_CHARS[b % PW_CHARS.length]).join("");

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data: created, error: authError } = await supabase.auth.admin.createUser({
  email: `${loginId}@school.local`,
  password,
  email_confirm: true,
});

if (authError) {
  console.error(
    authError.message?.toLowerCase().includes("already")
      ? `이미 존재하는 아이디입니다: ${loginId}`
      : `계정 생성 실패: ${authError.message}`
  );
  process.exit(1);
}

const { error: profileError } = await supabase.from("profiles").insert({
  id: created.user.id,
  name,
  role: "teacher",
  must_change_password: true,
});

if (profileError) {
  await supabase.auth.admin.deleteUser(created.user.id); // 반쪽 계정 방지
  console.error("프로필 생성 실패:", profileError.message);
  process.exit(1);
}

console.log("교사 계정이 생성되었습니다.");
console.log(`  아이디(로그인용): ${loginId}`);
console.log(`  이름:            ${name}`);
console.log(`  초기비밀번호:     ${password}`);
console.log("최초 로그인 시 비밀번호 변경이 강제됩니다.");
