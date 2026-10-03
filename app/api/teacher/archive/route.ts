import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  archiveFileName,
  buildArchivePage,
  stripAnswers,
  type ExportScreen,
} from "@/lib/archive-export";

// 공개 아카이브 내보내기 (학교 교사 전용)
//
// 누구나 교사로 가입하는 구조(0017)라서
//  - 실행은 학교 교사(관리자 + 관리자가 만든 교사)만 — 가입 교사가 이 사이트의 GitHub 토큰으로
//    커밋하게 두지 않는다
//  - 내보내는 자료도 학교 교사가 만든 것만 — 가입 교사의 자료가 공개 아카이브에 섞이지 않게
//
// 배포된 앱은 깃 저장소에 파일을 쓸 수 없다(파일 시스템이 임시다).
// 그래서 GitHub API 로 직접 커밋한다 → GitHub Pages 가 알아서 다시 빌드한다.
//
// 필요한 환경변수
//   GITHUB_TOKEN  contents:write 권한이 있는 토큰 (fine-grained PAT 권장)
//   GITHUB_REPO   "사용자/저장소" (기본값: sced9120/math-platform)
//   GITHUB_BRANCH 기본값: main

const REPO = process.env.GITHUB_REPO ?? "sced9120/math-platform";
const BRANCH = process.env.GITHUB_BRANCH ?? "main";
const API = "https://api.github.com";

async function requireSchoolStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase
    .from("profiles")
    .select("*") // self_signup 은 0017 이후에만 있으므로 컬럼을 나열하지 않는다
    .eq("id", user.id)
    .single<{ role: string; self_signup?: boolean }>();
  const staff = me?.role === "teacher" || me?.role === "admin";
  return staff && me?.self_signup !== true ? user : null;
}

// 학교 교사 id 들 (가입 교사 제외)
async function schoolStaffIds(db: ReturnType<typeof createAdminClient>): Promise<Set<string>> {
  const { data } = await db.from("profiles").select("*").in("role", ["admin", "teacher"]);
  return new Set(
    ((data ?? []) as { id: string; self_signup?: boolean }[])
      .filter((p) => p.self_signup !== true)
      .map((p) => p.id)
  );
}

function gh(token: string) {
  return async (path: string, init?: RequestInit) => {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`GitHub ${path} → ${res.status} ${await res.text()}`);
    return res.json();
  };
}

// 공개된 소단원의 화면을 모아 파일 내용을 만든다
async function buildFiles() {
  const db = createAdminClient();
  const staff = await schoolStaffIds(db);
  // owner_id 가 아직 없으면(0017 전) 그대로, 있으면 학교 교사의 자료만
  const bySchool = <T extends { owner_id?: string | null }>(rows: T[] | null) =>
    (rows ?? []).filter((r) => r.owner_id === undefined || (!!r.owner_id && staff.has(r.owner_id)));

  const [{ data: subjects }, { data: units }, { data: actRows }, { data: screens }] =
    await Promise.all([
      db.from("subjects").select("*").eq("is_published", true),
      db.from("units").select("*").eq("is_published", true),
      db.from("activities").select("*").eq("is_published", true),
      db
        .from("activity_screens")
        .select("activity_id, screen_key, order_index, type, title, config, questions, sheet")
        .order("order_index"),
    ]);

  const subjectOf = new Map(bySchool(subjects).map((x) => [x.id, x]));
  const unitOf = new Map(bySchool(units).map((x) => [x.id, x]));
  const acts = bySchool(actRows);
  const byActivity = new Map<string, ExportScreen[]>();
  for (const sc of (screens ?? []) as (ExportScreen & { activity_id: string })[]) {
    const list = byActivity.get(sc.activity_id) ?? [];
    list.push({ ...sc, questions: stripAnswers(sc.questions) });
    byActivity.set(sc.activity_id, list);
  }

  const files: { path: string; content: string }[] = [];
  const manifest: Record<string, unknown>[] = [];

  for (const a of acts ?? []) {
    const u = unitOf.get(a.unit_id);
    const subj = u ? subjectOf.get(u.subject_id as string) : null;
    if (!u || !subj) continue;

    const list = (byActivity.get(a.id) ?? []).slice().sort((x, y) => x.order_index - y.order_index);
    if (list.length === 0) continue; // 화면 구성이 없는 옛 소단원은 기존 파일을 그대로 둔다

    const file = archiveFileName(a.id);
    files.push({
      path: `docs/activities/${file}`,
      content: buildArchivePage(
        { id: a.id, title: a.title, unit: u.title, subject: subj.title, grade: u.grade },
        list
      ),
    });
    manifest.push({
      id: a.id,
      title: a.title,
      unit: u.title,
      subject: subj.title,
      grade: u.grade,
      file: `activities/${file}`,
      screens: list.map((sc) => ({
        key: sc.screen_key,
        type: sc.type,
        title: sc.title,
        sheet: sc.sheet,
        questions: sc.questions.length,
      })),
    });
  }

  files.push({
    path: "docs/activities.json",
    content: JSON.stringify({ generated: new Date().toISOString(), items: manifest }, null, 2),
  });

  return { files, count: manifest.length };
}

export async function POST() {
  if (!(await requireSchoolStaff())) {
    return NextResponse.json({ error: "학교 교사만 아카이브를 내보낼 수 있습니다." }, { status: 403 });
  }
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "GITHUB_TOKEN 이 설정되어 있지 않습니다. Vercel 환경변수에 넣어 주세요." },
      { status: 400 }
    );
  }

  try {
    const { files, count } = await buildFiles();
    if (count === 0) {
      return NextResponse.json({
        ok: true,
        count: 0,
        message: "내보낼 활동이 없습니다. (화면 구성으로 만든 공개 소단원이 아직 없습니다)",
      });
    }

    const api = gh(token);

    // 커밋 한 번에 여러 파일 — blob → tree → commit → ref
    const ref = await api(`/repos/${REPO}/git/ref/heads/${BRANCH}`);
    const baseSha: string = ref.object.sha;
    const baseCommit = await api(`/repos/${REPO}/git/commits/${baseSha}`);

    const blobs = await Promise.all(
      files.map(async (f) => {
        const b = await api(`/repos/${REPO}/git/blobs`, {
          method: "POST",
          body: JSON.stringify({ content: f.content, encoding: "utf-8" }),
        });
        return { path: f.path, mode: "100644", type: "blob", sha: b.sha };
      })
    );

    const tree = await api(`/repos/${REPO}/git/trees`, {
      method: "POST",
      body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: blobs }),
    });

    const commit = await api(`/repos/${REPO}/git/commits`, {
      method: "POST",
      body: JSON.stringify({
        message: `아카이브 내보내기 — 소단원 ${count}개 (플랫폼에서 실행)`,
        tree: tree.sha,
        parents: [baseSha],
      }),
    });

    await api(`/repos/${REPO}/git/refs/heads/${BRANCH}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha }),
    });

    return NextResponse.json({
      ok: true,
      count,
      files: files.length,
      commit: String(commit.sha).slice(0, 7),
    });
  } catch (e) {
    console.error("archive export failed", e);
    return NextResponse.json(
      { error: "내보내기에 실패했습니다. 토큰 권한과 저장소 이름을 확인해 주세요." },
      { status: 500 }
    );
  }
}
