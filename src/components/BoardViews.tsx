"use client";

import { useEffect, useRef, useState } from "react";
import { RichText } from "./RichText";
import {
  Avatar,
  clockTime,
  displayTitle,
  EmptyState,
  HiddenBadge,
  KindBadge,
  LikeButton,
  PostPhoto,
  TeacherPostTools,
  timeAgo,
  type ViewProps,
} from "./postBits";
import type { Post } from "@/lib/types";

// 담벼락: 색깔 포스트잇이 벽에 붙는 방식
const TINTS = ["#FFF3B8", "#DDEFE6", "#E3EAF6", "#F8E1DA"];
// 새 글이 올라와도 기존 포스트잇 색이 바뀌지 않도록 글 id 로 색을 정합니다.
function tintOf(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return TINTS[Math.abs(h) % TINTS.length];
}

// 카드 전체를 눌러 글 보기. 키보드로도 Tab 으로 가서 Enter·Space 로 열 수 있게 합니다.
// (카드 안의 좋아요·복사 버튼에서 누른 키는 그 버튼이 처리)
function openable(post: Post, onOpen: (id: string) => void) {
  return {
    tabIndex: 0,
    "aria-label": `${displayTitle(post)} — ${post.author_name} 글 열기`,
    onClick: () => onOpen(post.id),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
      e.preventDefault();
      onOpen(post.id);
    },
  };
}

export function WallView(p: ViewProps) {
  if (p.posts.length === 0) return <EmptyState locked={p.locked} />;
  return (
    <div className="gap-[18px] [column-width:260px]">
      {p.posts.map((post) => (
        <article
          key={post.id}
          {...openable(post, p.onOpen)}
          className={`mb-[18px] cursor-pointer break-inside-avoid rounded p-3.5 shadow-[0_2px_6px_rgba(28,43,39,0.14)] transition hover:shadow-[0_4px_12px_rgba(28,43,39,0.2)] ${
            post.is_hidden ? "border-2 border-dashed border-muted" : ""
          }`}
          style={{ background: post.is_hidden ? "#FFFFFF" : tintOf(post.id) }}
        >
          {post.is_hidden && (
            <div className="mb-1.5">
              <HiddenBadge />
            </div>
          )}
          <KindBadge post={post} />
          {post.title && <h2 className="mb-2 mt-1 font-display text-[21px] leading-tight">{post.title}</h2>}
          <PostPhoto src={p.imageUrl(post.image_path)} className="max-h-[260px] rounded-sm" />
          <RichText text={post.content} foldLines={10} compact className="my-2 text-[15px] leading-normal" />
          <div className="flex items-center justify-between text-[13px] text-ink-soft">
            <span>
              {post.author_name} · {timeAgo(post.created_at)}
            </span>
            <span className="flex items-center">
              <LikeButton post={post} liked={p.myLikes.has(post.id)} onLike={() => p.onLike(post)} small />
              <span className="px-1">💬 {post.comment_count}</span>
            </span>
          </div>
          {p.isTeacher && <TeacherPostTools post={post} onUpdate={p.onUpdate} />}
        </article>
      ))}
    </div>
  );
}

// 목록: 학교 홈페이지 게시판처럼 번호·제목·댓글 수
export function ListView(p: ViewProps) {
  if (p.posts.length === 0) return <EmptyState locked={p.locked} />;
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full min-w-[600px] border-collapse text-[15px]">
        <thead>
          <tr className="bg-tab text-left text-[13px] text-ink-soft">
            <th className="w-14 px-3.5 py-2.5 text-center font-normal">번호</th>
            <th className="px-3.5 py-2.5 font-normal">제목</th>
            <th className="w-24 px-3.5 py-2.5 font-normal">작성자</th>
            <th className="w-20 px-3.5 py-2.5 font-normal">시간</th>
            <th className="w-20 px-3.5 py-2.5 text-center font-normal">좋아요</th>
            <th className="w-16 px-3.5 py-2.5 text-center font-normal">댓글</th>
          </tr>
        </thead>
        <tbody>
          {p.posts.map((post, i) => (
            <tr key={post.id} className={`border-t border-line-soft ${post.is_hidden ? "bg-paper text-muted" : ""}`}>
              <td className="px-3.5 py-3 text-center text-muted">{p.posts.length - i}</td>
              <td className="px-3.5 py-3">
                <button type="button" onClick={() => p.onOpen(post.id)} className="text-left text-school hover:underline">
                  {displayTitle(post)}
                </button>{" "}
                <KindBadge post={post} />{" "}
                <span className="text-xs text-muted">
                  {post.section && `[${post.section}]`}
                  {post.image_path && " [사진]"}
                  {post.is_hidden && " [숨김]"}
                </span>
              </td>
              <td className="px-3.5 py-3">{post.author_name}</td>
              <td className="px-3.5 py-3 text-muted">{clockTime(post.created_at)}</td>
              <td className="px-3.5 py-3 text-center">
                <LikeButton post={post} liked={p.myLikes.has(post.id)} onLike={() => p.onLike(post)} small />
              </td>
              <td className="px-3.5 py-3 text-center">{post.comment_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 피드: 사진이 크게 한 줄로 내려오는 방식 (휴대폰에 맞춤)
export function FeedView(p: ViewProps) {
  if (p.posts.length === 0) return <EmptyState locked={p.locked} />;
  return (
    <div className="mx-auto flex max-w-[600px] flex-col gap-[18px]">
      {p.posts.map((post) => (
        <article
          key={post.id}
          className={`overflow-hidden rounded-2xl border bg-white ${post.is_hidden ? "border-2 border-dashed border-muted" : "border-line"}`}
        >
          <div className="flex items-center gap-2.5 px-3.5 py-3">
            <Avatar name={post.author_name} url={post.author_avatar} />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-bold">{post.author_name}</div>
              <div className="text-xs text-muted">
                {timeAgo(post.created_at)}
                {post.section && ` · ${post.section}`}
              </div>
            </div>
            <KindBadge post={post} />
            {post.is_hidden && <HiddenBadge />}
          </div>
          <button type="button" className="block w-full" onClick={() => p.onOpen(post.id)}>
            <PostPhoto src={p.imageUrl(post.image_path)} className="max-h-[520px]" />
          </button>
          <div className="flex flex-col gap-1.5 px-3.5 py-3">
            <div className="text-[15px] leading-relaxed">
              {post.title && <b className="block">{post.title}</b>}
              <RichText text={post.content} foldLines={15} compact />
            </div>
            <div className="-ml-2 flex items-center text-sm text-ink-soft">
              <LikeButton post={post} liked={p.myLikes.has(post.id)} onLike={() => p.onLike(post)} />
              <button type="button" className="rounded-lg px-2 py-1 hover:bg-black/5" onClick={() => p.onOpen(post.id)}>
                💬 댓글 {post.comment_count}
              </button>
            </div>
            {p.isTeacher && <TeacherPostTools post={post} onUpdate={p.onUpdate} />}
          </div>
        </article>
      ))}
    </div>
  );
}

// 칸별: 게시판의 칸(모둠·질문 종류 등)으로 글을 나눠 보기
export function GroupView(p: ViewProps) {
  const known = new Set(p.board.sections);
  const groups = p.board.sections.map((name) => ({ name, posts: p.posts.filter((x) => x.section === name) }));
  const others = p.posts.filter((x) => !known.has(x.section));
  if (others.length > 0 || groups.length === 0) groups.push({ name: groups.length ? "기타" : "전체", posts: others });

  return (
    <div className="overflow-x-auto pb-2">
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${groups.length}, minmax(220px, 1fr))`,
          minWidth: groups.length * 236,
        }}
      >
        {groups.map((g) => (
          <section key={g.name} className="flex flex-col gap-2.5 rounded-xl bg-sage p-3">
            <h2 className="font-display text-[21px]">
              {g.name} <span className="font-body text-sm text-muted">{g.posts.length}</span>
            </h2>
            {g.posts.length === 0 && <p className="py-4 text-center text-[13px] text-muted">아직 글이 없어요</p>}
            {g.posts.map((post) => (
              <article
                key={post.id}
                {...openable(post, p.onOpen)}
                className={`flex cursor-pointer flex-col gap-1.5 rounded-lg bg-white p-3 hover:shadow ${
                  post.is_hidden ? "border-2 border-dashed border-muted" : ""
                }`}
              >
                {/* 세로 flex 안에서 배지가 카드 폭만큼 늘어나지 않게 감쌉니다 */}
                {post.is_hidden && (
                  <div className="self-start">
                    <HiddenBadge />
                  </div>
                )}
                <div className="self-start empty:hidden">
                  <KindBadge post={post} />
                </div>
                <PostPhoto src={p.imageUrl(post.image_path)} className="h-[90px] rounded-md" />
                <b className="text-[15px]">{displayTitle(post)}</b>
                <span className="flex items-center gap-1 text-[13px] text-ink-soft">
                  {post.author_name} ·
                  <LikeButton post={post} liked={p.myLikes.has(post.id)} onLike={() => p.onLike(post)} small />· 💬{" "}
                  {post.comment_count}
                </span>
              </article>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

// 대화: 카카오톡처럼 글이 쌓이고 선생님 공지가 위에 고정
export function ChatView(p: ViewProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const ordered = [...p.posts].reverse(); // 오래된 글이 위
  const lastId = ordered.at(-1)?.id;

  useEffect(() => {
    // 새 글이 오면 대화창 안에서만 맨 아래로 (페이지 전체는 움직이지 않게)
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId]);

  const canWrite = !p.locked || p.isTeacher;
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    if (await p.onQuickPost(text.trim())) setText("");
    setSending(false);
  };

  return (
    <div className="mx-auto max-w-[760px] overflow-hidden rounded-2xl bg-sage">
      {p.board.notice && (
        <div className="bg-cream px-4 py-3 text-sm text-cream-ink">
          <b>선생님 공지</b> {p.board.notice}
        </div>
      )}
      <div ref={listRef} className="flex max-h-[62vh] min-h-[240px] flex-col gap-3.5 overflow-y-auto p-4">
        {ordered.length === 0 && <p className="py-10 text-center text-muted">첫 메시지를 보내 보세요.</p>}
        {ordered.map((post) => {
          const mine = post.author_id === p.userId;
          return (
            <div key={post.id} className={`flex max-w-[520px] items-end gap-2.5 ${mine ? "flex-row-reverse self-end" : ""}`}>
              {!mine && <Avatar name={post.author_name} url={post.author_avatar} />}
              <div className={`flex min-w-0 flex-col gap-1 ${mine ? "items-end" : ""}`}>
                <span className="flex items-center gap-1 text-[13px] text-ink-soft">
                  {!mine && post.author_name} <KindBadge post={post} />
                </span>
                {post.is_hidden && <HiddenBadge />}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => p.onOpen(post.id)}
                  onKeyDown={(e) => e.key === "Enter" && p.onOpen(post.id)}
                  className={`max-w-full cursor-pointer px-3.5 py-2.5 text-left text-[15px] leading-normal ${
                    mine ? "rounded-[16px_4px_16px_16px] bg-school text-white" : "rounded-[4px_16px_16px_16px] bg-white"
                  } ${post.is_hidden ? "opacity-60" : ""}`}
                >
                  {post.title && <b className="block">{post.title}</b>}
                  <RichText text={post.content} dark={mine} foldLines={10} compact />
                </div>
                {post.image_path && (
                  <button type="button" onClick={() => p.onOpen(post.id)} className="w-[220px] overflow-hidden rounded-xl">
                    <PostPhoto src={p.imageUrl(post.image_path)} className="h-[130px]" />
                  </button>
                )}
                <span className="flex items-center gap-1 text-xs text-ink-soft">
                  {clockTime(post.created_at)} ·
                  <LikeButton post={post} liked={p.myLikes.has(post.id)} onLike={() => p.onLike(post)} small />
                  {post.comment_count > 0 && (
                    <button type="button" onClick={() => p.onOpen(post.id)} className="hover:underline">
                      · 답글 {post.comment_count}
                    </button>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={send} className="flex gap-2 bg-white px-4 py-3">
        <input
          type="text"
          aria-label="글 입력"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={5000}
          disabled={!canWrite}
          placeholder={canWrite ? "글을 입력하세요" : "게시판이 잠겨 있어요"}
          className="h-11 min-w-0 flex-1 rounded-full border border-line px-4 disabled:bg-paper"
        />
        <button
          disabled={!canWrite || sending || !text.trim()}
          className="h-11 rounded-full bg-school px-[18px] text-white disabled:opacity-50"
        >
          보내기
        </button>
      </form>
    </div>
  );
}
