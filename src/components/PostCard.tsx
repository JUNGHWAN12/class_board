"use client";

import { useState } from "react";
import { imageUrl } from "@/lib/supabase";
import type { Post } from "@/lib/types";

type Changes = Partial<{ content: string; is_hidden: boolean; deleted_at: string }>;

type Props = {
  post: Post;
  liked: boolean;
  canEdit: boolean;
  isTeacher: boolean;
  onLike: () => void;
  onOpen: () => void;
  onUpdate: (changes: Changes) => void;
};

export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

export function PostCard({ post, liked, canEdit, isTeacher, onLike, onOpen, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.content);
  const img = imageUrl(post.image_path);

  const remove = () => {
    if (confirm("이 글을 삭제할까요?")) onUpdate({ deleted_at: new Date().toISOString() });
  };

  return (
    <article
      className={`mb-4 break-inside-avoid rounded-xl border bg-white p-4 shadow-sm ${
        post.is_hidden ? "border-amber-300 opacity-70" : "border-slate-200"
      }`}
    >
      <header className="flex items-center gap-2">
        <Avatar name={post.author_name} url={post.author_avatar} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{post.author_name}</p>
          <p className="text-xs text-slate-400">{timeAgo(post.created_at)}</p>
        </div>
        {post.is_hidden && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">숨김</span>
        )}
      </header>

      {editing ? (
        <div className="mt-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={5000}
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-2 py-1"
          />
          <div className="mt-1 flex justify-end gap-2 text-sm">
            <button onClick={() => setEditing(false)} className="px-2 py-1 text-slate-500">취소</button>
            <button
              disabled={!draft.trim()}
              onClick={() => {
                onUpdate({ content: draft.trim() });
                setEditing(false);
              }}
              className="rounded bg-indigo-600 px-3 py-1 text-white disabled:opacity-50"
            >
              저장
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-3 whitespace-pre-wrap break-words">{post.content}</p>
      )}

      {img && (
        <button onClick={onOpen} className="mt-3 block w-full">
          {/* eslint-disable-next-line @next/next/no-img-element -- Supabase 저장소 사진 */}
          <img src={img} alt="첨부 사진" loading="lazy" className="w-full rounded-lg" />
        </button>
      )}

      <footer className="mt-3 flex flex-wrap items-center gap-1 text-sm text-slate-600">
        <button onClick={onLike} className={`rounded-lg px-2 py-1 hover:bg-slate-100 ${liked ? "text-rose-600" : ""}`}>
          {liked ? "❤️" : "🤍"} {post.like_count}
        </button>
        <button onClick={onOpen} className="rounded-lg px-2 py-1 hover:bg-slate-100">
          💬 {post.comment_count}
        </button>
        <span className="flex-1" />
        {canEdit && !editing && (
          <button
            onClick={() => {
              setDraft(post.content);
              setEditing(true);
            }}
            className="rounded px-2 py-1 text-xs hover:bg-slate-100"
          >
            수정
          </button>
        )}
        {isTeacher && (
          <button onClick={() => onUpdate({ is_hidden: !post.is_hidden })} className="rounded px-2 py-1 text-xs hover:bg-slate-100">
            {post.is_hidden ? "보이기" : "숨기기"}
          </button>
        )}
        {(canEdit || isTeacher) && (
          <button onClick={remove} className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50">
            삭제
          </button>
        )}
      </footer>
    </article>
  );
}

export function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- 구글 프로필 사진
    return <img src={url} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full" />;
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
      {name.slice(0, 1)}
    </span>
  );
}
