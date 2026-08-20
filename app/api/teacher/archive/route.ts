import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  archiveFileName,
  buildArchivePage,
  stripAnswers,
  type ExportScreen,
} from "@/lib/archive-export";

// 공개 아카이브 내보내기 (교사 전용)
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

  const [{ data: subjects }, { data: units }, { data: acts }, { data: screens }] =
    await Promise.all([
      db.from("subjects").select("id, title, grade").eq("is_published", true),
      db.from("units").select("id, title, grade, subject_id").eq("is_published", true),
      db.from("activities").select("id, title, unit_id, order_index").eq("is_published", true),
      db
        .from("activity_screens")
        .select("activity_id, screen_key, order_index, type, title, config, questions, sheet")
        .order("order_index"),
    ]);

  const subjectOf = new Map((subjects ?? []).map((x) => [x.id, x]));
  const unitOf = new Map((units ?? []).map((x) => [x.id, x]));
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
  if (!(await requireTeacher())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
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
