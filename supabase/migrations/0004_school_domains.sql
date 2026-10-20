-- 학교 구글 도메인을 여러 개 허용하기
-- 0001~0003 마이그레이션을 실행한 뒤에 실행합니다. 여러 번 실행해도 괜찮습니다.

-- 허용할 도메인 목록. 비어 있으면 모든 구글 계정을 허용합니다(시험용).
create table if not exists public.school_domains (
  domain text primary key check (domain = lower(domain) and domain ~ '^[a-z0-9.-]+$')
);
alter table public.school_domains enable row level security;
drop policy if exists "domains readable" on public.school_domains;
create policy "domains readable" on public.school_domains for select using (true);

-- 예전 방식(app_config.allowed_domain)에 넣어 둔 값이 있으면 옮겨 옵니다.
insert into public.school_domains (domain)
select lower(allowed_domain) from public.app_config where allowed_domain is not null
on conflict do nothing;

-- 이메일의 @ 뒤가 목록에 있는 도메인과 정확히 같아야 학교 계정으로 인정합니다.
create or replace function public.is_school_user() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    not exists (select 1 from school_domains)
    or split_part(public.current_email(), '@', 2) in (select domain from school_domains)
  )
$$;

comment on column public.app_config.allowed_domain is '더 이상 쓰지 않음. school_domains 표를 쓰세요.';
