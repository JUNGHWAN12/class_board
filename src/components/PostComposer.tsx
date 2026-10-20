"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import { RichText } from "./RichText";
import { CODE_LANGS } from "@/lib/code";
import { KINDS, MAX_CONTENT, type Board, type PostInput, type PostKind } from "@/lib/types";

type Props = {
  board: Board;
  canAttach: boolean;
  onClose: () => void;
  onSubmit: (input: PostInput) => Promise<boolean>;
  /** 처음에 채워 둘 내용 (draw_flow 에서 보낸 글) */
  initial?: { kind: PostKind; title: string; content: string };
};

// 질문 양식 칸을 글 하나로 합칩니다. RichText 가 ```error 를 빨간 상자로 보여줍니다.
export function buildQuestion(q: { ask: string; lang: string; code: string; error: string; tried: string }) {
  const parts: string[] = [];
  if (q.ask.trim()) parts.push(q.ask.trim());
  if (q.code.trim()) parts.push("```" + q.lang + "\n" + q.code.replace(/\s+$/, "") + "\n```");
  if (q.error.trim()) parts.push("```error\n" + q.error.replace(/\s+$/, "") + "\n```");
  if (q.tried.trim()) parts.push("해 본 것: " + q.tried.trim());
  return parts.join("\n");
}

// 글쓰기 창에서 Tab = 스페이스 4칸 (파이썬 들여쓰기, 계획서 2-1)
function useCodeEditing(value: string, setValue: (v: string) => void) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const insert = (before: string, after = "") => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    setValue(value.slice(0, start) + before + value.slice(start, end) + after + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      const pos = start + before.length + (end - start);
      el?.setSelectionRange(pos, pos);
    });
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      insert("    ");
    }
  };
  return { ref, insert, onKeyDown };
}

export function PostComposer({ board, canAttach, onClose, onSubmit, initial }: Props) {
  const [kind, setKind] = useState<PostKind>(initial?.kind ?? board.default_kind);
  const [section, setSection] = useState(board.sections[0] ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  // 질문 양식
  const [ask, setAsk] = useState("");
  const [lang, setLang] = useState("python");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [tried, setTried] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const { ref: bodyRef, insert: bodyInsert, onKeyDown: bodyKeyDown } = useCodeEditing(content, setContent);
  const { ref: codeRef, onKeyDown: codeKeyDown } = useCodeEditing(code, setCode);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const pickFile = (f: File | null) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    if (!f && fileInput.current) fileInput.current.value = "";
  };

  const isQuestion = kind === "question";
  const finalContent = isQuestion ? buildQuestion({ ask, lang, code, error, tried }) : content.trim();
  const tooLong = finalContent.length > MAX_CONTENT;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finalContent || tooLong || saving) return;
    setSaving(true);
    const ok = await onSubmit({
      board_id: board.id,
      kind,
      title: title.trim(),
      content: finalContent,
      section,
      image: canAttach ? file : null,
    });
    if (ok) onClose();
    else setSaving(false);
  };

  return (
    <Modal wide title={<b className="font-display text-xl font-normal">{board.title}에 글쓰기</b>} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl bg-tab p-1" role="radiogroup" aria-label="글 종류">
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              role="radio"
              aria-checked={kind === k.key}
              onClick={() => setKind(k.key)}
              className={`min-h-9 flex-1 rounded-lg px-3 text-sm ${kind === k.key ? "bg-school text-white" : ""}`}
            >
              {k.label}
            </button>
          ))}
        </div>

        {board.sections.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="칸 고르기">
            {board.sections.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={section === s}
                onClick={() => setSection(s)}
                className={`min-h-8 rounded-full border px-3 text-sm ${
                  section === s ? "border-school bg-school text-white" : "border-line bg-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="제목 (선택)" />

        {showPreview ? (
          <div className="min-h-32 rounded-xl border border-dashed border-line p-3">
            {finalContent ? <RichText text={finalContent} className="text-[15px] leading-relaxed" /> : <p className="text-muted">아직 내용이 없어요.</p>}
          </div>
        ) : isQuestion ? (
          <div className="flex flex-col gap-2.5 text-sm">
            <label className="flex flex-col gap-1">
              무엇이 궁금한가요?
              <input className="field" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="예: 2번째 줄에서 에러가 나요" />
            </label>
            <div className="flex flex-col gap-1">
              <span className="flex items-center justify-between">
                ① 내 코드
                <select value={lang} onChange={(e) => setLang(e.target.value)} className="h-8 rounded-lg border border-line bg-white px-2" aria-label="코드 언어">
                  {CODE_LANGS.map((l) => (
                    <option key={l.key} value={l.key}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </span>
              <textarea
                ref={codeRef}
                onKeyDown={codeKeyDown}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                rows={6}
                spellCheck={false}
                placeholder="코드를 붙여 넣으세요 (Tab = 들여쓰기)"
                className="field resize-y font-mono text-[13px]"
              />
            </div>
            <label className="flex flex-col gap-1">
              ② 에러 메시지 (또는 실행 결과)
              <textarea
                value={error}
                onChange={(e) => setError(e.target.value)}
                rows={3}
                spellCheck={false}
                placeholder="빨간 글씨로 나온 에러를 그대로 붙여 넣으세요"
                className="field resize-y border-[#D9534F] font-mono text-[13px]"
              />
            </label>
            <label className="flex flex-col gap-1">
              ③ 해 본 것
              <input className="field" value={tried} onChange={(e) => setTried(e.target.value)} placeholder="예: 들여쓰기를 다시 맞춰 봤어요" />
            </label>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <textarea
              ref={bodyRef}
              onKeyDown={bodyKeyDown}
              className="field resize-y"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={7}
              placeholder={board.notice || "생각을 남겨 주세요"}
              autoFocus
            />
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
              <label className="flex items-center gap-1 rounded-lg px-1 hover:bg-paper">
                <span className="font-mono">&lt;/&gt;</span>
                <select
                  value=""
                  aria-label="코드 넣기"
                  onChange={(e) => {
                    const l = e.target.value === "-" ? "" : e.target.value;
                    bodyInsert("\n```" + l + "\n", "\n```\n");
                  }}
                  className="h-8 cursor-pointer bg-transparent"
                >
                  <option value="" disabled>
                    코드 넣기
                  </option>
                  {CODE_LANGS.map((l) => (
                    <option key={l.key} value={l.key || "-"}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
              <span className="text-xs text-muted">Tab 키 = 들여쓰기 4칸</span>
            </div>
          </div>
        )}

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
        {tooLong && <p className="text-sm text-red-700">글이 너무 길어요 ({finalContent.length.toLocaleString()} / {MAX_CONTENT.toLocaleString()}자)</p>}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1 text-sm text-ink-soft">
            {canAttach ? (
              <label className="cursor-pointer rounded-lg px-2 py-1 hover:bg-paper">
                📷 사진 첨부
                <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
              </label>
            ) : (
              <span className="text-xs text-muted">이 게시판은 사진을 올릴 수 없어요</span>
            )}
            <button type="button" onClick={() => setShowPreview((v) => !v)} className="rounded-lg px-2 py-1 hover:bg-paper">
              {showPreview ? "✏️ 계속 쓰기" : "👀 미리보기"}
            </button>
          </div>
          <button disabled={saving || !finalContent || tooLong} className="write-btn">
            {saving ? "올리는 중…" : "올리기"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
