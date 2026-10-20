"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { Modal } from "./Modal";
import { RichText } from "./RichText";
import { Avatar, HiddenBadge, KindBadge, LikeButton, PostPhoto, timeAgo } from "./postBits";
import { getStore } from "@/lib/store";
import { usePolling } from "@/lib/usePolling";
import { MAX_CONTENT, type Comment, type CommentChanges, type Post, type PostChanges } from "@/lib/types";

type Props = {
  post: Post;
  liked: boolean;
  locked: boolean;
  onClose: () => void;
  onLike: () => void;
  onUpdate: (changes: PostChanges) => Promise<boolean>; // 성공하면 true
  onChanged: () => void;
  onError: (msg: string) => void;
};

// 글 자세히 보기 + 댓글
export function PostModal({ post, liked, locked, onClose, onLike, onUpdate, onChanged, onError }: Props) {
  const { userId, isTeacher } = useAuth();
  const store = getStore();
  const [comments, setComments] = useState<Map<string, Comment>>(new Map());
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.content);
  const sinceRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const since = sinceRef.current
      ? new Date(new Date(sinceRef.current).getTime() - 10000).toISOString()
      : null;
    try {
      const rows = await getStore().getComments(post.id, since);
      for (const r of rows) {
        if (!sinceRef.current || r.updated_at > sinceRef.current) sinceRef.current = r.updated_at;
      }
      if (rows.length === 0 && since) return;
      setComments((prev) => {
        const next = new Map(prev);
        for (const r of rows) {
          if (r.removed) next.delete(r.id);
          else next.set(r.id, r);
        }
        return next;
      });
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  }, [post.id, onError]);

  usePolling(load, 5000);

  const sorted = useMemo(
    () => [...comments.values()].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [comments],
  );

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
      load();
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !text.trim() || saving) return;
    setSaving(true);
    await run(async () => {
      await store.addComment(post.id, userId, text.trim());
      setText("");
    });
    setSaving(false);
  };

  const updateComment = (c: Comment, changes: CommentChanges) => run(() => store.updateComment(c.id, changes));

  const canEdit = post.author_id === userId && (!locked || isTeacher);
  const canComment = !locked || isTeacher;
  // 질문한 학생이나 교사가 도움이 된 댓글을 채택하면 '해결됨' (계획서 2-2)
  const canAdopt = post.kind === "question" && (post.author_id === userId || isTeacher) && (!locked || isTeacher);

  // 쓰던 댓글이나 고치던 내용이 있으면 닫기 전에 묻습니다.
  const dirty = Boolean(text.trim()) || (editing && draft.trim() !== post.content);

  return (
    <Modal
      wide
      dirty={dirty}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Avatar name={post.author_name} url={post.author_avatar} />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{post.author_name}</p>
            <p className="text-xs text-muted">
              {timeAgo(post.created_at)}
              {post.section && ` · ${post.section}`}
              {post.edited_at && (
                <span title={new Date(post.edited_at).toLocaleString("ko-KR")}> · 수정됨 {timeAgo(post.edited_at)}</span>
              )}
            </p>
          </div>
        </div>
      }
      footer={
        canComment ? (
          <form onSubmit={add} className="flex items-end gap-2 p-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                // Enter 는 줄바꿈 (코드 답글), Ctrl/⌘+Enter 로 등록
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) add(e);
                if (e.key === "Tab" && !e.shiftKey) {
                  e.preventDefault();
                  const el = e.currentTarget;
                  const { selectionStart: a, selectionEnd: b } = el;
                  setText(text.slice(0, a) + "    " + text.slice(b));
                  requestAnimationFrame(() => el.setSelectionRange(a + 4, a + 4));
                }
              }}
              maxLength={5000}
              rows={text.includes("\n") ? 4 : 1}
              placeholder="댓글 달기 (``` 로 감싸면 코드)"
              className="field flex-1 resize-y"
            />
            <button disabled={saving || !text.trim()} className="rounded-xl bg-school px-4 py-2 text-white disabled:opacity-50">
              등록
            </button>
          </form>
        ) : (
          <p className="p-4 text-sm text-cream-ink">게시판이 잠겨 댓글을 쓸 수 없어요.</p>
        )
      }
    >
      <div className="mb-2 flex flex-wrap gap-1.5 empty:hidden">
        <KindBadge post={post} />
        {post.is_hidden && <HiddenBadge />}
      </div>
      {post.title && <h2 className="mb-2 font-display text-2xl">{post.title}</h2>}
      {editing ? (
        <div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_CONTENT}
            rows={8}
            spellCheck={false}
            className="field font-mono text-[13px]"
          />
          <div className="mt-1 flex justify-end gap-2 text-sm">
            <button type="button" onClick={() => setEditing(false)} className="px-2 py-1 text-muted">
              취소
            </button>
            <button
              type="button"
              disabled={!draft.trim()}
              onClick={async () => {
                // 저장에 실패하면 고친 내용이 사라지지 않게 수정 창을 열어 둡니다.
                if (await onUpdate({ content: draft.trim() })) setEditing(false);
              }}
              className="rounded-lg bg-school px-3 py-1 text-white disabled:opacity-50"
            >
              저장
            </button>
          </div>
        </div>
      ) : (
        <RichText text={post.content} className="leading-relaxed" />
      )}
      <PostPhoto src={store.imageUrl(post.image_path)} className="mt-3 rounded-lg" />

      <div className="mt-3 flex flex-wrap items-center gap-1 text-sm text-ink-soft">
        <LikeButton post={post} liked={liked} onLike={onLike} />
        <span className="px-2">💬 {sorted.length}</span>
        <span className="flex-1" />
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(post.content);
              setEditing(true);
            }}
            className="rounded-lg px-2 py-1 text-xs hover:bg-paper"
          >
            수정
          </button>
        )}
        {isTeacher && (
          <button type="button" onClick={() => onUpdate({ is_hidden: !post.is_hidden })} className="rounded-lg px-2 py-1 text-xs hover:bg-paper">
            {post.is_hidden ? "다시 보이기" : "숨기기"}
          </button>
        )}
        {(canEdit || isTeacher) && (
          <button
            type="button"
            onClick={async () => {
              if (!confirm("이 글을 삭제할까요?")) return;
              if (await onUpdate({ deleted_at: new Date().toISOString() })) onClose();
            }}
            className="rounded-lg px-2 py-1 text-xs text-danger hover:bg-red-50"
          >
            삭제
          </button>
        )}
      </div>

      <h3 className="mt-5 text-sm font-semibold text-muted">댓글 {sorted.length}</h3>
      <ul className="mt-2 space-y-3">
        {sorted.map((c) => (
          <li key={c.id} className={`flex gap-2 ${c.is_hidden ? "opacity-60" : ""}`}>
            <Avatar name={c.author_name} url={c.author_avatar} size={32} />
            <div
              className={`min-w-0 flex-1 rounded-xl px-3 py-2 ${
                post.solved_comment_id === c.id ? "border-2 border-school bg-leaf" : "bg-paper"
              }`}
            >
              {post.solved_comment_id === c.id && <p className="mb-0.5 text-xs font-bold text-school">✓ 채택된 답변</p>}
              <p className="text-xs">
                <span className="font-semibold">{c.author_name}</span>{" "}
                <span className="text-muted">{timeAgo(c.created_at)}</span>
                {c.is_hidden && <span className="ml-1 text-cream-ink">(숨김)</span>}
              </p>
              <RichText text={c.content} className="text-sm" />
              <div className="mt-1 flex gap-2 text-xs text-muted">
                {canAdopt && c.author_id !== post.author_id && (
                  <button
                    type="button"
                    className="font-semibold text-school"
                    onClick={() => onUpdate({ solved_comment_id: post.solved_comment_id === c.id ? null : c.id })}
                  >
                    {post.solved_comment_id === c.id ? "채택 취소" : "✓ 채택"}
                  </button>
                )}
                {isTeacher && (
                  <button type="button" onClick={() => updateComment(c, { is_hidden: !c.is_hidden })}>
                    {c.is_hidden ? "보이기" : "숨기기"}
                  </button>
                )}
                {(c.author_id === userId || isTeacher) && (
                  <button
                    type="button"
                    className="text-danger"
                    onClick={() => confirm("댓글을 삭제할까요?") && updateComment(c, { deleted_at: new Date().toISOString() })}
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
