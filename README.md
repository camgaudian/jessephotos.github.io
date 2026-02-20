# Jesse Fischer Photos

Public photography portfolio with a private admin area for managing images and metadata.

## Stack
- React + TypeScript + Vite
- Supabase Auth + Postgres + Storage
- GitHub Pages deployment via GitHub Actions

## Features
- Public home page with modern dark theme and deep red accents
- Infinite-scroll journal feed ordered by `shot_date DESC, created_at DESC`
- Admin login at `/admin` (email/password)
- Admin upload, metadata edit, soft delete to trash, restore, permanent delete
- Supabase RLS policies for public read + admin-only writes

## Environment Variables
Copy `.env.example` to `.env.local`:

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

## Local Development
```bash
npm install
npm run dev
```

## Supabase Setup
1. Run the migration in `supabase/migrations/20260220_init.sql` in Supabase SQL Editor.
2. Create the admin auth user (email/password) in Supabase Auth.
3. Add that user to `public.app_admins`:

```sql
insert into public.app_admins (user_id)
values ('PUT_THE_ADMIN_AUTH_UID_HERE');
```

4. Confirm a `photos` public bucket exists (migration creates/updates it).

## Deploying to GitHub Pages
1. In GitHub repo settings, enable GitHub Pages with GitHub Actions source.
2. Add repository secrets:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
3. Push to `main`; workflow in `.github/workflows/deploy.yml` builds and deploys.

## Notes
- SPA refresh for `/admin` is supported via `public/404.html` redirect behavior.
- This is a single-admin v1 setup by design.
