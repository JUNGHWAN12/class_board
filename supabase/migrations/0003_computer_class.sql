-- 컴퓨터 과목 특화 기능 (계획서 2장의 필수 항목)
-- 0002_topic_boards.sql 다음에 SQL Editor 에 붙여넣고 실행합니다.
--  - 글 종류 (일반/질문/코드 공유/과제 제출), 질문 해결됨(채택 댓글)
--  - 제출 후 공개: 학생은 내 글을 올리기 전(또는 교사가 공개하기 전)에는 다른 학생 글을 볼 수 없음
--    화면에서만 숨기면 우회할 수 있어서 읽기 함수에서 막습니다.
--  - 긴 코드를 위해 글 20,000자, 댓글 5,000자까지

-- ---------------------------------------------------------------
-- 칸 추가
-- ---------------------------------------------------------------
alter table public.boards
  add column default_kind text not null default 'general'
    check (default_kind in ('general', 'question', 'code', 'assignment')),
  add column reveal_mode text not null default 'open'
    check (reveal_mode in ('open', 'after_submit', 'teacher')),
  add column revealed boolean not null default false;

alter table public.posts
  add column kind text not null default 'general'
    check (kind in ('general', 'question', 'code', 'assignment')),
  add column solved_comment_id uuid references public.comments (id) on delete set null;

alter table public.posts drop constraint posts_content_check;
alter table public.posts add constraint posts_content_check check (char_length(content) between 1 and 20000);
alter table public.comments drop constraint comments_content_check;
alter table public.comments add constraint comments_content_check check (char_length(content) between 1 and 5000);

-- ---------------------------------------------------------------
-- 보이는 범위
-- ---------------------------------------------------------------
-- 이 게시판에서 다른 학생 글을 볼 수 있는지 (교사는 항상)
create or replace function public.board_revealed_for_me(p_board uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_teacher() or exists (
    select 1 from boards b
     where b.id = p_board
       and (
         b.reveal_mode = 'open'
         or (b.reveal_mode = 'teacher' and b.revealed)
         or (b.reveal_mode = 'after_submit' and exists (
               select 1 from posts mine
                where mine.board_id = b.id and mine.author_id = auth.uid() and mine.deleted_at is null))
       )
  )
$$;

-- 이 글을 볼 수 있는지: 삭제 안 됨 + (교사 / 내 글 / 숨김 아님 + 게시판 공개)
create or replace function public.can_see_post(p_post uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from posts p
     where p.id = p_post and p.deleted_at is null
       and (public.is_teacher() or p.author_id = auth.uid()
            or (not p.is_hidden and public.board_revealed_for_me(p.board_id)))
  )
$$;

-- 댓글/좋아요를 달 수 있는 글: 볼 수 있는 글이어야 함
create or replace function public.post_active(p_post uuid, p_need_open boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from posts p
     where p.id = p_post and p.deleted_at is null and not p.is_hidden
       and public.can_see_post(p.id)
       and (not p_need_open or public.board_open(p.board_id) or public.is_teacher())
  )
$$;

-- ---------------------------------------------------------------
-- 채택: 그 글의 댓글만 고를 수 있음 (질문한 학생 또는 교사 — 수정 권한은 기존 RLS)
-- ---------------------------------------------------------------
create or replace function public.guard_post_solved() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.solved_comment_id is distinct from old.solved_comment_id and new.solved_comment_id is not null then
    if new.kind <> 'question' then
      raise exception '질문 글만 채택할 수 있습니다';
    end if;
    if not exists (select 1 from comments c where c.id = new.solved_comment_id and c.post_id = new.id and c.deleted_at is null) then
      raise exception '이 글의 댓글만 채택할 수 있습니다';
    end if;
  end if;
  return new;
end $$;
create trigger posts_guard_solved before update on public.posts
  for each row execute function public.guard_post_solved();

-- ---------------------------------------------------------------
-- 읽기 함수 다시 만들기
-- ---------------------------------------------------------------
drop function public.get_boards(uuid);
create function public.get_boards(p_board uuid default null)
returns table (
  id uuid,
  title text,
  description text,
  subject text,
  notice text,
  sections text[],
  default_view text,
  default_kind text,
  reveal_mode text,
  revealed boolean,
  allow_photos boolean,
  owner_id uuid,
  is_locked boolean,
  post_count integer,
  created_at timestamptz,
  updated_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    b.id, b.title, b.description, b.subject, b.notice, b.sections, b.default_view,
    b.default_kind, b.reveal_mode, b.revealed, b.allow_photos, b.owner_id, b.is_locked,
    (select count(*)::integer from posts p
      where p.board_id = b.id and p.deleted_at is null and not p.is_hidden),
    b.created_at, b.updated_at
  from boards b
  where public.is_school_user()
    and (p_board is null or b.id = p_board)
  order by b.created_at
$$;

-- 볼 수 없는 글은 removed=true 로 내용·작성자 없이 내려줘서 화면에서 사라지게 합니다.
drop function public.get_board_posts(uuid, timestamptz);
create function public.get_board_posts(p_board uuid, p_since timestamptz default null)
returns table (
  id uuid,
  board_id uuid,
  author_id uuid,
  author_name text,
  author_avatar text,
  kind text,
  title text,
  content text,
  section text,
  image_path text,
  solved_comment_id uuid,
  is_hidden boolean,
  removed boolean,
  like_count integer,
  comment_count integer,
  created_at timestamptz,
  updated_at timestamptz
)
language sql stable security definer set search_path = public as $$
  with me as (
    select auth.uid() as uid, public.is_teacher() as teacher,
           public.board_revealed_for_me(p_board) as revealed
  )
  select
    p.id, p.board_id,
    case when visible then p.author_id else null end,
    case when visible then pr.name else '' end,
    case when visible then pr.avatar_url else null end,
    p.kind,
    case when visible then p.title else '' end,
    case when visible then p.content else '' end,
    p.section,
    case when visible then p.image_path else null end,
    p.solved_comment_id,
    p.is_hidden,
    not visible,
    p.like_count, p.comment_count, p.created_at, p.updated_at
  from posts p
  join profiles pr on pr.id = p.author_id
  cross join me
  cross join lateral (
    select p.deleted_at is null
       and (me.teacher or p.author_id = me.uid or (not p.is_hidden and me.revealed)) as visible
  ) v
  where public.is_school_user()
    and p.board_id = p_board
    and (p_since is null or p.updated_at > p_since)
    and (p_since is not null or visible)
  order by p.updated_at
  limit 1000
$$;

create or replace function public.get_post_comments(p_post uuid, p_since timestamptz default null)
returns table (
  id uuid,
  post_id uuid,
  author_id uuid,
  author_name text,
  author_avatar text,
  content text,
  is_hidden boolean,
  removed boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as uid, public.is_teacher() as teacher)
  select
    c.id, c.post_id, c.author_id, pr.name, pr.avatar_url,
    case when visible then c.content else '' end,
    c.is_hidden,
    not visible,
    c.created_at, c.updated_at
  from comments c
  join profiles pr on pr.id = c.author_id
  cross join me
  cross join lateral (
    select c.deleted_at is null and (not c.is_hidden or me.teacher or c.author_id = me.uid) as visible
  ) v
  where public.is_school_user()
    and c.post_id = p_post
    and public.can_see_post(p_post)
    and (p_since is null or c.updated_at > p_since)
    and (p_since is not null or c.deleted_at is null)
  order by c.updated_at
  limit 1000
$$;

drop function public.export_board(uuid);
create function public.export_board(p_board uuid)
returns table (
  kind text,
  post_kind text,
  solved boolean,
  post_id uuid,
  author_name text,
  author_email text,
  title text,
  section text,
  content text,
  like_count integer,
  is_hidden boolean,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select * from (
    select '글'::text, p.kind,
           case when p.kind = 'question' then p.solved_comment_id is not null end,
           p.id, pr.name, pr.email, p.title, p.section, p.content, p.like_count, p.is_hidden, p.created_at
      from posts p join profiles pr on pr.id = p.author_id
     where p.board_id = p_board and p.deleted_at is null
    union all
    select '댓글'::text, null::text, null::boolean,
           c.post_id, pr.name, pr.email, ''::text, p.section, c.content, null::integer, c.is_hidden, c.created_at
      from comments c join posts p on p.id = c.post_id join profiles pr on pr.id = c.author_id
     where p.board_id = p_board and p.deleted_at is null and c.deleted_at is null
  ) t
  where public.is_teacher()
  order by 4, 12
$$;
