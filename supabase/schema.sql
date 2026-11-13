-- Thapar Seniors Circle · full schema. Run once in Supabase → SQL Editor (fresh project).

-- ========== Core ==========
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  name text not null, email text not null, branch text not null,
  phone text, cgpa numeric(4,2) check (cgpa between 0 and 10), goal text,
  resume_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by text, created_at timestamptz not null default now()
);
create unique index applications_email_key on public.applications (lower(email));

create table public.seniors (email text primary key);
-- Add seniors (Google emails they sign in with):
-- insert into public.seniors values ('you@gmail.com'), ('friend@gmail.com');

create function public.is_senior() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.seniors where lower(email) = lower(auth.jwt() ->> 'email'));
$$;
create function public.is_approved() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.applications
    where lower(email) = lower(auth.jwt() ->> 'email') and status = 'approved');
$$;
-- Public counters for the landing page (numbers only, no personal data)
create function public.public_stats() returns json
language sql security definer set search_path = public stable as $$
  select json_build_object('applied', (select count(*) from public.applications),
                           'approved', (select count(*) from public.applications where status = 'approved'));
$$;
grant execute on function public.is_senior(), public.is_approved() to authenticated;
grant execute on function public.public_stats() to anon, authenticated;

alter table public.applications enable row level security;
alter table public.seniors enable row level security;
create policy "apply" on public.applications for insert to anon, authenticated
  with check (status = 'pending' and reviewed_by is null);
create policy "seniors read" on public.applications for select to authenticated using (public.is_senior());
create policy "seniors update" on public.applications for update to authenticated
  using (public.is_senior()) with check (public.is_senior());
create policy "own row" on public.applications for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- Resume bucket: private, PDF only, 2 MB
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes','resumes',false,2097152,array['application/pdf']) on conflict (id) do nothing;
create policy "upload resume" on storage.objects for insert to anon, authenticated with check (bucket_id = 'resumes');
create policy "seniors read resumes" on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and public.is_senior());

-- ========== Content (members read, seniors write) ==========
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null, url text not null check (url ~* '^https?://'),
  category text not null default 'Other', description text,
  created_by text, created_at timestamptz not null default now()
);
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company text not null, role text not null, type text not null default 'Internship',
  link text not null check (link ~* '^https?://'), branches text, deadline date,
  referral boolean not null default false, created_by text, created_at timestamptz not null default now()
);
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null, body text, pinned boolean not null default false,
  created_by text, created_at timestamptz not null default now()
);
alter table public.resources enable row level security;
alter table public.jobs enable row level security;
alter table public.announcements enable row level security;
do $$ declare t text; begin
  foreach t in array array['resources','jobs','announcements'] loop
    execute format('create policy "members read" on public.%I for select to authenticated using (public.is_approved() or public.is_senior())', t);
    execute format('create policy "seniors add" on public.%I for insert to authenticated with check (public.is_senior())', t);
    execute format('create policy "seniors del" on public.%I for delete to authenticated using (public.is_senior())', t);
  end loop;
end $$;

-- Per-member job tracker (saved / applied)
create table public.job_status (
  user_email text not null, job_id uuid not null references public.jobs(id) on delete cascade,
  state text not null check (state in ('saved','applied')), updated_at timestamptz not null default now(),
  primary key (user_email, job_id)
);
alter table public.job_status enable row level security;
create policy "own tracker" on public.job_status for all to authenticated
  using (lower(user_email) = lower(auth.jwt() ->> 'email') and (public.is_approved() or public.is_senior()))
  with check (lower(user_email) = lower(auth.jwt() ->> 'email') and (public.is_approved() or public.is_senior()));

-- Public "Meet your seniors" cards (email stays hidden from anonymous visitors)
create table public.senior_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null unique, name text not null, company text, role text, bio text
);
alter table public.senior_profiles enable row level security;
revoke all on public.senior_profiles from anon;
grant select (id, name, company, role, bio) on public.senior_profiles to anon;
grant select, insert, update, delete on public.senior_profiles to authenticated;
create policy "profiles public" on public.senior_profiles for select to anon, authenticated using (true);
create policy "own profile add" on public.senior_profiles for insert to authenticated
  with check (public.is_senior() and lower(owner_email) = lower(auth.jwt() ->> 'email'));
create policy "own profile edit" on public.senior_profiles for update to authenticated
  using (lower(owner_email) = lower(auth.jwt() ->> 'email')) with check (lower(owner_email) = lower(auth.jwt() ->> 'email'));
create policy "own profile del" on public.senior_profiles for delete to authenticated
  using (lower(owner_email) = lower(auth.jwt() ->> 'email'));

-- ========== Ask a Senior (private) ==========
-- Visible to the junior, and to seniors only until ONE senior claims it; then only that senior.
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  junior_email text not null, junior_name text not null, title text not null,
  assigned_to text, assigned_name text, created_at timestamptz not null default now()
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  sender_email text not null, sender_name text not null,
  sender_role text not null check (sender_role in ('junior','senior')),
  body text not null check (length(body) between 1 and 4000), created_at timestamptz not null default now()
);
alter table public.questions enable row level security;
alter table public.messages enable row level security;
create policy "q read" on public.questions for select to authenticated using (
  lower(junior_email) = lower(auth.jwt() ->> 'email')
  or (public.is_senior() and (assigned_to is null or lower(assigned_to) = lower(auth.jwt() ->> 'email'))));
create policy "q ask" on public.questions for insert to authenticated with check (
  public.is_approved() and lower(junior_email) = lower(auth.jwt() ->> 'email') and assigned_to is null);
create policy "q claim" on public.questions for update to authenticated
  using (public.is_senior() and (assigned_to is null or lower(assigned_to) = lower(auth.jwt() ->> 'email')))
  with check (public.is_senior() and lower(assigned_to) = lower(auth.jwt() ->> 'email'));
create policy "m read" on public.messages for select to authenticated
  using (exists (select 1 from public.questions q where q.id = question_id));
create policy "m send" on public.messages for insert to authenticated with check (
  lower(sender_email) = lower(auth.jwt() ->> 'email')
  and exists (select 1 from public.questions q where q.id = question_id
    and (lower(q.junior_email) = lower(auth.jwt() ->> 'email') or lower(q.assigned_to) = lower(auth.jwt() ->> 'email')))
  and ((sender_role = 'junior' and public.is_approved()) or (sender_role = 'senior' and public.is_senior())));
