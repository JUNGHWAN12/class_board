-- 주제별 독립 게시판 (UI 초안 통합안)
-- 0001_init.sql 다음에 SQL Editor 에 붙여넣고 실행합니다.
--  - 게시판: 과목·활동, 공지, 칸 이름, 기본 보기, 사진 허용
--  - 글: 제목(선택), 칸
--  - 첫 화면용 get_boards (글 수 포함)

-- ---------------------------------------------------------------
-- 게시판 설정
-- ---------------------------------------------------------------
alter table public.boards
  add column subject text not null default '' check (char_length(subject) <= 40),
  add column notice text not null default '' check (char_length(notice) <= 300),
  add column sections text[] not null default '{}' check (cardinality(sections) <= 8),
  add column default_view text not null default 'wall'
    check (default_view in ('wall', 'list', 'feed', 'group', 'chat')),
  add column allow_photos boolean not null default true;

-- ---------------------------------------------------------------
-- 글: 제목, 칸
-- ---------------------------------------------------------------
alter table public.posts
  add column title text not null default '' check (char_length(title) <= 100),
  add column section text not null default '' check (char_length(section) <= 50);

create or replace function public.board_photos_allowed(p_board uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from boards where id = p_board and allow_photos)
$$;

-- 사진 허용을 끈 게시판에는 학생이 사진 글을 올릴 수 없음
drop policy "students write posts" on public.posts;
create policy "students write posts" on public.posts
  for insert with check (
    public.is_school_user() and author_id = auth.uid()
    and not is_hidden and deleted_at is null and like_count = 0 and comment_count = 0
    and (public.board_open(board_id) or public.is_teacher())
    and (image_path is null or public.board_photos_allowed(board_id) or public.is_teacher())
  );

-- ---------------------------------------------------------------
-- 첫 화면: 게시판 + 학생에게 보이는 글 수 (p_board 를 주면 그 게시판 하나)
-- ---------------------------------------------------------------
create or replace function public.get_boards(p_board uuid default null)
returns table (
  id uuid,
  title text,
  description text,
  subject text,
  notice text,
  sections text[],
  default_view text,
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
    b.allow_photos, b.owner_id, b.is_locked,
    (select count(*)::integer from posts p
      where p.board_id = b.id and p.deleted_at is null and not p.is_hidden),
    b.created_at, b.updated_at
  from boards b
  where public.is_school_user()
    and (p_board is null or b.id = p_board)
  order by b.created_at
$$;

-- ---------------------------------------------------------------
-- 글 읽기 함수에 제목·칸 추가 (반환 모양이 바뀌어 다시 만듭니다)
-- ---------------------------------------------------------------
drop function public.get_board_posts(uuid, timestamptz);
create function public.get_board_posts(p_board uuid, p_since timestamptz default null)
returns table (
  id uuid,
  board_id uuid,
  author_id uuid,
  author_name text,
  author_avatar text,
  title text,
  content text,
  section text,
  image_path text,
  is_hidden boolean,
  removed boolean,
  like_count integer,
  comment_count integer,
  created_at timestamptz,
  updated_at timestamptz
)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as uid, public.is_teacher() as teacher)
  select
    p.id, p.board_id, p.author_id, pr.name, pr.avatar_url,
    case when visible then p.title else '' end,
    case when visible then p.content else '' end,
    p.section,
    case when visible then p.image_path else null end,
    p.is_hidden,
    not visible,
    p.like_count, p.comment_count, p.created_at, p.updated_at
  from posts p
  join profiles pr on pr.id = p.author_id
  cross join me
  cross join lateral (
    select p.deleted_at is null and (not p.is_hidden or me.teacher or p.author_id = me.uid) as visible
  ) v
  where public.is_school_user()
    and p.board_id = p_board
    and (p_since is null or p.updated_at > p_since)
    and (p_since is not null or p.deleted_at is null)
  order by p.updated_at
  limit 1000
$$;

drop function public.export_board(uuid);
create function public.export_board(p_board uuid)
returns table (
  kind text,
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
    select '글'::text, p.id, pr.name, pr.email, p.title, p.section, p.content, p.like_count, p.is_hidden, p.created_at
      from posts p join profiles pr on pr.id = p.author_id
     where p.board_id = p_board and p.deleted_at is null
    union all
    select '댓글'::text, c.post_id, pr.name, pr.email, ''::text, p.section, c.content, null::integer, c.is_hidden, c.created_at
      from comments c join posts p on p.id = c.post_id join profiles pr on pr.id = c.author_id
     where p.board_id = p_board and p.deleted_at is null and c.deleted_at is null
  ) t
  where public.is_teacher()
  order by 2, 10
$$;
