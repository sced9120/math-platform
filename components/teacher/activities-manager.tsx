"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Activity, ActivityType, Unit } from "@/lib/types";

const TYPE_LABELS: Record<ActivityType, string> = {
  geogebra: "GeoGebra",
  content: "자료/설명",
  problem: "문제 풀이",
  image: "사진/이미지",
  html: "HTML 콘텐츠",
};

type FormState = {
  title: string;
  type: ActivityType;
  order_index: number;
  is_published: boolean;
  // 유형별 필드 (저장 시 content jsonb로 조립)
  materialId: string;
  height: number;
  body: string;
  question: string;
  answer: string;
  tolerance: number;
  imagePath: string;
  caption: string;
  htmlBody: string;
  htmlHeight: number;
  responsePrompt: string; // 모든 유형 공통 — 있으면 학생 글 작성란 표시
  assignAll: boolean; // true = 학년 전체 공개
  assignedClasses: number[]; // assignAll=false일 때 대상 반
};

const EMPTY_FORM: FormState = {
  title: "",
  type: "geogebra",
  order_index: 0,
  is_published: false,
  materialId: "",
  height: 600,
  body: "",
  question: "",
  answer: "",
  tolerance: 0,
  imagePath: "",
  caption: "",
  htmlBody: "",
  htmlHeight: 600,
  responsePrompt: "",
  assignAll: true,
  assignedClasses: [],
};

function buildContent(f: FormState): Record<string, unknown> {
  const common = f.responsePrompt.trim()
    ? { response_prompt: f.responsePrompt.trim() }
    : {};
  switch (f.type) {
    case "geogebra":
      return { materialId: f.materialId.trim(), height: f.height, ...common };
    case "content":
      return { body: f.body, ...common };
    case "problem":
      return {
        question: f.question,
        answer: f.answer.trim(),
        tolerance: f.tolerance,
        ...common,
      };
    case "image":
      return { imagePath: f.imagePath, caption: f.caption.trim(), ...common };
    case "html":
      return { html: f.htmlBody, height: f.htmlHeight, ...common };
  }
}

function formFromActivity(a: Activity): FormState {
  const c = a.content as Record<string, unknown>;
  return {
    ...EMPTY_FORM,
    title: a.title,
    type: a.type,
    order_index: a.order_index,
    is_published: a.is_published,
    materialId: (c.materialId as string) ?? "",
    height: (c.height as number) ?? 600,
    body: (c.body as string) ?? "",
    question: (c.question as string) ?? "",
    answer: (c.answer as string) ?? "",
    tolerance: (c.tolerance as number) ?? 0,
    imagePath: (c.imagePath as string) ?? "",
    caption: (c.caption as string) ?? "",
    htmlBody: (c.html as string) ?? "",
    htmlHeight: (c.height as number) ?? 600,
    responsePrompt: (c.response_prompt as string) ?? "",
    assignAll: a.assigned_classes === null,
    assignedClasses: a.assigned_classes ?? [],
  };
}

export default function ActivitiesManager({
  unit,
  initialActivities,
  classList,
}: {
  unit: Unit;
  initialActivities: Activity[];
  classList: number[];
}) {
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("activities")
      .select("*")
      .eq("unit_id", unit.id)
      .order("order_index");
    setActivities((data as Activity[]) ?? []);
  }, [unit.id]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleImageUpload(file: File) {
    setUploading(true);
    setError(null);
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("activity-files")
      .upload(path, file);
    if (error) {
      setError("이미지 업로드에 실패했습니다. (마이그레이션 0004 적용 여부 확인)");
    } else {
      set("imagePath", path);
    }
    setUploading(false);
  }

  function imageUrl(path: string): string {
    return createClient().storage.from("activity-files").getPublicUrl(path).data
      .publicUrl;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (form.type === "image" && !form.imagePath) {
      setError("이미지를 먼저 업로드하세요.");
      return;
    }
    if (!form.assignAll && form.assignedClasses.length === 0) {
      setError("대상 반을 하나 이상 선택하거나 '학년 전체'를 선택하세요.");
      return;
    }
    setSaving(true);
    setError(null);

    const record = {
      unit_id: unit.id,
      title: form.title,
      type: form.type,
      order_index: form.order_index,
      is_published: form.is_published,
      content: buildContent(form),
      assigned_classes: form.assignAll ? null : [...form.assignedClasses].sort((a, b) => a - b),
    };

    const supabase = createClient();
    const { error } = editingId
      ? await supabase.from("activities").update(record).eq("id", editingId)
      : await supabase.from("activities").insert(record);

    if (error) {
      setError("저장에 실패했습니다. 다시 시도하세요.");
    } else {
      cancelEdit();
      await load();
    }
    setSaving(false);
  }

  async function handleDelete(a: Activity) {
    if (!confirm(`'${a.title}' 활동을 삭제할까요?\n학생 진행기록도 함께 삭제됩니다.`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("activities").delete().eq("id", a.id);
    if (error) {
      alert("삭제에 실패했습니다.");
      return;
    }
    if (editingId === a.id) cancelEdit();
    await load();
  }

  async function togglePublish(a: Activity) {
    const supabase = createClient();
    await supabase
      .from("activities")
      .update({ is_published: !a.is_published })
      .eq("id", a.id);
    await load();
  }

  const inputCls =
    "rounded-md border border-zinc-300 px-3 py-2 focus:border-blue-500 focus:outline-none";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/teacher/units" className="text-sm text-blue-600 hover:underline">
          ← 단원 목록
        </Link>
        <h2 className="mt-1 text-lg font-semibold text-zinc-900">
          {unit.grade}학년 · {unit.title}
          <span
            className={`ml-2 rounded-full px-2 py-0.5 text-xs font-normal ${
              unit.is_published ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-500"
            }`}
          >
            {unit.is_published ? "공개" : "비공개"}
          </span>
        </h2>
      </div>

      {/* 활동 추가/수정 폼 */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-zinc-900">
          {editingId ? "활동 수정" : "새 활동 추가"}
        </h3>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex min-w-64 flex-1 flex-col gap-1">
              <label className="text-sm font-medium text-zinc-700">활동명</label>
              <input
                type="text"
                required
                placeholder="예: 이차함수 그래프 조작해 보기"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-zinc-700">유형</label>
              <select
                value={form.type}
                onChange={(e) => set("type", e.target.value as ActivityType)}
                className={inputCls}
              >
                {Object.entries(TYPE_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-zinc-700">순서</label>
              <input
                type="number"
                value={form.order_index}
                onChange={(e) => set("order_index", Number(e.target.value))}
                className={`w-20 ${inputCls}`}
              />
            </div>

            <label className="flex items-center gap-2 pb-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) => set("is_published", e.target.checked)}
              />
              공개
            </label>
          </div>

          {/* 유형별 입력 */}
          {form.type === "geogebra" && (
            <div className="flex flex-wrap gap-4 rounded-lg bg-zinc-50 p-4">
              <div className="flex min-w-64 flex-1 flex-col gap-1">
                <label className="text-sm font-medium text-zinc-700">
                  GeoGebra 자료 ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="예: RHYH3UQ8 (geogebra.org 자료 주소 끝부분)"
                  value={form.materialId}
                  onChange={(e) => set("materialId", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-700">높이(px)</label>
                <input
                  type="number"
                  value={form.height}
                  onChange={(e) => set("height", Number(e.target.value))}
                  className={`w-24 ${inputCls}`}
                />
              </div>
            </div>
          )}

          {form.type === "content" && (
            <div className="flex flex-col gap-1 rounded-lg bg-zinc-50 p-4">
              <label className="text-sm font-medium text-zinc-700">본문</label>
              <textarea
                required
                rows={8}
                placeholder="학생에게 보여줄 설명/자료 (마크다운 지원 예정, 지금은 줄바꿈 유지 텍스트)"
                value={form.body}
                onChange={(e) => set("body", e.target.value)}
                className={inputCls}
              />
            </div>
          )}

          {form.type === "problem" && (
            <div className="flex flex-col gap-4 rounded-lg bg-zinc-50 p-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-700">문제</label>
                <textarea
                  required
                  rows={4}
                  placeholder="예: 이차함수 y = x² - 4x + 3 의 최솟값을 구하시오."
                  value={form.question}
                  onChange={(e) => set("question", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-zinc-700">정답</label>
                  <input
                    type="text"
                    required
                    placeholder="예: -1"
                    value={form.answer}
                    onChange={(e) => set("answer", e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-zinc-700">
                    허용오차 (숫자 답일 때)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min={0}
                    value={form.tolerance}
                    onChange={(e) => set("tolerance", Number(e.target.value))}
                    className={`w-28 ${inputCls}`}
                  />
                </div>
              </div>
            </div>
          )}

          {form.type === "image" && (
            <div className="flex flex-col gap-3 rounded-lg bg-zinc-50 p-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-700">이미지 파일</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    e.target.files?.[0] && handleImageUpload(e.target.files[0])
                  }
                  className="text-sm"
                />
                {uploading && (
                  <p className="text-sm text-zinc-500">업로드 중...</p>
                )}
                {form.imagePath && !uploading && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl(form.imagePath)}
                    alt="업로드된 이미지 미리보기"
                    className="mt-2 max-h-64 w-auto rounded-md border border-zinc-200"
                  />
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-700">
                  설명 (선택)
                </label>
                <input
                  type="text"
                  placeholder="이미지 아래에 표시할 설명"
                  value={form.caption}
                  onChange={(e) => set("caption", e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {form.type === "html" && (
            <div className="flex flex-col gap-3 rounded-lg bg-zinc-50 p-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-700">HTML 코드</label>
                <p className="text-xs text-zinc-500">
                  클로드/챗GPT 등으로 만든 HTML을 그대로 붙여넣으세요. 학생
                  화면에서 격리된 영역(iframe)에 표시되어 바로 조작할 수 있습니다.
                </p>
                <textarea
                  required
                  rows={10}
                  placeholder="<!DOCTYPE html> 또는 <div>...</div> 등 HTML 전체 붙여넣기"
                  value={form.htmlBody}
                  onChange={(e) => set("htmlBody", e.target.value)}
                  className={`${inputCls} font-mono text-xs`}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-700">높이(px)</label>
                <input
                  type="number"
                  value={form.htmlHeight}
                  onChange={(e) => set("htmlHeight", Number(e.target.value))}
                  className={`w-24 ${inputCls}`}
                />
              </div>
            </div>
          )}

          {/* 공통: 대상 반 (부여하지 않은 반에는 활동이 보이지 않음) */}
          <div className="flex flex-col gap-2 rounded-lg border border-dashed border-zinc-300 p-4">
            <label className="text-sm font-medium text-zinc-700">공개 대상</label>
            <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-700">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={form.assignAll}
                  onChange={() => set("assignAll", true)}
                />
                {unit.grade}학년 전체
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={!form.assignAll}
                  onChange={() => set("assignAll", false)}
                />
                선택한 반만
              </label>
              {!form.assignAll &&
                (classList.length === 0 ? (
                  <span className="text-zinc-400">
                    (이 학년에 등록된 학생이 없습니다)
                  </span>
                ) : (
                  classList.map((cls) => (
                    <label key={cls} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={form.assignedClasses.includes(cls)}
                        onChange={(e) =>
                          set(
                            "assignedClasses",
                            e.target.checked
                              ? [...form.assignedClasses, cls]
                              : form.assignedClasses.filter((c) => c !== cls)
                          )
                        }
                      />
                      {cls}반
                    </label>
                  ))
                ))}
            </div>
          </div>

          {/* 공통: 학생 글 작성란 */}
          <div className="flex flex-col gap-1 rounded-lg border border-dashed border-zinc-300 p-4">
            <label className="text-sm font-medium text-zinc-700">
              학생 글 작성란 안내문 (선택)
            </label>
            <p className="text-xs text-zinc-500">
              입력하면 학생 화면에 글 작성란이 생깁니다. 예: &quot;오늘 활동에서
              알게 된 점을 적어 보세요&quot;, &quot;풀이 과정을 서술하세요&quot;.
              작성 내용은 제출 보기/CSV에서 확인할 수 있습니다.
            </p>
            <input
              type="text"
              value={form.responsePrompt}
              onChange={(e) => set("responsePrompt", e.target.value)}
              placeholder="비워두면 작성란이 표시되지 않습니다"
              className={inputCls}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || uploading}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "저장 중..." : editingId ? "수정 저장" : "추가"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
              >
                취소
              </button>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </section>

      {/* 활동 목록 */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-zinc-900">
          활동 목록 ({activities.length}개)
        </h3>
        {activities.length === 0 ? (
          <p className="text-sm text-zinc-500">아직 활동이 없습니다. 위에서 추가하세요.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500">
                <th className="py-2 pr-4">순서</th>
                <th className="py-2 pr-4">유형</th>
                <th className="py-2 pr-4">활동명</th>
                <th className="py-2 pr-4">대상</th>
                <th className="py-2 pr-4">공개</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a) => (
                <tr key={a.id} className="border-b border-zinc-100">
                  <td className="py-2 pr-4">{a.order_index}</td>
                  <td className="py-2 pr-4">{TYPE_LABELS[a.type]}</td>
                  <td className="py-2 pr-4 font-medium text-zinc-900">{a.title}</td>
                  <td className="py-2 pr-4 text-zinc-600">
                    {a.assigned_classes === null
                      ? "전체"
                      : a.assigned_classes.map((c) => `${c}반`).join(", ")}
                  </td>
                  <td className="py-2 pr-4">
                    <button
                      onClick={() => togglePublish(a)}
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        a.is_published
                          ? "bg-green-100 text-green-700"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {a.is_published ? "공개" : "비공개"}
                    </button>
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-3">
                      <Link
                        href={`/teacher/activity/${a.id}/submissions`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        제출 보기
                      </Link>
                      <button
                        onClick={() => {
                          setEditingId(a.id);
                          setForm(formFromActivity(a));
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="text-xs text-zinc-600 hover:underline"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(a)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
