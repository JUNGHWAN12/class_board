// 게시판 보기 방식 (게시판마다 기본 보기를 정하고, 학생은 탭으로 바꿔 볼 수 있음)
export type ViewKey = "wall" | "list" | "feed" | "group" | "chat";

export const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "wall", label: "담벼락" },
  { key: "list", label: "목록" },
  { key: "feed", label: "피드" },
  { key: "group", label: "칸별" },
  { key: "chat", label: "대화" },
];

export function viewLabel(key: ViewKey) {
  return VIEWS.find((v) => v.key === key)?.label ?? "";
}

export type Board = {
  id: string;
  title: string;
  description: string;
  subject: string; // 예: "과학 · 관찰"
  notice: string; // 대화 보기 위에 고정되는 선생님 공지
  sections: string[]; // 칸별 보기의 칸 이름 (예: 1모둠, 2모둠)
  default_view: ViewKey;
  allow_photos: boolean;
  owner_id: string;
  is_locked: boolean;
  post_count: number; // 학생에게 보이는 글 수
  created_at: string;
  updated_at: string;
};

export type BoardInput = Pick<Board, "title" | "description" | "subject" | "notice" | "sections" | "default_view">;
export type BoardChanges = Partial<Pick<Board, "is_locked" | "allow_photos" | "default_view" | "notice">>;

export type Post = {
  id: string;
  board_id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  title: string;
  content: string;
  section: string;
  image_path: string | null;
  is_hidden: boolean;
  removed: boolean;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
};

export type PostInput = { board_id: string; title: string; content: string; section: string; image: File | null };
export type PostChanges = Partial<{ content: string; is_hidden: boolean; deleted_at: string }>;

export type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  content: string;
  is_hidden: boolean;
  removed: boolean;
  created_at: string;
  updated_at: string;
};

export type CommentChanges = Partial<{ is_hidden: boolean; deleted_at: string }>;

export type ExportRow = {
  kind: string;
  post_id: string;
  author_name: string;
  author_email: string;
  title: string;
  section: string;
  content: string;
  like_count: number | null;
  is_hidden: boolean;
  created_at: string;
};
