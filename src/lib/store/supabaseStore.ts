import { compressImage } from "@/lib/image";
import type { Board, Comment, ExportRow, Post } from "@/lib/types";
import { getSupabase, IMAGE_BUCKET } from "./supabaseClient";
import type { BoardStore } from "./types";

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export const supabaseStore: BoardStore = {
  mode: "supabase",
  rosterSize: null,

  async listBoards() {
    const { data, error } = await getSupabase().rpc("get_boards");
    fail(error);
    return (data ?? []) as Board[];
  },

  async getBoard(id) {
    const { data, error } = await getSupabase().rpc("get_boards", { p_board: id });
    fail(error);
    return ((data ?? []) as Board[])[0] ?? null;
  },

  async createBoard(input, userId) {
    const { error } = await getSupabase().from("boards").insert({ ...input, owner_id: userId });
    fail(error);
  },

  async updateBoard(id, changes) {
    const { error } = await getSupabase().from("boards").update(changes).eq("id", id);
    fail(error);
    const board = await this.getBoard(id);
    if (!board) throw new Error("게시판을 찾을 수 없습니다");
    return board;
  },

  async getPosts(boardId, since) {
    const { data, error } = await getSupabase().rpc("get_board_posts", { p_board: boardId, p_since: since });
    fail(error);
    return (data ?? []) as Post[];
  },

  async createPost(input, userId) {
    const supabase = getSupabase();
    let image_path: string | null = null;
    if (input.image) {
      const blob = await compressImage(input.image);
      image_path = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(image_path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
      if (error) throw new Error(`사진 올리기 실패: ${error.message}`);
    }
    const { error } = await supabase.from("posts").insert({
      board_id: input.board_id,
      author_id: userId,
      kind: input.kind,
      title: input.title,
      content: input.content,
      section: input.section,
      image_path,
    });
    if (error) {
      if (image_path) await supabase.storage.from(IMAGE_BUCKET).remove([image_path]);
      throw new Error(error.message);
    }
  },

  async updatePost(post, changes) {
    const supabase = getSupabase();
    const { error } = await supabase.from("posts").update(changes).eq("id", post.id);
    fail(error);
    if (changes.deleted_at && post.image_path) {
      await supabase.storage.from(IMAGE_BUCKET).remove([post.image_path]);
    }
  },

  async myLikes(userId) {
    const { data, error } = await getSupabase().from("likes").select("post_id").eq("user_id", userId);
    fail(error);
    return new Set((data ?? []).map((r) => r.post_id as string));
  },

  async setLike(postId, userId, like) {
    const supabase = getSupabase();
    const { error } = like
      ? await supabase.from("likes").insert({ post_id: postId, user_id: userId })
      : await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", userId);
    // 23505: 이미 좋아요한 글 (두 번 눌림)
    if (error && error.code !== "23505") throw new Error(error.message);
  },

  async getComments(postId, since) {
    const { data, error } = await getSupabase().rpc("get_post_comments", { p_post: postId, p_since: since });
    fail(error);
    return (data ?? []) as Comment[];
  },

  async addComment(postId, userId, content) {
    const { error } = await getSupabase().from("comments").insert({ post_id: postId, author_id: userId, content });
    fail(error);
  },

  async updateComment(id, changes) {
    const { error } = await getSupabase().from("comments").update(changes).eq("id", id);
    fail(error);
  },

  async exportBoard(boardId) {
    const { data, error } = await getSupabase().rpc("export_board", { p_board: boardId });
    fail(error);
    return (data ?? []) as ExportRow[];
  },

  imageUrl(path) {
    if (!path) return null;
    return getSupabase().storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  },
};
