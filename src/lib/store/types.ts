import type {
  Board,
  BoardChanges,
  BoardInput,
  Comment,
  CommentChanges,
  ExportRow,
  Post,
  PostChanges,
  PostInput,
} from "@/lib/types";

// 화면은 이 인터페이스만 사용합니다.
// 체험 모드(demoStore)와 Supabase(supabaseStore)가 같은 모양으로 구현해서 서로 바꿔 끼울 수 있습니다.
// 실패하면 사용자에게 보여줄 한국어 메시지를 담은 Error 를 던집니다.
export interface BoardStore {
  mode: "demo" | "supabase";
  // 반 학생 수 (참여 현황 "24 / 28명" 의 분모). 모르면 null.
  rosterSize: number | null;

  listBoards(): Promise<Board[]>;
  getBoard(id: string): Promise<Board | null>;
  createBoard(input: BoardInput, userId: string): Promise<void>;
  updateBoard(id: string, changes: BoardChanges): Promise<Board>;

  // since 이후에 바뀐 글만 돌려줍니다 (since=null 이면 전체). 숨김·삭제된 글은 removed=true.
  getPosts(boardId: string, since: string | null): Promise<Post[]>;
  createPost(input: PostInput, userId: string): Promise<void>;
  updatePost(post: Post, changes: PostChanges): Promise<void>;

  myLikes(userId: string): Promise<Set<string>>;
  setLike(postId: string, userId: string, like: boolean): Promise<void>;

  getComments(postId: string, since: string | null): Promise<Comment[]>;
  addComment(postId: string, userId: string, content: string): Promise<void>;
  updateComment(id: string, changes: CommentChanges): Promise<void>;

  exportBoard(boardId: string): Promise<ExportRow[]>;
  imageUrl(path: string | null): string | null;
}
