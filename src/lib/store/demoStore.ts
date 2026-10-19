import { compressImage } from "@/lib/image";
import { createSeed, DEMO_DB_VERSION, type DemoDb } from "@/lib/demo/seed";
import { DEMO_STUDENTS, DEMO_USERS, getDemoUser } from "@/lib/demo/users";
import type { Board, Comment, ExportRow, Post } from "@/lib/types";
import type { BoardStore } from "./types";

// 체험 모드: Supabase 키 없이 브라우저 localStorage 에 저장합니다.
// 같은 브라우저의 다른 탭과는 공유되지만, 다른 컴퓨터와는 공유되지 않습니다.
const KEY = "class-board-demo-db";

function load(): DemoDb {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const db = JSON.parse(raw) as DemoDb;
      if (db.version === DEMO_DB_VERSION) return db;
    }
  } catch {
    // 깨진 데이터면 새로 채움
  }
  const db = createSeed();
  save(db);
  return db;
}

function save(db: DemoDb) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    throw new Error("브라우저 저장 공간이 가득 찼어요. 아래 '체험 데이터 초기화'를 눌러 주세요.");
  }
}

export function resetDemoData() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 무시
  }
}

const now = () => new Date().toISOString();
const userName = (id: string) => DEMO_USERS.find((u) => u.id === id)?.name ?? "알 수 없음";
const userEmail = (id: string) => DEMO_USERS.find((u) => u.id === id)?.email ?? "";

function withCount(db: DemoDb, b: DemoDb["boards"][number]): Board {
  const post_count = db.posts.filter((p) => p.board_id === b.id && !p.deleted_at && !p.is_hidden).length;
  return { ...b, post_count };
}

type Me = ReturnType<typeof getDemoUser>;

// 이 글을 지금 사용자가 볼 수 있는지 (DB 의 get_board_posts 와 같은 규칙)
function canSee(db: DemoDb, me: Me, p: DemoDb["posts"][number]) {
  if (p.deleted_at) return false;
  if (me.isTeacher || p.author_id === me.id) return true;
  if (p.is_hidden) return false;
  const b = db.boards.find((b) => b.id === p.board_id);
  if (!b || b.reveal_mode === "open") return true;
  if (b.reveal_mode === "teacher") return b.revealed;
  // after_submit: 내가 이 게시판에 글을 올렸으면 공개
  return db.posts.some((x) => x.board_id === b.id && x.author_id === me.id && !x.deleted_at);
}

function requireBoard(db: DemoDb, id: string) {
  const b = db.boards.find((b) => b.id === id);
  if (!b) throw new Error("게시판을 찾을 수 없습니다");
  return b;
}

function recountComments(db: DemoDb, postId: string) {
  const p = db.posts.find((p) => p.id === postId);
  if (!p) return;
  p.comment_count = db.comments.filter((c) => c.post_id === postId && !c.deleted_at && !c.is_hidden).length;
  p.updated_at = now();
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("사진을 읽지 못했어요"));
    r.readAsDataURL(blob);
  });
}

// 실제 서버처럼 아주 잠깐 기다렸다가 응답 (화면의 '불러오는 중' 처리 확인용)
const tick = () => new Promise((r) => setTimeout(r, 60));

export const demoStore: BoardStore = {
  mode: "demo",
  rosterSize: DEMO_STUDENTS.length,

  async listBoards() {
    await tick();
    const db = load();
    return db.boards.map((b) => withCount(db, b));
  },

  async getBoard(id) {
    const db = load();
    const b = db.boards.find((b) => b.id === id);
    return b ? withCount(db, b) : null;
  },

  async createBoard(input, userId) {
    const db = load();
    const t = now();
    db.boards.push({
      ...input,
      id: crypto.randomUUID(),
      allow_photos: true,
      revealed: false,
      owner_id: userId,
      is_locked: false,
      created_at: t,
      updated_at: t,
    });
    save(db);
  },

  async updateBoard(id, changes) {
    if (!getDemoUser().isTeacher) throw new Error("교사만 바꿀 수 있습니다");
    const db = load();
    const b = requireBoard(db, id);
    Object.assign(b, changes, { updated_at: now() });
    save(db);
    return withCount(db, b);
  },

  async getPosts(boardId, since) {
    await tick();
    const db = load();
    const me = getDemoUser();
    return db.posts
      .filter((p) => p.board_id === boardId)
      .filter((p) => (since ? p.updated_at > since : !p.deleted_at))
      .map((p): Post => {
        const visible = canSee(db, me, p);
        return {
          id: p.id,
          board_id: p.board_id,
          author_id: p.author_id,
          author_name: userName(p.author_id),
          author_avatar: null,
          kind: p.kind,
          title: visible ? p.title : "",
          content: visible ? p.content : "",
          section: p.section,
          image_path: visible ? p.image_path : null,
          solved_comment_id: p.solved_comment_id,
          is_hidden: p.is_hidden,
          removed: !visible,
          like_count: p.like_count,
          comment_count: p.comment_count,
          created_at: p.created_at,
          updated_at: p.updated_at,
        };
      })
      .sort((a, b) => a.updated_at.localeCompare(b.updated_at));
  },

  async createPost(input, userId) {
    const db = load();
    const me = getDemoUser();
    const b = requireBoard(db, input.board_id);
    if (b.is_locked && !me.isTeacher) throw new Error("잠긴 게시판입니다");
    let image_path: string | null = null;
    if (input.image) {
      if (!b.allow_photos && !me.isTeacher) throw new Error("이 게시판은 사진을 올릴 수 없어요");
      // 브라우저 저장 공간이 작아서 실제 운영(1280px)보다 더 작게 줄입니다.
      image_path = await blobToDataUrl(await compressImage(input.image, 900, 0.72));
    }
    const t = now();
    db.posts.push({
      id: crypto.randomUUID(),
      board_id: input.board_id,
      author_id: userId,
      kind: input.kind,
      title: input.title,
      content: input.content,
      section: input.section,
      image_path,
      solved_comment_id: null,
      is_hidden: false,
      deleted_at: null,
      like_count: 0,
      comment_count: 0,
      created_at: t,
      updated_at: t,
    });
    save(db);
  },

  async updatePost(post, changes) {
    const db = load();
    const me = getDemoUser();
    const p = db.posts.find((p) => p.id === post.id);
    if (!p) throw new Error("글을 찾을 수 없습니다");
    if (!me.isTeacher) {
      if (p.author_id !== me.id) throw new Error("내 글만 바꿀 수 있습니다");
      if (changes.is_hidden !== undefined) throw new Error("교사만 글을 숨길 수 있습니다");
      if (requireBoard(db, p.board_id).is_locked) throw new Error("잠긴 게시판입니다");
    }
    if (changes.solved_comment_id && !db.comments.some((c) => c.id === changes.solved_comment_id && c.post_id === p.id)) {
      throw new Error("이 글의 댓글만 채택할 수 있습니다");
    }
    Object.assign(p, changes, { updated_at: now() });
    save(db);
  },

  async myLikes(userId) {
    const db = load();
    const mine = db.likes.filter((k) => k.endsWith(`|${userId}`)).map((k) => k.split("|")[0]);
    return new Set(mine);
  },

  async setLike(postId, userId, like) {
    const db = load();
    const key = `${postId}|${userId}`;
    const has = db.likes.includes(key);
    const p = db.posts.find((p) => p.id === postId);
    if (!p || has === like) return;
    db.likes = like ? [...db.likes, key] : db.likes.filter((k) => k !== key);
    p.like_count = Math.max(0, p.like_count + (like ? 1 : -1));
    p.updated_at = now();
    save(db);
  },

  async getComments(postId, since) {
    const db = load();
    const me = getDemoUser();
    const post = db.posts.find((p) => p.id === postId);
    if (!post || !canSee(db, me, post)) return [];
    return db.comments
      .filter((c) => c.post_id === postId)
      .filter((c) => (since ? c.updated_at > since : !c.deleted_at))
      .map((c): Comment => {
        const visible = !c.deleted_at && (!c.is_hidden || me.isTeacher || c.author_id === me.id);
        return {
          id: c.id,
          post_id: c.post_id,
          author_id: c.author_id,
          author_name: userName(c.author_id),
          author_avatar: null,
          content: visible ? c.content : "",
          is_hidden: c.is_hidden,
          removed: !visible,
          created_at: c.created_at,
          updated_at: c.updated_at,
        };
      });
  },

  async addComment(postId, userId, content) {
    const db = load();
    const me = getDemoUser();
    const p = db.posts.find((p) => p.id === postId);
    if (!p || !canSee(db, me, p)) throw new Error("글을 찾을 수 없습니다");
    if (requireBoard(db, p.board_id).is_locked && !me.isTeacher) throw new Error("잠긴 게시판입니다");
    const t = now();
    db.comments.push({
      id: crypto.randomUUID(),
      post_id: postId,
      author_id: userId,
      content,
      is_hidden: false,
      deleted_at: null,
      created_at: t,
      updated_at: t,
    });
    recountComments(db, postId);
    save(db);
  },

  async updateComment(id, changes) {
    const db = load();
    const me = getDemoUser();
    const c = db.comments.find((c) => c.id === id);
    if (!c) throw new Error("댓글을 찾을 수 없습니다");
    if (!me.isTeacher) {
      if (c.author_id !== me.id) throw new Error("내 댓글만 바꿀 수 있습니다");
      if (changes.is_hidden !== undefined) throw new Error("교사만 댓글을 숨길 수 있습니다");
    }
    Object.assign(c, changes, { updated_at: now() });
    recountComments(db, c.post_id);
    save(db);
  },

  async exportBoard(boardId) {
    if (!getDemoUser().isTeacher) throw new Error("교사만 내보낼 수 있습니다");
    const db = load();
    const posts = db.posts.filter((p) => p.board_id === boardId && !p.deleted_at);
    const rows: ExportRow[] = [];
    for (const p of [...posts].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      rows.push({
        kind: "글",
        post_kind: p.kind,
        solved: p.kind === "question" ? Boolean(p.solved_comment_id) : null,
        post_id: p.id,
        author_name: userName(p.author_id),
        author_email: userEmail(p.author_id),
        title: p.title,
        section: p.section,
        content: p.content,
        like_count: p.like_count,
        is_hidden: p.is_hidden,
        created_at: p.created_at,
      });
      for (const c of db.comments.filter((c) => c.post_id === p.id && !c.deleted_at)) {
        rows.push({
          kind: "댓글",
          post_kind: null,
          solved: null,
          post_id: p.id,
          author_name: userName(c.author_id),
          author_email: userEmail(c.author_id),
          title: "",
          section: p.section,
          content: c.content,
          like_count: null,
          is_hidden: c.is_hidden,
          created_at: c.created_at,
        });
      }
    }
    return rows;
  },

  imageUrl(path) {
    return path;
  },
};
