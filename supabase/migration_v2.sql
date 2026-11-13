-- Thapar Seniors Circle · v2 migration (batches 2027–2030, mentor registration, admins)
-- Run AFTER schema.sql, in Supabase → SQL Editor. Safe to run once on your existing project.

-- 1) Batches for students
alter table public.applications add column if not exists batch int not null default 2028;
alter table public.applications drop constraint if exists applications_batch_check;
alter table public.applications add constraint applications_batch_check check (batch in (2027,2028,2029,2030));

-- 2) Admins (they approve mentors; they also get all mentor powers)
create table if not exists public.admins (email text primary key);
alter table public.admins enable row level security;
-- insert into public.admins values ('you@gmail.com');   -- <- add yourself!

create or replace function public.is_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.admins where lower(email) = lower(auth.jwt() ->> 'email'));
$$;
create or replace function public.is_senior() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.seniors where lower(email) = lower(auth.jwt() ->> 'email'))
      or exists (select 1 from public.admins where lower(email) = lower(auth.jwt() ->> 'email'));
$$;
create or replace function public.my_batch() returns int
language sql security definer set search_path = public stable as $$
  select batch from public.applications
  where lower(email) = lower(auth.jwt() ->> 'email') and status = 'approved' limit 1;
$$;
drop function if exists public.public_stats();
create or replace function public.public_stats(b int default null) returns json
language sql security definer set search_path = public stable as $$
  select json_build_object(
    'applied',  (select count(*) from public.applications where b is null or batch = b),
    'approved', (select count(*) from public.applications where status = 'approved' and (b is null or batch = b)));
$$;
grant execute on function public.is_admin(), public.my_batch() to authenticated;
grant execute on function public.public_stats(int) to anon, authenticated;

-- 3) Batch-targeted content (null = visible to every batch)
do $$ declare t text; begin
  foreach t in array array['resources','jobs','announcements'] loop
    execute format('alter table public.%I add column if not exists batch int check (batch in (2027,2028,2029,2030))', t);
    execute format('drop policy if exists "members read" on public.%I', t);
    execute format('create policy "members read" on public.%I for select to authenticated using (public.is_senior() or (public.is_approved() and (batch is null or batch = public.my_batch())))', t);
  end loop;
end $$;

-- 4) Mentor registration
create table if not exists public.mentor_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null, email text not null, grad_batch text not null, company text not null,
  phone text not null, linkedin text not null check (linkedin ~* '^https?://'),
  github text check (github is null or github ~* '^https?://'),
  resume_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by text, created_at timestamptz not null default now()
);
create unique index if not exists mentor_applications_email_key on public.mentor_applications (lower(email));
alter table public.mentor_applications enable row level security;
drop policy if exists "mentor apply" on public.mentor_applications;
drop policy if exists "admin read mentors" on public.mentor_applications;
drop policy if exists "own mentor row" on public.mentor_applications;
create policy "mentor apply" on public.mentor_applications for insert to anon, authenticated
  with check (status = 'pending' and reviewed_by is null);
create policy "admin read mentors" on public.mentor_applications for select to authenticated using (public.is_admin());
create policy "own mentor row" on public.mentor_applications for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- Only admins can approve / reject / revoke a mentor. Approving grants mentor access.
create or replace function public.set_mentor_status(app_id uuid, new_status text) returns void
language plpgsql security definer set search_path = public as $$
declare m_email text;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if new_status not in ('pending','approved','rejected') then raise exception 'bad status'; end if;
  update public.mentor_applications set status = new_status, reviewed_by = lower(auth.jwt() ->> 'email')
    where id = app_id returning email into m_email;
  if m_email is null then raise exception 'not found'; end if;
  if new_status = 'approved' then
    insert into public.seniors (email) values (lower(m_email)) on conflict do nothing;
  else
    delete from public.seniors where lower(email) = lower(m_email);
  end if;
end $$;
grant execute on function public.set_mentor_status(uuid, text) to authenticated;

-- 5) Storage: mentor resumes (folder mentors/) are readable by admins only
drop policy if exists "seniors read resumes" on storage.objects;
create policy "seniors read resumes" on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and ((public.is_senior() and name not like 'mentors/%') or public.is_admin()));
