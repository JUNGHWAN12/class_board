-- 수업용 게시판 초기 스키마
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 실행하면 됩니다.

-- ---------------------------------------------------------------
-- 설정: 허용할 학교 구글 도메인 (예: 'school.kr'). NULL 이면 모든 구글 계정 허용.
-- ---------------------------------------------------------------
create table public.app_config (
  id boolean primary key default true check (id),
  allowed_domain text
);
insert into public.app_config (id, allowed_domain) values (true, null);

-- 교사 명단 (이메일). 여기 있는 사람은 게시판을 만들고 모든 글을 관리할 수 있습니다.
create table public.teachers (
  email text primary key
);

-- 로그인한 사용자 정보 (구글 이름/사진)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 100),
  description text not null default '' check (char_length(description) <= 1000),
  owner_id uuid not null references public.profiles (id),
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  content text not null check (char_length(content) between 1 and 5000),
  image_path text,
  is_hidden boolean not null default false,
  deleted_at timestamptz,
  like_count integer not null default 0,
  comment_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_board_updated_idx on public.posts (board_id, updated_at);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  content text not null check (char_length(content) between 1 and 1000),
  is_hidden boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_post_updated_idx on public.comments (post_id, updated_at);

create table public.likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index likes_user_idx on public.likes (user_id);

-- ---------------------------------------------------------------
-- 권한 도우미 함수
-- ---------------------------------------------------------------
create or replace function public.current_email() returns text
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.is_school_user() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    (select allowed_domain from app_config) is null
    or public.current_email() like '%@' || lower((select allowed_domain from app_config))
  )
$$;

create or replace function public.is_teacher() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_school_user()
     and exists (select 1 from teachers where lower(email) = public.current_email())
$$;

create or replace function public.board_open(p_board uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from boards where id = p_board and not is_locked)
$$;

-- 댓글/좋아요를 달 수 있는 글인지 (삭제·숨김 아님, 댓글은 게시판이 열려 있어야 함)
create or replace function public.post_active(p_post uuid, p_need_open boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from posts p
     where p.id = p_post and p.deleted_at is null and not p.is_hidden
       and (not p_need_open or public.board_open(p.board_id) or public.is_teacher())
  )
$$;

-- ---------------------------------------------------------------
-- 트리거: 프로필 자동 생성, updated_at, 좋아요/댓글 수
-- ---------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, name, avatar_url)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set email = excluded.email, name = excluded.name, avatar_url = excluded.avatar_url;
  return new;
end $$;

create trigger on_auth_user_created
  after insert or update of raw_user_meta_data, email on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger boards_touch before update on public.boards
  for each row execute function public.touch_updated_at();
create trigger posts_touch before update on public.posts
  for each row execute function public.touch_updated_at();
create trigger comments_touch before update on public.comments
  for each row execute function public.touch_updated_at();

-- 학생이 바꾸면 안 되는 칸(숨김, 카운트, 작성자 등)을 보호
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
  end if;
  return new;
end $$;
create trigger posts_guard before update on public.posts
  for each row execute function public.guard_post_update();

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
  end if;
  return new;
end $$;
create trigger comments_guard before update on public.comments
  for each row execute function public.guard_comment_update();

-- 좋아요/댓글 수를 글에 반영 (글의 updated_at 도 갱신되어 다른 학생 화면에 반영됨)
create or replace function public.sync_post_counts() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_post uuid := coalesce(new.post_id, old.post_id);
begin
  if tg_table_name = 'likes' then
    update posts set like_count = (select count(*) from likes where post_id = v_post)
     where id = v_post;
  else
    update posts set comment_count = (
      select count(*) from comments
       where post_id = v_post and deleted_at is null and not is_hidden)
     where id = v_post;
  end if;
  return null;
end $$;
create trigger likes_count after insert or delete on public.likes
  for each row execute function public.sync_post_counts();
create trigger comments_count after insert or update or delete on public.comments
  for each row execute function public.sync_post_counts();

-- ---------------------------------------------------------------
-- 행 단위 보안 (RLS)
-- ---------------------------------------------------------------
alter table public.app_config enable row level security;
alter table public.teachers enable row level security;
alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;

create policy "config readable" on public.app_config for select using (true);

create policy "teacher list readable by teachers" on public.teachers
  for select using (public.is_teacher());

-- 이메일 보호: 본인과 교사만 직접 조회. 이름은 읽기 함수가 함께 내려줍니다.
create policy "own profile or teacher" on public.profiles
  for select using (id = auth.uid() or public.is_teacher());

create policy "boards readable" on public.boards
  for select using (public.is_school_user());
create policy "teachers create boards" on public.boards
  for insert with check (public.is_teacher() and owner_id = auth.uid());
create policy "teachers update boards" on public.boards
  for update using (public.is_teacher()) with check (public.is_teacher());
create policy "teachers delete boards" on public.boards
  for delete using (public.is_teacher());

-- 글 읽기는 아래 get_board_posts 함수로 합니다. 직접 읽기는 본인 글과 교사만.
create policy "own posts or teacher" on public.posts
  for select using (author_id = auth.uid() or public.is_teacher());
create policy "students write posts" on public.posts
  for insert with check (
    public.is_school_user() and author_id = auth.uid()
    and not is_hidden and deleted_at is null and like_count = 0 and comment_count = 0
    and (public.board_open(board_id) or public.is_teacher())
  );
create policy "edit own posts or teacher" on public.posts
  for update using (author_id = auth.uid() or public.is_teacher())
  with check (author_id = auth.uid() or public.is_teacher());

create policy "own comments or teacher" on public.comments
  for select using (author_id = auth.uid() or public.is_teacher());
create policy "write comments" on public.comments
  for insert with check (
    public.is_school_user() and author_id = auth.uid()
    and not is_hidden and deleted_at is null
    and public.post_active(post_id, true)
  );
create policy "edit own comments or teacher" on public.comments
  for update using (author_id = auth.uid() or public.is_teacher())
  with check (author_id = auth.uid() or public.is_teacher());

create policy "own likes readable" on public.likes
  for select using (user_id = auth.uid());
create policy "like" on public.likes
  for insert with check (
    public.is_school_user() and user_id = auth.uid()
    and public.post_active(post_id, false)
  );
create policy "unlike" on public.likes
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------
-- 읽기 함수: 바뀐 글만 가져오기 (몇 초마다 호출)
-- 숨김/삭제된 글도 "removed" 로 내려줘서 다른 학생 화면에서 사라지게 합니다.
-- ---------------------------------------------------------------
create or replace function public.get_board_posts(p_board uuid, p_since timestamptz default null)
returns table (
  id uuid,
  board_id uuid,
  author_id uuid,
  author_name text,
  author_avatar text,
  content text,
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
    case when visible then p.content else '' end,
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
  join posts p on p.id = c.post_id
  join profiles pr on pr.id = c.author_id
  cross join me
  cross join lateral (
    select c.deleted_at is null and (not c.is_hidden or me.teacher or c.author_id = me.uid) as visible
  ) v
  where public.is_school_user()
    and c.post_id = p_post
    and p.deleted_at is null
    and (not p.is_hidden or me.teacher or p.author_id = me.uid)
    and (p_since is null or c.updated_at > p_since)
    and (p_since is not null or c.deleted_at is null)
  order by c.updated_at
  limit 1000
$$;

-- 교사용 엑셀(CSV) 내보내기
create or replace function public.export_board(p_board uuid)
returns table (
  kind text,
  post_id uuid,
  author_name text,
  author_email text,
  content text,
  like_count integer,
  is_hidden boolean,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select * from (
    select '글'::text, p.id, pr.name, pr.email, p.content, p.like_count, p.is_hidden, p.created_at
      from posts p join profiles pr on pr.id = p.author_id
     where p.board_id = p_board and p.deleted_at is null
    union all
    select '댓글'::text, c.post_id, pr.name, pr.email, c.content, null::integer, c.is_hidden, c.created_at
      from comments c join posts p on p.id = c.post_id join profiles pr on pr.id = c.author_id
     where p.board_id = p_board and p.deleted_at is null and c.deleted_at is null
  ) t
  where public.is_teacher()
  order by 2, 8
$$;

-- 일시정지 방지용 가벼운 확인 함수 (GitHub Actions 가 주기적으로 호출)
create or replace function public.ping() returns text
language sql stable as $$ select 'ok'::text $$;


-- ---------------------------------------------------------------
-- 사진 저장소 (공개 버킷, 경로: <사용자id>/<파일명>)
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "upload own images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'post-images'
    and public.is_school_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "delete own images or teacher" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'post-images'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_teacher())
  );
