import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { toStudentId, type StudentRow } from "@/lib/types";

// 학생 계정 일괄 생성 (교사 전용).
// service role key는 이 서버 코드에서만 사용된다 — 클라이언트 노출 금지.

const MAX_ROWS = 300;

// 교사 또는 관리자면 통과 (admin은 교사 권한 포함)
async function requireTeacher() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return me?.role === "teacher" || me?.role === "admin" ? user : null;
}

function isValidRow(s: StudentRow): boolean {
  return (
    Number.isInteger(s.grade) && s.grade >= 1 && s.grade <= 3 &&
    Number.isInteger(s.class_no) && s.class_no >= 1 && s.class_no <= 99 &&
    Number.isInteger(s.student_no) && s.student_no >= 1 && s.student_no <= 99 &&
    typeof s.name === "string" && s.name.trim().length > 0
  );
}

export async function POST(request: Request) {
  if (!(await requireTeacher())) {
    return NextResponse.json({ error: "교사만 사용할 수 있습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const students: StudentRow[] | undefined = body?.students;
  if (!Array.isArray(students) || students.length === 0) {
    return NextResponse.json({ error: "학생 목록이 비어 있습니다." }, { status: 400 });
  }
  if (students.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `한 번에 최대 ${MAX_ROWS}명까지 생성할 수 있습니다.` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const results = [];

  for (const s of students) {
    const row = {
      grade: Number(s.grade),
      class_no: Number(s.class_no),
      student_no: Number(s.student_no),
      name: String(s.name ?? "").trim(),
    };
    if (!isValidRow(row)) {
      results.push({ studentId: "-", name: row.name, ok: false, error: "형식 오류" });
      continue;
    }

    const studentId = toStudentId(row);
    // 명단에 비밀번호가 있으면 그것을, 없으면 학번을 초기비밀번호로 사용
    const givenPw = String(
      (s as { password?: unknown }).password ?? ""
    ).trim();
    if (givenPw && (givenPw.length < 4 || givenPw.length > 72)) {
      results.push({
        studentId,
        name: row.name,
        ok: false,
        error: "비밀번호는 4~72자여야 합니다",
      });
      continue;
    }
    const password = givenPw || studentId;

    const { data: created, error: authError } = await admin.auth.admin.createUser({
      email: `${studentId}@school.local`,
      password,
      email_confirm: true,
    });

    if (authError || !created?.user) {
      const dup = authError?.message?.toLowerCase().includes("already");
      results.push({
        studentId,
        name: row.name,
        ok: false,
        error: dup ? "이미 존재하는 학번" : "계정 생성 실패",
      });
      continue;
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: created.user.id,
      ...row,
      role: "student",
      must_change_password: true,
    });

    if (profileError) {
      // 프로필 생성 실패 시 auth 계정도 되돌린다 (반쪽짜리 계정 방지)
      await admin.auth.admin.deleteUser(created.user.id);
      results.push({ studentId, name: row.name, ok: false, error: "프로필 생성 실패" });
      continue;
    }

    results.push({ studentId, name: row.name, password, ok: true });
  }

  return NextResponse.json({ results });
}

// 학생 비밀번호 재설정 (분실 시). 새 비밀번호 미지정이면 학번으로 초기화.
// 재설정 후에는 첫 로그인 시 비밀번호 변경이 강제된다.
export async function PATCH(request: Request) {
  if (!(await requireTeacher())) {
    return NextResponse.json({ error: "교사만 사용할 수 있습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const userId: string | undefined = body?.userId;
  if (!userId) {
    return NextResponse.json({ error: "userId가 필요합니다." }, { status: 400 });
  }
  const givenPw = String(body?.password ?? "").trim();
  if (givenPw && (givenPw.length < 4 || givenPw.length > 72)) {
    return NextResponse.json(
      { error: "비밀번호는 4~72자로 입력하세요." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // 학생 계정만 재설정 가능 (교사·관리자 계정 보호)
  const { data: target } = await admin
    .from("profiles")
    .select("role, grade, class_no, student_no")
    .eq("id", userId)
    .single();
  if (!target || target.role !== "student") {
    return NextResponse.json(
      { error: "학생 계정만 재설정할 수 있습니다." },
      { status: 400 }
    );
  }

  const password =
    givenPw ||
    toStudentId({
      grade: target.grade as number,
      class_no: target.class_no as number,
      student_no: target.student_no as number,
      name: "",
    });

  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) {
    // Supabase는 비밀번호 "변경" 시 최소 6자를 강제한다 (생성 시엔 5자리 학번 허용).
    // 학번(5자리) 초기화가 막힌 경우 해결 방법을 함께 안내한다.
    const weak = error.message?.toLowerCase().includes("password");
    return NextResponse.json(
      {
        error: weak
          ? "학번(5자리)으로는 초기화할 수 없습니다 — Supabase 최소 비밀번호 길이(6자) 때문입니다. " +
            "6자 이상 비밀번호를 입력하거나, Supabase 대시보드 → Authentication → " +
            "Sign In / Providers → Email에서 Minimum password length를 5로 낮추면 학번 초기화가 됩니다."
          : "재설정에 실패했습니다.",
      },
      { status: 500 }
    );
  }
  await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", userId);

  return NextResponse.json({ ok: true, password });
}

// 학생 계정 삭제 (잘못 생성한 계정 정리용). auth 계정 삭제 시 profiles는 FK cascade.
export async function DELETE(request: Request) {
  if (!(await requireTeacher())) {
    return NextResponse.json({ error: "교사만 사용할 수 있습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const userId: string | undefined = body?.userId;
  if (!userId) {
    return NextResponse.json({ error: "userId가 필요합니다." }, { status: 400 });
  }

  const admin = createAdminClient();

  // 교사 계정은 이 API로 삭제 불가
  const { data: target } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (!target || target.role !== "student") {
    return NextResponse.json({ error: "학생 계정만 삭제할 수 있습니다." }, { status: 400 });
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json({ error: "삭제에 실패했습니다." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
