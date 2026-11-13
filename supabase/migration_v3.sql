-- Thapar Seniors Circle · v3 migration
-- Open registration for batches 2028, 2029, 2030 · instant access · no seat limits.
-- Run AFTER schema.sql and migration_v2.sql, in Supabase → SQL Editor.

-- 1) Existing registrations: everyone is accepted. Old 2027 entries move to 2028.
update public.applications set batch = 2028 where batch = 2027;
update public.applications set status = 'approved', reviewed_by = coalesce(reviewed_by, 'auto-migration');

-- 2) Student batches are now 2028–2030 only
alter table public.applications drop constraint if exists applications_batch_check;
alter table public.applications add constraint applications_batch_check check (batch in (2028,2029,2030));
do $$ declare t text; begin
  foreach t in array array['resources','jobs','announcements'] loop
    execute format('update public.%I set batch = null where batch = 2027', t);
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_batch_check');
    execute format('alter table public.%I add constraint %I check (batch in (2028,2029,2030))', t, t || '_batch_check');
  end loop;
end $$;

-- 3) New registrations get access immediately (admins/mentors can still revoke from the dashboard)
alter table public.applications alter column status set default 'approved';
drop policy if exists "apply" on public.applications;
create policy "apply" on public.applications for insert to anon, authenticated
  with check (status = 'approved' and reviewed_by is null);
