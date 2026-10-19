export type Board = {
  id: string;
  title: string;
  description: string;
  owner_id: string;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
};

export type Post = {
  id: string;
  board_id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  content: string;
  image_path: string | null;
  is_hidden: boolean;
  removed: boolean;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
};

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
