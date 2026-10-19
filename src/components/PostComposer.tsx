"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import type { Board, PostInput } from "@/lib/types";

type Props = {
  board: Board;
  canAttach: boolean;
  onClose: () => void;
  onSubmit: (input: PostInput) => Promise<boolean>;
};

// 노란 '+ 글쓰기' 버튼으로 여는 글쓰기 창
export function PostComposer({ board, canAttach, onClose, onSubmit }: Props) {
  const [section, setSection] = useState(board.sections[0] ?? "");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pickFile = (f: File | null) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    if (!f && fileInput.current) fileInput.current.value = "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || saving) return;
    setSaving(true);
    const ok = await onSubmit({
      board_id: board.id,
      title: title.trim(),
      content: content.trim(),
      section,
      image: canAttach ? file : null,
    });
    if (ok) onClose();
    else setSaving(false);
  };

  return (
    <Modal title={<b className="font-display text-xl font-normal">{board.title}에 글쓰기</b>} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {board.sections.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="칸 고르기">
            {board.sections.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={section === s}
                onClick={() => setSection(s)}
                className={`min-h-9 rounded-full border px-3 text-sm ${
                  section === s ? "border-school bg-school text-white" : "border-line bg-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <input
          className="field"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          placeholder="제목 (선택)"
        />
        <textarea
          className="field resize-y"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={5000}
          rows={5}
          placeholder={board.notice || "생각을 남겨 주세요"}
          autoFocus
        />
        {preview && (
          <div className="relative inline-block self-start">
            {/* eslint-disable-next-line @next/next/no-img-element -- 업로드 전 미리보기 */}
            <img src={preview} alt="첨부 사진 미리보기" className="max-h-40 rounded-lg" />
            <button
              type="button"
              onClick={() => pickFile(null)}
              className="absolute right-1 top-1 rounded-full bg-black/60 px-2 text-white"
              aria-label="사진 빼기"
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          {canAttach ? (
            <label className="cursor-pointer rounded-lg px-2 py-1 text-sm text-ink-soft hover:bg-paper">
              📷 사진 첨부
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
            </label>
          ) : (
            <span className="text-xs text-muted">이 게시판은 사진을 올릴 수 없어요</span>
          )}
          <button disabled={saving || !content.trim()} className="write-btn">
            {saving ? "올리는 중…" : "올리기"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
