-- 점검 보고서(docs/review-2026-10-20.md) 1단계 보안·권한 수정
-- 0001~0004 마이그레이션을 실행한 뒤에 SQL Editor 에 붙여넣고 실행합니다.
--  - S1: 학생이 글 수정으로 사진 경로·글 종류를 바꾸지 못하게
--  - S2: 내용·제목을 고친 시각(edited_at)을 기록해 화면과 엑셀에 표시
--  - S4: 잠긴 게시판에서 학생 댓글 수정 금지, 학생은 댓글 내용을 고칠 수 없음(삭제만)
--  - S5: 새 글에 채택 댓글·수정 시각을 미리 넣지 못하게
--  - D1: '제출하면 공개' 과제 게시판은 과제 제출 글을 올려야 공개

-- ---------------------------------------------------------------
-- 수정 시각
-- ---------------------------------------------------------------
alter table public.posts add column edited_at timestamptz;

-- ---------------------------------------------------------------
-- 글 수정 보호 (0001 의 함수를 바꿉니다)
-- ---------------------------------------------------------------
create or replace function public.guard_post_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- 좋아요/댓글 수 갱신 트리거 안에서 일어난 변경은 통과
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  if new.board_id <> old.board_id or new.author_id <> old.author_id
     or new.like_count <> old.like_count or new.comment_count <> old.comment_count
     or new.created_at <> old.created_at then
    raise exception '변경할 수 없는 항목입니다';
  end if;
  if not public.is_teacher() then
    if new.is_hidden <> old.is_hidden then
      raise exception '교사만 글을 숨길 수 있습니다';
    end if;
    if old.deleted_at is not null then
      raise exception '삭제된 글입니다';
    end if;
    if not public.board_open(new.board_id) then
      raise exception '잠긴 게시판입니다';
    end if;
    -- 사진은 글을 올릴 때만 (사진 허용 검사는 쓰기 정책에 있음). 다른 학생 사진 경로를 넣는 것도 막습니다.
    if new.image_path is distinct from old.image_path then
      raise exception '사진은 바꿀 수 없습니다';
    end if;
    if new.kind <> old.kind then
      raise exception '글 종류는 바꿀 수 없습니다';
    end if;
  end if;
  -- 수정 시각은 서버가 정합니다 (좋아요·댓글로 바뀌는 updated_at 과 구분)
  if new.content <> old.content or new.title <> old.title then
    new.edited_at = now();
  else
    new.edited_at = old.edited_at;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------
-- 댓글 수정 보호 (0001 의 함수를 바꿉니다)
-- ---------------------------------------------------------------
create or replace function public.guard_comment_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.post_id <> old.post_id or new.author_id <> old.author_id
     or new.created_at <> old.created_at then
    raise exception '변경할 수 없는 항목입니다';
  end if;
  if not public.is_teacher() then
    if new.is_hidden <> old.is_hidden then
      raise exception '교사만 댓글을 숨길 수 있습니다';
    end if;
    if old.deleted_at is not null then
      raise exception '삭제된 댓글입니다';
    end if;
    -- 채택된 뒤 답변을 바꾸지 못하도록, 학생은 댓글을 지우기만 할 수 있습니다.
    if new.content <> old.content then
      raise exception '댓글 내용은 고칠 수 없습니다';
    end if;
    if not exists (select 1 from posts p where p.id = new.post_id and public.board_open(p.board_id)) then
      raise exception '잠긴 게시판입니다';
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------
-- 글 쓰기 정책: 채택 댓글·수정 시각은 비어 있어야 함
-- ---------------------------------------------------------------
drop policy "students write posts" on public.posts;
create policy "students write posts" on public.posts
  for insert with check (
    public.is_school_user() and author_id = auth.uid()
    and not is_hidden and deleted_at is null and like_count = 0 and comment_count = 0
    and solved_comment_id is null and edited_at is null
    and (public.board_open(board_id) or public.is_teacher())
    and (image_path is null or public.board_photos_allowed(board_id) or public.is_teacher())
  );

-- ---------------------------------------------------------------
-- 제출 후 공개: 과제 게시판(기본 종류가 과제 제출)은 과제 제출 글만 셉니다.
-- 다른 게시판은 지금처럼 내 글이 하나라도 있으면 공개합니다.
-- ---------------------------------------------------------------
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
                where mine.board_id = b.id and mine.author_id = auth.uid() and mine.deleted_at is null
                  and (b.default_kind <> 'assignment' or mine.kind = 'assignment')))
       )
  )
$$;

-- ---------------------------------------------------------------
-- 읽기 함수에 수정 시각 추가 (반환 모양이 바뀌어 다시 만듭니다)
-- ---------------------------------------------------------------
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
  updated_at timestamptz,
  edited_at timestamptz
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
    p.like_count, p.comment_count, p.created_at, p.updated_at,
    case when visible then p.edited_at else null end
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
  created_at timestamptz,
  edited_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select * from (
    select '글'::text, p.kind,
           case when p.kind = 'question' then p.solved_comment_id is not null end,
           p.id, pr.name, pr.email, p.title, p.section, p.content, p.like_count, p.is_hidden, p.created_at,
           p.edited_at
      from posts p join profiles pr on pr.id = p.author_id
     where p.board_id = p_board and p.deleted_at is null
    union all
    select '댓글'::text, null::text, null::boolean,
           c.post_id, pr.name, pr.email, ''::text, p.section, c.content, null::integer, c.is_hidden, c.created_at,
           null::timestamptz
      from comments c join posts p on p.id = c.post_id join profiles pr on pr.id = c.author_id
     where p.board_id = p_board and p.deleted_at is null and c.deleted_at is null
  ) t
  where public.is_teacher()
  order by 4, 12
$$;
