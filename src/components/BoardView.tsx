"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { AppHeader, SITE_NAME } from "./AppHeader";
import { ChatView, FeedView, GroupView, ListView, WallView } from "./BoardViews";
import { PostComposer } from "./PostComposer";
import { PostModal } from "./PostModal";
import type { ViewProps } from "./postBits";
import { getStore } from "@/lib/store";
import { usePolling } from "@/lib/usePolling";
import { takeDraft, type PostDraft } from "@/lib/drawflow";
import { kindLabel, VIEWS, type RevealMode, type Board, type ExportRow, type Post, type PostChanges, type PostInput, type ViewKey } from "@/lib/types";

// 새 글 확인 간격. 무료 요금제에 맞춰 실시간 연결 대신 짧은 간격으로 확인합니다.
const POLL_MS = 5000;
// 잠금·기본 보기 같은 게시판 설정 확인 간격
const BOARD_POLL_MS = 15000;
// 저장 순서와 시간 차이로 글을 놓치지 않도록 조금 겹쳐서 가져옵니다.
const OVERLAP_MS = 10000;

// 글 종류 거르기 (계획서 2-2: 종류별 필터, 미해결 질문만 모아보기)
type PostFilter = "all" | "question" | "unsolved" | "code" | "assignment";
const FILTERS: Record<PostFilter, { label: string; test: (p: Post) => boolean }> = {
  all: { label: "전체", test: () => true },
  question: { label: "질문", test: (p) => p.kind === "question" },
  unsolved: { label: "미해결 질문", test: (p) => p.kind === "question" && !p.solved_comment_id },
  code: { label: "코드 공유", test: (p) => p.kind === "code" },
  assignment: { label: "과제 제출", test: (p) => p.kind === "assignment" },
};

const VIEW_COMPONENTS: Record<ViewKey, (p: ViewProps) => React.ReactNode> = {
  wall: WallView,
  list: ListView,
  feed: FeedView,
  group: GroupView,
  chat: ChatView,
};

export function BoardView() {
  const { id } = useParams<{ id: string }>();
  const { userId } = useAuth();
  // 사용자가 바뀌면(체험 모드에서 교사↔학생) 숨긴 글 보이는 범위가 달라서 처음부터 다시 불러옵니다.
  return <BoardScreen key={`${id}:${userId}`} boardId={id} />;
}

function BoardScreen({ boardId }: { boardId: string }) {
  const { userId, isTeacher } = useAuth();
  const store = getStore();
  const [board, setBoard] = useState<Board | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [posts, setPosts] = useState<Map<string, Post>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  // draw_flow 에서 보낸 내용 (/share 에서 이 게시판을 골랐을 때)
  const [draft, setDraft] = useState<PostDraft | null>(null);
  const [pickedView, setPickedView] = useState<ViewKey | null>(null);
  const [error, setError] = useState("");
  const sinceRef = useRef<string | null>(null);

  const showError = useCallback((e: unknown) => setError(e instanceof Error ? e.message : String(e)), []);

  // 학생이 고른 보기는 이 브라우저에만 기억합니다. 안 골랐으면 선생님이 정한 기본 보기.
  const viewKey = `class-board-view:${boardId}`;
  useEffect(() => {
    try {
      const v = localStorage.getItem(viewKey) as ViewKey | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저에 저장된 값은 화면이 뜬 뒤에 읽습니다
      if (v && VIEWS.some((x) => x.key === v)) setPickedView(v);
    } catch {
      // 저장소를 못 쓰면 기본 보기
    }
  }, [viewKey]);

  const pickView = (v: ViewKey) => {
    setPickedView(v);
    try {
      localStorage.setItem(viewKey, v);
    } catch {
      // 무시
    }
  };

  const loadBoard = useCallback(async () => {
    try {
      const b = await getStore().getBoard(boardId);
      if (!b) setNotFound(true);
      else setBoard(b);
    } catch (e) {
      showError(e);
    }
  }, [boardId, showError]);

  const loadPosts = useCallback(async () => {
    const since = sinceRef.current
      ? new Date(new Date(sinceRef.current).getTime() - OVERLAP_MS).toISOString()
      : null;
    try {
      const rows = await getStore().getPosts(boardId, since);
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
    } catch (e) {
      showError(e);
    }
  }, [boardId, showError]);

  useEffect(() => {
    if (!userId) return;
    getStore().myLikes(userId).then(setMyLikes, showError);
  }, [userId, showError]);

  // /share 에서 맡겨 둔 글이 있으면 게시판을 불러온 뒤 글쓰기 창을 채워서 엽니다.
  const boardLoaded = board !== null;
  const lockedForMe = Boolean(board?.is_locked && !isTeacher);
  useEffect(() => {
    if (!boardLoaded) return;
    const d = takeDraft(boardId);
    if (!d) return;
    /* eslint-disable react-hooks/set-state-in-effect -- 탭에 맡겨 둔 값은 화면이 뜬 뒤에 읽습니다 */
    if (lockedForMe) {
      setError("게시판이 잠겨 있어 draw_flow에서 보낸 글을 올릴 수 없어요.");
      return;
    }
    setDraft(d);
    setComposing(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [boardLoaded, boardId, lockedForMe]);

  usePolling(loadPosts, POLL_MS);
  usePolling(loadBoard, BOARD_POLL_MS);

  // 처음부터 다시 불러오기: 보이는 범위가 바뀌었을 때 (제출 후 공개, 교사 공개 버튼)
  // 바뀐 글만 가져오는 방식으로는 원래 있던 다른 학생 글이 오지 않기 때문입니다.
  const reloadAll = useCallback(() => {
    sinceRef.current = null;
    setPosts(new Map());
    loadPosts();
  }, [loadPosts]);

  const visKey = board ? `${board.reveal_mode}:${board.revealed}` : "";
  const prevVisKey = useRef(visKey);
  useEffect(() => {
    if (prevVisKey.current && prevVisKey.current !== visKey) reloadAll();
    prevVisKey.current = visKey;
  }, [visKey, reloadAll]);

  const [filter, setFilter] = useState<PostFilter>("all");
  const allPosts = useMemo(
    () => [...posts.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [posts],
  );
  const sorted = useMemo(() => allPosts.filter(FILTERS[filter].test), [allPosts, filter]);

  // 과제 게시판은 '과제 제출' 글만 제출로 셉니다 (대화 보기 한 줄 글 등은 제외).
  const countsAsSubmit = useCallback(
    (p: Post) => board?.default_kind !== "assignment" || p.kind === "assignment",
    [board?.default_kind],
  );

  // 참여 현황: 글을 쓴 학생 수 (교사 본인 제외)
  const participants = useMemo(() => {
    const ids = new Set(allPosts.filter(countsAsSubmit).map((p) => p.author_id));
    if (board) ids.delete(board.owner_id);
    if (isTeacher && userId) ids.delete(userId);
    return ids.size;
  }, [allPosts, countsAsSubmit, board, isTeacher, userId]);

  // 제출 후 공개 게시판에서 학생에게 다른 친구 글이 가려져 있는지 (DB 의 board_revealed_for_me 와 같은 규칙)
  const iPosted = allPosts.some((p) => p.author_id === userId && countsAsSubmit(p));
  const othersHidden =
    !!board &&
    !isTeacher &&
    ((board.reveal_mode === "after_submit" && !iPosted) || (board.reveal_mode === "teacher" && !board.revealed));

  const toggleLike = async (post: Post) => {
    if (!userId) return;
    const liked = myLikes.has(post.id);
    // 누르자마자 화면에 반영하고, 저장은 뒤에서
    setMyLikes((s) => {
      const n = new Set(s);
      if (liked) n.delete(post.id);
      else n.add(post.id);
      return n;
    });
    setPosts((m) => new Map(m).set(post.id, { ...post, like_count: Math.max(0, post.like_count + (liked ? -1 : 1)) }));
    try {
      await store.setLike(post.id, userId, !liked);
    } catch (e) {
      showError(e);
    }
    loadPosts();
  };

  // 성공하면 true (실패하면 오류를 띄우고 false — 수정 창은 열어 둡니다)
  const updatePost = async (post: Post, changes: PostChanges) => {
    let ok = true;
    try {
      await store.updatePost(post, changes);
    } catch (e) {
      showError(e);
      ok = false;
    }
    loadPosts();
    return ok;
  };

  const createPost = async (input: PostInput) => {
    if (!userId) return false;
    try {
      await store.createPost(input, userId);
      if (board && board.reveal_mode !== "open") reloadAll();
      else loadPosts();
      return true;
    } catch (e) {
      showError(e);
      return false;
    }
  };

  const changeBoard = async (changes: Parameters<typeof store.updateBoard>[1]) => {
    if (!board) return;
    setBoard({ ...board, ...changes });
    try {
      setBoard(await store.updateBoard(board.id, changes));
    } catch (e) {
      showError(e);
      loadBoard();
    }
  };

  const exportCsv = async () => {
    try {
      downloadCsv(await store.exportBoard(boardId), board?.title ?? "게시판");
    } catch (e) {
      showError(e);
    }
  };

  if (notFound) {
    return (
      <>
        <AppHeader subTitle={SITE_NAME} title="게시판을 찾을 수 없어요" back />
        <p className="px-4 py-24 text-center text-muted">주소가 바뀌었거나 삭제된 게시판이에요.</p>
      </>
    );
  }

  const locked = board?.is_locked ?? false;
  const view: ViewKey = pickedView ?? board?.default_view ?? "wall";
  const openPost = openPostId ? posts.get(openPostId) : undefined;
  const canWrite = !locked || isTeacher;
  const canAttach = isTeacher || (board?.allow_photos ?? true);
  const ViewComponent = VIEW_COMPONENTS[view];

  return (
    <>
      <AppHeader
        subTitle={board ? `${SITE_NAME} · ${board.subject}` : SITE_NAME}
        title={board?.title ?? "불러오는 중…"}
        back
      />

      {/* 보기 탭 + 노란 글쓰기 버튼 */}
      <div className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <nav aria-label="보기 방식" className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-tab p-1">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => pickView(v.key)}
                aria-current={view === v.key ? "page" : undefined}
                className={`min-h-10 shrink-0 rounded-[9px] px-3 text-[15px] sm:px-4 ${view === v.key ? "bg-school text-white" : "text-ink hover:bg-white/70"}`}
              >
                {v.label}
                {board?.default_view === v.key && " (기본)"}
              </button>
            ))}
          </nav>
          {/* 휴대폰에서는 오른쪽 아래에 떠 있는 버튼 */}
          <button
            type="button"
            className="write-btn fixed bottom-4 right-4 z-20 shadow-lg sm:static sm:shadow-none"
            disabled={!board || !canWrite}
            onClick={() => setComposing(true)}
          >
            {canWrite ? "+ 글쓰기" : "잠김"}
          </button>
        </div>
      </div>

      {/* 교사 도구 띠 */}
      {isTeacher && board && (
        <div className="border-b border-cream-line bg-cream">
          <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 text-sm text-cream-ink sm:px-6">
            <b className="font-display text-lg font-normal">이 게시판 관리</b>
            <span>
              {board.default_kind === "assignment" ? "제출" : "참여"} {participants}
              {store.rosterSize ? ` / ${store.rosterSize}` : ""}명
            </span>
            <label className="flex items-center gap-1.5">
              친구 글 공개:
              <select
                value={board.reveal_mode}
                onChange={(e) => changeBoard({ reveal_mode: e.target.value as RevealMode })}
                className="h-9 rounded-lg border border-cream-line bg-white px-2"
              >
                <option value="open">항상</option>
                <option value="after_submit">제출하면</option>
                <option value="teacher">교사가 공개할 때</option>
              </select>
            </label>
            {board.reveal_mode === "teacher" && (
              <button
                type="button"
                onClick={() => changeBoard({ revealed: !board.revealed })}
                className="h-10 rounded-[10px] bg-school px-3.5 text-white hover:bg-school-dark"
              >
                {board.revealed ? "다시 비공개" : "지금 공개하기"}
              </button>
            )}
            <label className="flex min-h-10 cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={board.is_locked}
                onChange={() => changeBoard({ is_locked: !board.is_locked })}
                className="h-5 w-5 accent-school"
              />
              게시판 잠그기
            </label>
            <label className="flex min-h-10 cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={board.allow_photos}
                onChange={() => changeBoard({ allow_photos: !board.allow_photos })}
                className="h-5 w-5 accent-school"
              />
              사진 올리기 허용
            </label>
            <label className="flex items-center gap-1.5">
              기본 보기:
              <select
                value={board.default_view}
                onChange={(e) => changeBoard({ default_view: e.target.value as ViewKey })}
                className="h-9 rounded-lg border border-cream-line bg-white px-2"
              >
                {VIEWS.map((v) => (
                  <option key={v.key} value={v.key}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={exportCsv}
              className="flex h-10 items-center gap-1.5 rounded-[10px] border border-school bg-white px-3.5 text-school hover:bg-leaf"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="M7 10l5 5 5-5" />
                <path d="M12 15V3" />
              </svg>
              엑셀(CSV) 내보내기
            </button>
          </div>
        </div>
      )}

      {locked && (
        <div className="mx-auto mt-4 box-border w-full max-w-[1240px] px-4 sm:px-6">
          <div className="flex items-center gap-2 rounded-[10px] bg-ink px-4 py-3 text-sm text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            {isTeacher
              ? "게시판이 잠겨 있어요. 학생은 읽기만 할 수 있고, 선생님은 계속 쓸 수 있어요."
              : "선생님이 이 게시판을 잠갔어요. 지금은 읽기만 할 수 있어요."}
          </div>
        </div>
      )}

      {error && (
        <div className="mx-auto mt-4 box-border w-full max-w-[1240px] px-4 sm:px-6">
          <p className="flex justify-between gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
            <button onClick={() => setError("")} aria-label="닫기">
              ✕
            </button>
          </p>
        </div>
      )}

      <main className="mx-auto box-border w-full max-w-[1240px] px-4 pb-24 pt-5 sm:px-6 sm:pb-8">
        {othersHidden && board && (
          <div className="mb-4 rounded-[10px] border border-cream-line bg-cream px-4 py-3 text-sm text-cream-ink">
            {board.reveal_mode === "after_submit"
              ? board.default_kind === "assignment"
                ? "🔒 '+ 글쓰기'로 과제 제출 글을 올리면 친구들 글을 볼 수 있어요. 대화 글은 제출로 세지 않아요. (베끼기 방지)"
                : "🔒 내 글을 먼저 올리면 친구들 글을 볼 수 있어요. (베끼기 방지)"
              : "🔒 선생님이 공개하면 친구들 글을 볼 수 있어요. 지금은 내 글만 보여요."}
          </div>
        )}
        {loaded && board && allPosts.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5" role="radiogroup" aria-label="글 종류로 거르기">
            {(Object.keys(FILTERS) as PostFilter[]).map((key) => {
              const n = allPosts.filter(FILTERS[key].test).length;
              if (key !== "all" && n === 0 && filter !== key) return null;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={filter === key}
                  onClick={() => setFilter(key)}
                  className={`min-h-8 rounded-full border px-3 text-[13px] ${
                    filter === key ? "border-school bg-school text-white" : "border-line bg-white text-ink-soft"
                  }`}
                >
                  {FILTERS[key].label} {n}
                </button>
              );
            })}
          </div>
        )}
        {!loaded || !board ? (
          <p className="py-16 text-center text-muted">불러오는 중…</p>
        ) : (
          <ViewComponent
            board={board}
            posts={sorted}
            myLikes={myLikes}
            userId={userId}
            isTeacher={isTeacher}
            locked={locked}
            imageUrl={(p) => store.imageUrl(p)}
            onOpen={setOpenPostId}
            onLike={toggleLike}
            onUpdate={updatePost}
            onQuickPost={(content) =>
              createPost({
                board_id: board.id,
                // 한 줄 대화는 과제 제출로 세지 않도록 항상 일반 글
                kind: "general",
                title: "",
                content,
                section: board.sections[0] ?? "",
                image: null,
              })
            }
          />
        )}
      </main>

      {composing && board && canWrite && (
        <PostComposer
          board={board}
          canAttach={canAttach}
          initial={draft ?? undefined}
          onClose={() => {
            setComposing(false);
            setDraft(null);
          }}
          onSubmit={createPost}
        />
      )}

      {openPost && (
        <PostModal
          post={openPost}
          liked={myLikes.has(openPost.id)}
          locked={locked}
          onClose={() => setOpenPostId(null)}
          onLike={() => toggleLike(openPost)}
          onUpdate={(changes) => updatePost(openPost, changes)}
          onChanged={loadPosts}
          onError={setError}
        />
      )}
    </>
  );
}

function downloadCsv(rows: ExportRow[], title: string) {
  const header = ["구분", "글번호", "글 종류", "해결", "칸", "이름", "이메일", "제목", "내용", "좋아요", "숨김", "작성시각", "수정시각"];
  const ids = new Map<string, number>();
  const lines = rows.map((r) => {
    if (!ids.has(r.post_id)) ids.set(r.post_id, ids.size + 1);
    return [
      r.kind,
      ids.get(r.post_id),
      r.post_kind ? kindLabel(r.post_kind) : "",
      r.post_kind === "question" ? (r.solved ? "해결됨" : "미해결") : "",
      r.section,
      r.author_name,
      r.author_email,
      r.title,
      r.content,
      r.like_count ?? "",
      r.is_hidden ? "숨김" : "",
      new Date(r.created_at).toLocaleString("ko-KR"),
      r.edited_at ? new Date(r.edited_at).toLocaleString("ko-KR") : "",
    ];
  });
  const csv = [header, ...lines]
    .map((row) => row.map((v) => `"${csvSafe(String(v ?? "")).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  // 엑셀에서 한글이 깨지지 않도록 BOM 을 붙입니다.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${title}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// 학생 글이 =, +, -, @ 등으로 시작하면 엑셀이 수식으로 실행하므로 앞에 ' 를 붙여 글자로 둡니다.
function csvSafe(v: string) {
  return /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
}

