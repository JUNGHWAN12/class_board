"use client";

import { useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { compressImage } from "@/lib/image";
import { getSupabase, IMAGE_BUCKET } from "@/lib/supabase";

type Props = {
  boardId: string;
  onPosted: () => void;
  onError: (msg: string) => void;
};

export function PostComposer({ boardId, onPosted, onError }: Props) {
  const { userId } = useAuth();
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const pickFile = (f: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !content.trim() || saving) return;
    setSaving(true);
    const supabase = getSupabase();
    try {
      let image_path: string | null = null;
      if (file) {
        const blob = await compressImage(file);
        image_path = `${userId}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage
          .from(IMAGE_BUCKET)
          .upload(image_path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
        if (error) throw new Error(`사진 올리기 실패: ${error.message}`);
      }
      const { error } = await supabase
        .from("posts")
        .insert({ board_id: boardId, author_id: userId, content: content.trim(), image_path });
      if (error) {
        if (image_path) await supabase.storage.from(IMAGE_BUCKET).remove([image_path]);
        throw new Error(error.message);
      }
      setContent("");
      pickFile(null);
      if (fileInput.current) fileInput.current.value = "";
      onPosted();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={5000}
        rows={3}
        placeholder="생각을 남겨주세요"
        className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2"
      />
      {preview && (
        <div className="relative mt-2 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element -- 업로드 전 미리보기 */}
          <img src={preview} alt="첨부 사진 미리보기" className="max-h-40 rounded-lg" />
          <button
            type="button"
            onClick={() => {
              pickFile(null);
              if (fileInput.current) fileInput.current.value = "";
            }}
            className="absolute right-1 top-1 rounded-full bg-black/60 px-2 text-white"
            aria-label="사진 빼기"
          >
            ✕
          </button>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between">
        <label className="cursor-pointer rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100">
          📷 사진 첨부
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button
          disabled={saving || !content.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {saving ? "올리는 중…" : "올리기"}
        </button>
      </div>
    </form>
  );
}
