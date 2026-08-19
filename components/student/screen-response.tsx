"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fileToImageDataUrls } from "@/lib/client/file-to-images";
import { UPLOAD_BUCKET } from "@/lib/responses";

export const MAX_PHOTOS = 5;

// 모든 활동의 맨 끝에 붙는 자유 기록칸.
// 활동 HTML 의 마지막 화면(data-key="free")과 같은 키를 쓴다.
export const FREE_KEY = "free";
export const FREE_PROMPT =
  "오늘 수업에서 새로 알게 된 것, 아직 헷갈리는 것, 더 알고 싶은 것을 자유롭게 남겨 보세요. (글로 써도 되고, 공책에 쓴 것을 사진으로 올려도 됩니다.)";

export type SavedResponse = { text: string; images: string[] };

// data URL(압축된 JPEG) → 업로드용 Blob
function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(head)?.[1] ?? "image/jpeg";
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

// 한 화면의 기록칸. 화면을 넘기면 screenKey 가 바뀌고 그 화면의 질문·답으로 갈아 끼워진다.
// allowPhoto 인 화면(자유 기록·확장 탐구)에서는 공책을 찍어 올릴 수도 있다.
export default function ScreenResponse({
  activityId,
  screenKey,
  questionKey = "",
  prompt,
  allowPhoto,
  saved,
  onSaved,
  tone = "blue",
}: {
  activityId: string;
  screenKey: string;
  questionKey?: string; // 화면에 질문이 여러 개일 때 구분 (없으면 화면 하나에 질문 하나)
  prompt: string;
  allowPhoto: boolean;
  saved: SavedResponse | undefined;
  onSaved: (screenKey: string, value: SavedResponse) => void;
  tone?: "blue" | "amber";
}) {
  const [text, setText] = useState(saved?.text ?? "");
  const [images, setImages] = useState<string[]>(saved?.images ?? []); // 저장된 경로
  const [pending, setPending] = useState<string[]>([]); // 아직 올리지 않은 data URL
  const [previews, setPreviews] = useState<Record<string, string>>({}); // 경로 → 서명 URL
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 화면이 바뀌면 부모가 key={screenKey} 로 이 폼을 새로 만든다.
  // 그래서 여기서 화면 전환을 따로 처리하지 않아도 입력값이 저절로 갈아 끼워진다.

  // 이미 올린 사진 미리보기 (비공개 버킷이라 서명 URL 이 필요하다)
  useEffect(() => {
    const missing = images.filter((p) => !previews[p]);
    if (missing.length === 0) return;
    let alive = true;
    (async () => {
      const { data } = await createClient()
        .storage.from(UPLOAD_BUCKET)
        .createSignedUrls(missing, 60 * 60);
      if (!alive || !data) return;
      setPreviews((prev) => {
        const next = { ...prev };
        for (const row of data) {
          if (row.path && row.signedUrl) next[row.path] = row.signedUrl;
        }
        return next;
      });
    })();
    return () => {
      alive = false;
    };
  }, [images, previews]);

  async function handleFiles(files: FileList) {
    setError(null);
    setPreparing(true);
    try {
      const collected: string[] = [...pending];
      for (const file of Array.from(files)) {
        collected.push(...(await fileToImageDataUrls(file)));
      }
      if (collected.length + images.length > MAX_PHOTOS) {
        setError(`사진은 합쳐서 최대 ${MAX_PHOTOS}장까지예요.`);
        setPending(collected.slice(0, Math.max(0, MAX_PHOTOS - images.length)));
      } else {
        setPending(collected);
      }
    } catch {
      setError("파일을 읽지 못했습니다. 사진 또는 PDF 파일인지 확인해 주세요.");
    }
    setPreparing(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();

    // 1) 새로 고른 사진부터 올린다 (경로: {학생}/{활동}/{화면}-{시각}.jpg)
    const paths = [...images];
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("no user");
      for (let i = 0; i < pending.length; i++) {
        const path = `${user.id}/${activityId}/${screenKey}-${Date.now()}-${i}.jpg`;
        const { error: upErr } = await supabase.storage
          .from(UPLOAD_BUCKET)
          .upload(path, dataUrlToBlob(pending[i]), {
            contentType: "image/jpeg",
            upsert: false,
          });
        if (upErr) throw upErr;
        paths.push(path);
      }
    } catch {
      setError("사진을 올리지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setSaving(false);
      return;
    }

    // 2) 글 + 사진 경로를 함께 저장
    const { error: rpcErr } = await supabase.rpc("save_screen_response", {
      p_activity_id: activityId,
      p_screen_key: screenKey,
      p_question_key: questionKey,
      p_prompt: prompt,
      p_text: text,
      p_images: paths,
    });
    if (rpcErr) {
      setError("저장에 실패했습니다. 다시 시도하세요.");
    } else {
      setImages(paths);
      setPending([]);
      setSavedAt(new Date());
      onSaved(screenKey, { text, images: paths });
    }
    setSaving(false);
  }

  function removeSaved(path: string) {
    setImages(images.filter((p) => p !== path));
  }
  function removePending(i: number) {
    setPending(pending.filter((_, idx) => idx !== i));
  }

  const empty =
    text.trim().length === 0 && images.length === 0 && pending.length === 0;
  const box =
    tone === "amber" ? "border-amber-300 bg-amber-50" : "border-blue-200 bg-blue-50";

  return (
    <form
      onSubmit={handleSave}
      className={`flex flex-col gap-2 rounded-lg border p-4 ${box}`}
    >
      <label className="text-sm font-medium text-zinc-900">✏️ {prompt}</label>
      <textarea
        rows={5}
        maxLength={4000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          allowPhoto
            ? "여기에 작성하세요. 공책에 쓴 것을 사진으로 올려도 됩니다."
            : "여기에 작성하세요 (저장 후에도 수정할 수 있어요)"
        }
        className="rounded-md border border-zinc-300 bg-white p-3 text-sm leading-relaxed focus:border-blue-500 focus:outline-none"
      />

      {allowPhoto && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={preparing || images.length + pending.length >= MAX_PHOTOS}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              📷 사진 올리기
            </button>
            <span className="text-xs text-zinc-500">
              {preparing
                ? "사진 준비 중..."
                : `공책에 쓴 것을 찍어 올려도 됩니다 (최대 ${MAX_PHOTOS}장)`}
            </span>
          </div>

          {(images.length > 0 || pending.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {images.map((p) => (
                <figure key={p} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previews[p] ?? ""}
                    alt="첨부한 사진"
                    className="h-24 w-24 rounded-md border border-zinc-300 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeSaved(p)}
                    className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-zinc-800 text-xs text-white"
                    aria-label="사진 빼기"
                  >
                    ×
                  </button>
                </figure>
              ))}
              {pending.map((src, i) => (
                <figure key={`p${i}`} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt="올릴 사진"
                    className="h-24 w-24 rounded-md border-2 border-dashed border-blue-400 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePending(i)}
                    className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-zinc-800 text-xs text-white"
                    aria-label="사진 빼기"
                  >
                    ×
                  </button>
                </figure>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || preparing || empty}
          className="self-start rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
        {savedAt && (
          <span className="text-sm text-green-600">
            ✓ 저장됨 ({savedAt.toLocaleTimeString("ko-KR")})
          </span>
        )}
        {!savedAt && saved && (saved.text || saved.images.length > 0) && (
          <span className="text-sm text-zinc-500">이전에 저장한 기록입니다.</span>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
