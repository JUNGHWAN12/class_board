"use client";

import { initialOf } from "./AppHeader";
import type { Board, Post, PostChanges } from "@/lib/types";

// 다섯 가지 보기가 함께 쓰는 작은 조각들

export type ViewProps = {
  board: Board;
  posts: Post[]; // 최신 글이 앞
  myLikes: Set<string>;
  userId: string | null;
  isTeacher: boolean;
  locked: boolean;
  imageUrl: (path: string | null) => string | null;
  onOpen: (id: string) => void;
  onLike: (post: Post) => void;
  onUpdate: (post: Post, changes: PostChanges) => void;
  onQuickPost: (content: string) => Promise<boolean>; // 대화 보기의 바로 보내기
};

export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

export function clockTime(iso: string) {
  const d = new Date(iso);
  if (Date.now() - d.getTime() > 86400_000) return d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function Avatar({ name, url, size = 36 }: { name: string; url: string | null; size?: number }) {
  const style = { width: size, height: size };
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- 구글 프로필 사진
    return <img src={url} alt="" referrerPolicy="no-referrer" style={style} className="flex-none rounded-full" />;
  }
  return (
    <span
      style={style}
      className="flex flex-none items-center justify-center rounded-full bg-leaf font-bold text-school"
      aria-hidden
    >
      {initialOf(name, name.endsWith("선생님"))}
    </span>
  );
}

export function LikeButton({ post, liked, onLike, small }: { post: Post; liked: boolean; onLike: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onLike();
      }}
      aria-pressed={liked}
      aria-label={liked ? "좋아요 취소" : "좋아요"}
      className={`inline-flex items-center gap-1 rounded-lg ${small ? "px-1 py-0.5" : "px-2 py-1"} hover:bg-black/5 ${
        liked ? "text-rose-600" : ""
      }`}
    >
      <span aria-hidden>{liked ? "❤️" : "🤍"}</span> {post.like_count}
    </button>
  );
}

export function HiddenBadge() {
  return (
    <span className="inline-block rounded-md bg-ink px-2 py-0.5 text-xs text-white">숨김 · 학생에게 안 보임</span>
  );
}

// 교사용 숨기기/삭제 버튼 (담벼락·피드 카드 아래)
export function TeacherPostTools({ post, onUpdate }: { post: Post; onUpdate: ViewProps["onUpdate"] }) {
  return (
    <div className="mt-2 flex gap-1.5 border-t border-dashed border-[#9AA9A3] pt-2" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => onUpdate(post, { is_hidden: !post.is_hidden })}
        className="h-8 rounded-lg border border-[#9AA9A3] px-2.5 text-[13px] hover:bg-white/60"
      >
        {post.is_hidden ? "다시 보이기" : "숨기기"}
      </button>
      <button
        type="button"
        onClick={() => confirm("이 글을 삭제할까요?") && onUpdate(post, { deleted_at: new Date().toISOString() })}
        className="h-8 rounded-lg border border-[#B23A3A] px-2.5 text-[13px] text-danger hover:bg-red-50"
      >
        삭제
      </button>
    </div>
  );
}

export function PostPhoto({ src, className = "" }: { src: string | null; className?: string }) {
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element -- 학생이 올린 사진 (Supabase 저장소 또는 체험 모드)
  return <img src={src} alt="학생이 올린 사진" loading="lazy" className={`block w-full object-cover ${className}`} />;
}

export function EmptyState({ locked }: { locked: boolean }) {
  return (
    <p className="py-16 text-center text-muted">
      {locked ? "아직 글이 없어요." : "아직 글이 없어요. 노란 '+ 글쓰기' 버튼으로 첫 글을 남겨 보세요."}
    </p>
  );
}

// 제목이 없는 글(대화 보기에서 쓴 글 등)은 내용 앞부분을 제목처럼 씁니다.
export function displayTitle(post: Post, max = 40) {
  if (post.title) return post.title;
  const one = post.content.replace(/\s+/g, " ").trim();
  return one.length > max ? one.slice(0, max) + "…" : one;
}
