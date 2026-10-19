"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { PostCard } from "./PostCard";
import { PostComposer } from "./PostComposer";
import { PostModal } from "./PostModal";
import { getSupabase } from "@/lib/supabase";
import { usePolling } from "@/lib/usePolling";
import type { Board, Post } from "@/lib/types";

// 새 글 확인 간격. 무료 요금제에 맞춰 실시간 연결 대신 짧은 간격으로 확인합니다.
const POLL_MS = 5000;
// 저장 순서와 시간 차이로 글을 놓치지 않도록 조금 겹쳐서 가져옵니다.
const OVERLAP_MS = 10000;

export function BoardView() {
  const { id: boardId } = useParams<{ id: string }>();
  const { userId, isTeacher } = useAuth();
  const [board, setBoard] = useState<Board | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [posts, setPosts] = useState<Map<string, Post>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const sinceRef = useRef<string | null>(null);

  const loadBoard = useCallback(async () => {
    const { data, error } = await getSupabase().from("boards").select("*").eq("id", boardId).maybeSingle();
    if (error) return setError(error.message);
    if (!data) setNotFound(true);
    else setBoard(data as Board);
  }, [boardId]);

  const loadPosts = useCallback(async () => {
    const since = sinceRef.current
      ? new Date(new Date(sinceRef.current).getTime() - OVERLAP_MS).toISOString()
      : null;
    const { data, error } = await getSupabase().rpc("get_board_posts", { p_board: boardId, p_since: since });
    if (error) return setError(error.message);
    const rows = (data ?? []) as Post[];
    for (const r of rows) {
      if (!sinceRef.current || r.updated_at > sinceRef.current) sinceRef.current = r.updated_at;
    }
    setPosts((prev) => {
      if (rows.length === 0 && since) return prev;
      const next = new Map(prev);
      for (const r of rows) {
        if (r.removed) next.delete(r.id);
        else next.set(r.id, r);
      }
      return next;
    });
    setLoaded(true);
  }, [boardId]);

  useEffect(() => {
    if (!userId) return;
    getSupabase()
      .from("likes")
      .select("post_id")
      .eq("user_id", userId)
      .then(({ data }) => setMyLikes(new Set((data ?? []).map((r) => r.post_id as string))));
  }, [userId]);

  usePolling(loadPosts, POLL_MS);
  usePolling(loadBoard, 30000);

  const sorted = useMemo(
    () => [...posts.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [posts],
  );

  const toggleLike = async (post: Post) => {
    if (!userId) return;
    const liked = myLikes.has(post.id);
    const supabase = getSupabase();
    setMyLikes((s) => {
      const n = new Set(s);
      if (liked) n.delete(post.id);
      else n.add(post.id);
      return n;
    });
    setPosts((m) => {
      const n = new Map(m);
      n.set(post.id, { ...post, like_count: Math.max(0, post.like_count + (liked ? -1 : 1)) });
      return n;
    });
    const { error } = liked
      ? await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", userId)
      : await supabase.from("likes").insert({ post_id: post.id, user_id: userId });
    if (error && error.code !== "23505") setError(error.message);
    loadPosts();
  };

  const updatePost = async (post: Post, changes: Partial<{ content: string; is_hidden: boolean; deleted_at: string }>) => {
    const supabase = getSupabase();
    const { error } = await supabase.from("posts").update(changes).eq("id", post.id);
    if (error) return setError(error.message);
    if (changes.deleted_at && post.image_path) {
      await supabase.storage.from("post-images").remove([post.image_path]);
    }
    loadPosts();
  };

  const toggleLock = async () => {
    if (!board) return;
    const { data, error } = await getSupabase()
      .from("boards")
      .update({ is_locked: !board.is_locked })
      .eq("id", board.id)
      .select()
      .single();
    if (error) return setError(error.message);
    setBoard(data as Board);
  };

  const exportCsv = async () => {
    const { data, error } = await getSupabase().rpc("export_board", { p_board: boardId });
    if (error) return setError(error.message);
    const header = ["구분", "글번호", "이름", "이메일", "내용", "좋아요", "숨김", "작성시각"];
    const ids = new Map<string, number>();
    const lines = (data as Record<string, unknown>[]).map((r) => {
      const pid = r.post_id as string;
      if (!ids.has(pid)) ids.set(pid, ids.size + 1);
      return [
        r.kind,
        ids.get(pid),
        r.author_name,
        r.author_email,
        r.content,
        r.like_count ?? "",
        r.is_hidden ? "숨김" : "",
        new Date(r.created_at as string).toLocaleString("ko-KR"),
      ];
    });
    const csv = [header, ...lines]
      .map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${board?.title ?? "게시판"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (notFound) {
    return <p className="px-4 py-24 text-center text-slate-500">게시판을 찾을 수 없습니다.</p>;
  }

  const locked = board?.is_locked ?? false;
  const openPost = openPostId ? posts.get(openPostId) : undefined;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {locked && <span title="잠김">🔒 </span>}
            {board?.title ?? "…"}
          </h1>
          {board?.description && <p className="mt-1 whitespace-pre-wrap text-slate-600">{board.description}</p>}
        </div>
        {isTeacher && board && (
          <div className="flex gap-2">
            <button onClick={toggleLock} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">
              {locked ? "🔓 잠금 해제" : "🔒 게시판 잠그기"}
            </button>
            <button onClick={exportCsv} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">
              ⬇️ 엑셀(CSV) 내보내기
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-4 flex justify-between rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError("")} aria-label="닫기">✕</button>
        </p>
      )}

      {locked && !isTeacher ? (
        <p className="mt-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">선생님이 게시판을 잠갔습니다. 지금은 글을 쓸 수 없어요.</p>
      ) : (
        <PostComposer boardId={boardId} onPosted={loadPosts} onError={setError} />
      )}

      {!loaded && <p className="mt-8 text-slate-500">불러오는 중…</p>}
      {loaded && sorted.length === 0 && <p className="mt-8 text-slate-500">첫 글을 남겨보세요.</p>}

      <div className="mt-6 columns-1 gap-4 sm:columns-2 lg:columns-3">
        {sorted.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            liked={myLikes.has(p.id)}
            canEdit={p.author_id === userId && (!locked || isTeacher)}
            isTeacher={isTeacher}
            onLike={() => toggleLike(p)}
            onOpen={() => setOpenPostId(p.id)}
            onUpdate={(changes) => updatePost(p, changes)}
          />
        ))}
      </div>

      {openPost && (
        <PostModal
          post={openPost}
          locked={locked}
          onClose={() => setOpenPostId(null)}
          onChanged={loadPosts}
          onError={setError}
        />
      )}
    </div>
  );
}
