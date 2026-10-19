"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { Avatar, timeAgo } from "./PostCard";
import { getSupabase, imageUrl } from "@/lib/supabase";
import { usePolling } from "@/lib/usePolling";
import type { Comment, Post } from "@/lib/types";

type Props = {
  post: Post;
  locked: boolean;
  onClose: () => void;
  onChanged: () => void;
  onError: (msg: string) => void;
};

export function PostModal({ post, locked, onClose, onChanged, onError }: Props) {
  const { userId, isTeacher } = useAuth();
  const [comments, setComments] = useState<Map<string, Comment>>(new Map());
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const sinceRef = useRef<string | null>(null);
  const img = imageUrl(post.image_path);

  const load = useCallback(async () => {
    const since = sinceRef.current
      ? new Date(new Date(sinceRef.current).getTime() - 10000).toISOString()
      : null;
    const { data, error } = await getSupabase().rpc("get_post_comments", { p_post: post.id, p_since: since });
    if (error) return onError(error.message);
    const rows = (data ?? []) as Comment[];
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
  }, [post.id, onError]);

  usePolling(load, 5000);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sorted = useMemo(
    () => [...comments.values()].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [comments],
  );

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !text.trim() || saving) return;
    setSaving(true);
    const { error } = await getSupabase()
      .from("comments")
      .insert({ post_id: post.id, author_id: userId, content: text.trim() });
    setSaving(false);
    if (error) return onError(error.message);
    setText("");
    load();
    onChanged();
  };

  const update = async (c: Comment, changes: Partial<{ is_hidden: boolean; deleted_at: string }>) => {
    const { error } = await getSupabase().from("comments").update(changes).eq("id", c.id);
    if (error) return onError(error.message);
    load();
    onChanged();
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-slate-100 p-4">
          <Avatar name={post.author_name} url={post.author_avatar} />
          <div className="flex-1">
            <p className="text-sm font-semibold">{post.author_name}</p>
            <p className="text-xs text-slate-400">{timeAgo(post.created_at)}</p>
          </div>
          <button onClick={onClose} className="rounded-full px-3 py-1 text-xl text-slate-500 hover:bg-slate-100" aria-label="닫기">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <p className="whitespace-pre-wrap break-words">{post.content}</p>
          {img && (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase 저장소 사진
            <img src={img} alt="첨부 사진" className="mt-3 w-full rounded-lg" />
          )}

          <h2 className="mt-6 text-sm font-semibold text-slate-500">댓글 {sorted.length}</h2>
          <ul className="mt-2 space-y-3">
            {sorted.map((c) => (
              <li key={c.id} className={`flex gap-2 ${c.is_hidden ? "opacity-60" : ""}`}>
                <Avatar name={c.author_name} url={c.author_avatar} />
                <div className="min-w-0 flex-1 rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs">
                    <span className="font-semibold">{c.author_name}</span>{" "}
                    <span className="text-slate-400">{timeAgo(c.created_at)}</span>
                    {c.is_hidden && <span className="ml-1 text-amber-700">(숨김)</span>}
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm">{c.content}</p>
                  <div className="mt-1 flex gap-2 text-xs text-slate-500">
                    {isTeacher && (
                      <button onClick={() => update(c, { is_hidden: !c.is_hidden })}>
                        {c.is_hidden ? "보이기" : "숨기기"}
                      </button>
                    )}
                    {(c.author_id === userId || isTeacher) && (
                      <button
                        className="text-red-600"
                        onClick={() => confirm("댓글을 삭제할까요?") && update(c, { deleted_at: new Date().toISOString() })}
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {locked && !isTeacher ? (
          <p className="border-t border-slate-100 p-4 text-sm text-amber-800">게시판이 잠겨 댓글을 쓸 수 없어요.</p>
        ) : (
          <form onSubmit={add} className="flex gap-2 border-t border-slate-100 p-3">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
              placeholder="댓글 달기"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
            />
            <button
              disabled={saving || !text.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-50"
            >
              등록
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
