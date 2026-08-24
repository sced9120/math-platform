import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { toStudentId, defaultPassword, type StudentRow } from "@/lib/types";

// 학생 계정 일괄 생성 (교사 전용).
// service role key는 이 서버 코드에서만 사용된다 — 클라이언트 노출 금지.

const MAX_ROWS = 300;

// 교사 또는 관리자면 통과 (admin은 교사 권한 포함)
// 역할까지 함께 돌려준다 — 남의 학생을 건드리지 못하게 확인할 때 쓴다.
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
  if (me?.role !== "teacher" && me?.role !== "admin") return null;
  return { user, role: me.role as "teacher" | "admin" };
}

// 이 학생을 내 목록에 담고 있는가 (관리자는 전부).
// service role 클라이언트는 RLS 를 우회하므로 여기서 직접 확인해야 한다.
async function isMyStudent(
  admin: ReturnType<typeof createAdminClient>,
  actor: { user: { id: string }; role: "teacher" | "admin" },
  studentId: string
): Promise<boolean> {
  if (actor.role === "admin") return true;
  const { data } = await admin
    .from("teacher_students")
    .select("teacher_id")
    .eq("teacher_id", actor.user.id)
    .eq("student_id", studentId)
    .maybeSingle();
  return !!data;
}

// 계정 자체를 없앨 수 있는가 — 만든 사람(또는 관리자)만.
// 0016 부터 한 학생을 여러 교사가 담을 수 있으므로 "담당"은 삭제 근거가 못 된다.
// (담고 있던 교사가 지우면 다른 반 선생님의 학생까지 함께 사라진다)
// 내 목록에서 빼는 것은 teacher_students 에서 그 줄만 지우면 된다.
async function canDeleteAccount(
  admin: ReturnType<typeof createAdminClient>,
  actor: { user: { id: string }; role: "teacher" | "admin" },
  studentId: string
): Promise<boolean> {
  if (actor.role === "admin") return true;
  const { data } = await admin
    .from("profiles")
    .select("teacher_id, role")
    .eq("id", studentId)
    .maybeSingle<{ teacher_id: string | null; role: string }>();
  return data?.role === "student" && data.teacher_id === actor.user.id;
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
  const actor = await requireTeacher();
  if (!actor) {
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
    // 명단에 비밀번호가 있으면 그것을, 없으면 학번 기반 기본값(s+학번)을 사용
    const givenPw = String(
      (s as { password?: unknown }).password ?? ""
    ).trim();
    if (givenPw && (givenPw.length < 6 || givenPw.length > 72)) {
      results.push({
        studentId,
        name: row.name,
        ok: false,
        error: "비밀번호는 6~72자여야 합니다",
      });
      continue;
    }
    const password = givenPw || defaultPassword(studentId);

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
      teacher_id: actor.user.id, // 만든 사람 — 계정 삭제 권한의 근거
    });

    if (profileError) {
      // 프로필 생성 실패 시 auth 계정도 되돌린다 (반쪽짜리 계정 방지)
      await admin.auth.admin.deleteUser(created.user.id);
      results.push({ studentId, name: row.name, ok: false, error: "프로필 생성 실패" });
      continue;
    }

    // 만든 사람의 목록에 바로 담아 둔다. 다른 교사는 "전체 학생"에서 골라 담는다.
    await admin
      .from("teacher_students")
      .upsert(
        { teacher_id: actor.user.id, student_id: created.user.id },
        { onConflict: "teacher_id,student_id", ignoreDuplicates: true }
      );

    results.push({ studentId, name: row.name, password, ok: true });
  }

  return NextResponse.json({ results });
}

// 학생 비밀번호 재설정 (분실 시). 새 비밀번호 미지정이면 학번으로 초기화.
// 재설정 후에는 첫 로그인 시 비밀번호 변경이 강제된다.
export async function PATCH(request: Request) {
  const actor = await requireTeacher();
  if (!actor) {
    return NextResponse.json({ error: "교사만 사용할 수 있습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const userId: string | undefined = body?.userId;
  if (!userId) {
    return NextResponse.json({ error: "userId가 필요합니다." }, { status: 400 });
  }
  const givenPw = String(body?.password ?? "").trim();
  if (givenPw && (givenPw.length < 6 || givenPw.length > 72)) {
    return NextResponse.json(
      { error: "비밀번호는 6~72자로 입력하세요." },
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
  if (!(await isMyStudent(admin, actor, userId))) {
    return NextResponse.json(
      { error: "내 목록에 있는 학생만 관리할 수 있습니다." },
      { status: 403 }
    );
  }

  // 미지정 시 학번 기반 기본값(s+학번)으로 초기화 — 6자 이상 보장
  const studentId = toStudentId({
    grade: target.grade as number,
    class_no: target.class_no as number,
    student_no: target.student_no as number,
    name: "",
  });
  const password = givenPw || defaultPassword(studentId);

  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) {
    return NextResponse.json({ error: "재설정에 실패했습니다." }, { status: 500 });
  }
  await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", userId);

  return NextResponse.json({ ok: true, password });
}

// 학생 계정 삭제 (잘못 생성한 계정 정리용). auth 계정 삭제 시 profiles는 FK cascade.
export async function DELETE(request: Request) {
  const actor = await requireTeacher();
  if (!actor) {
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
  if (!(await canDeleteAccount(admin, actor, userId))) {
    return NextResponse.json(
      {
        error:
          "계정 삭제는 그 계정을 만든 교사나 관리자만 할 수 있습니다. " +
          "내 목록에서만 빼려면 '내 목록에서 빼기'를 쓰세요.",
      },
      { status: 403 }
    );
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json({ error: "삭제에 실패했습니다." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
