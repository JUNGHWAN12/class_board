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

// 글 종류 (계획서 2-2)
export type PostKind = "general" | "question" | "code" | "assignment";

export const KINDS: { key: PostKind; label: string }[] = [
  { key: "general", label: "일반" },
  { key: "question", label: "질문" },
  { key: "code", label: "코드 공유" },
  { key: "assignment", label: "과제 제출" },
];

export function kindLabel(key: PostKind) {
  return KINDS.find((k) => k.key === key)?.label ?? "";
}

// 다른 학생 글을 언제 보여줄지 (계획서 2-3 제출 후 공개)
//  open: 항상 / after_submit: 내 글을 올리면 / teacher: 교사가 공개 버튼을 누르면
export type RevealMode = "open" | "after_submit" | "teacher";

export type Board = {
  id: string;
  title: string;
  description: string;
  subject: string; // 예: "과학 · 관찰"
  notice: string; // 대화 보기 위에 고정되는 선생님 공지
  sections: string[]; // 칸별 보기의 칸 이름 (예: 1모둠, 2모둠)
  default_view: ViewKey;
  allow_photos: boolean;
  default_kind: PostKind;
  reveal_mode: RevealMode;
  revealed: boolean; // reveal_mode=teacher 일 때 교사가 공개했는지
  owner_id: string;
  is_locked: boolean;
  post_count: number; // 학생에게 보이는 글 수
  created_at: string;
  updated_at: string;
};

export type BoardInput = Pick<
  Board,
  "title" | "description" | "subject" | "notice" | "sections" | "default_view" | "default_kind" | "reveal_mode"
>;
export type BoardChanges = Partial<
  Pick<Board, "is_locked" | "allow_photos" | "default_view" | "notice" | "reveal_mode" | "revealed">
>;

export type Post = {
  id: string;
  board_id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  kind: PostKind;
  title: string;
  content: string;
  section: string;
  image_path: string | null;
  solved_comment_id: string | null; // 질문에서 채택한 댓글 (있으면 해결됨)
  is_hidden: boolean;
  removed: boolean;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
};

export type PostInput = {
  board_id: string;
  kind: PostKind;
  title: string;
  content: string;
  section: string;
  image: File | null;
};
export type PostChanges = Partial<{
  content: string;
  is_hidden: boolean;
  deleted_at: string;
  solved_comment_id: string | null;
}>;

// 글 내용 최대 길이 (긴 코드를 위해 20,000자)
export const MAX_CONTENT = 20000;

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
  post_kind: PostKind | null;
  solved: boolean | null;
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
