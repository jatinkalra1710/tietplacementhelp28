# Thapar Seniors Circle

Free, student-run placement guidance platform (2027 batch → 2028 batch). Static site + one tiny Vercel function. Backend: Supabase (Postgres, Auth with Google, Storage).

## Setup
1. **Supabase**: SQL Editor → run `supabase/schema.sql`, then `migration_v2.sql`, then `migration_v3.sql`. Add yourself as admin:
   `insert into public.admins values ('you@gmail.com');`
   Admins approve mentors (Mentors tab) and also get all mentor powers. Approved mentors approve students.
2. **Google sign-in**: Google Cloud Console → Credentials → OAuth client (Web). Authorized redirect URI:
   `https://YOUR-PROJECT.supabase.co/auth/v1/callback`. Paste Client ID/Secret in Supabase → Authentication → Providers → Google.
3. **Supabase → Authentication → URL Configuration**: Site URL = your Vercel URL; add it to Redirect URLs too.
4. **Vercel**: push this folder to GitHub → Import in Vercel (Framework: Other). Add Environment Variables:
   `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Redeploy.
5. Open the site, sign in with a senior Google account, and start approving.

Local test: `npx vercel dev` (with a `.env` copied from `.env.example`).

Security notes: the anon key is public by design; all protection comes from Row Level Security in `schema.sql`. Never put the service_role key in Vercel env vars for this project.

## Roles
- **Student** (batch 2027–2030): registers on the batch page (2028–2030) and gets instant access; mentors/admins can revoke.
- **Mentor** (batch 2027 and earlier): registers at `#/mentor`, approved by an admin.
- **Admin**: row in `admins` table.
