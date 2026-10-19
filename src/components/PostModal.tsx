"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { Modal } from "./Modal";
import { Avatar, HiddenBadge, LikeButton, PostPhoto, timeAgo } from "./postBits";
import { getStore } from "@/lib/store";
import { usePolling } from "@/lib/usePolling";
import type { Comment, CommentChanges, Post, PostChanges } from "@/lib/types";

type Props = {
  post: Post;
  liked: boolean;
  locked: boolean;
  onClose: () => void;
  onLike: () => void;
  onUpdate: (changes: PostChanges) => Promise<void>;
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

  return (
    <Modal
      wide
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Avatar name={post.author_name} url={post.author_avatar} />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{post.author_name}</p>
            <p className="text-xs text-muted">
              {timeAgo(post.created_at)}
              {post.section && ` · ${post.section}`}
            </p>
          </div>
        </div>
      }
      footer={
        canComment ? (
          <form onSubmit={add} className="flex gap-2 p-3">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
              placeholder="댓글 달기"
              className="field flex-1"
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
      {post.is_hidden && (
        <div className="mb-2">
          <HiddenBadge />
        </div>
      )}
      {post.title && <h2 className="mb-2 font-display text-2xl">{post.title}</h2>}
      {editing ? (
        <div>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={5000} rows={5} className="field" />
          <div className="mt-1 flex justify-end gap-2 text-sm">
            <button type="button" onClick={() => setEditing(false)} className="px-2 py-1 text-muted">
              취소
            </button>
            <button
              type="button"
              disabled={!draft.trim()}
              onClick={async () => {
                await onUpdate({ content: draft.trim() });
                setEditing(false);
              }}
              className="rounded-lg bg-school px-3 py-1 text-white disabled:opacity-50"
            >
              저장
            </button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap break-words leading-relaxed">{post.content}</p>
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
              await onUpdate({ deleted_at: new Date().toISOString() });
              onClose();
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
            <div className="min-w-0 flex-1 rounded-xl bg-paper px-3 py-2">
              <p className="text-xs">
                <span className="font-semibold">{c.author_name}</span>{" "}
                <span className="text-muted">{timeAgo(c.created_at)}</span>
                {c.is_hidden && <span className="ml-1 text-cream-ink">(숨김)</span>}
              </p>
              <p className="whitespace-pre-wrap break-words text-sm">{c.content}</p>
              <div className="mt-1 flex gap-2 text-xs text-muted">
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
