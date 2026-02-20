create extension if not exists pgcrypto;

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;

drop policy if exists "Admins can view own admin row" on public.app_admins;
create policy "Admins can view own admin row" on public.app_admins
for select
to authenticated
using (user_id = auth.uid());

create or replace function public.is_admin_user()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.app_admins admins
    where admins.user_id = auth.uid()
  );
$$;

grant execute on function public.is_admin_user() to anon, authenticated;

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  caption text,
  tags text[] not null default '{}',
  shot_date date not null,
  image_path text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_photos_shot_created on public.photos (shot_date desc, created_at desc);
create index if not exists idx_photos_deleted_at on public.photos (deleted_at);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_photos_updated_at on public.photos;
create trigger set_photos_updated_at
before update on public.photos
for each row
execute function public.touch_updated_at();

alter table public.photos enable row level security;

drop policy if exists "Public can read active photos" on public.photos;
create policy "Public can read active photos" on public.photos
for select
using (deleted_at is null);

drop policy if exists "Admin can read all photos" on public.photos;
create policy "Admin can read all photos" on public.photos
for select
to authenticated
using (public.is_admin_user());

drop policy if exists "Admin can insert photos" on public.photos;
create policy "Admin can insert photos" on public.photos
for insert
to authenticated
with check (public.is_admin_user());

drop policy if exists "Admin can update photos" on public.photos;
create policy "Admin can update photos" on public.photos
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "Admin can delete photos" on public.photos;
create policy "Admin can delete photos" on public.photos
for delete
to authenticated
using (public.is_admin_user());

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public read photos bucket" on storage.objects;
create policy "Public read photos bucket" on storage.objects
for select
to anon, authenticated
using (bucket_id = 'photos');

drop policy if exists "Admin upload photos bucket" on storage.objects;
create policy "Admin upload photos bucket" on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'photos'
  and public.is_admin_user()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Admin update photos bucket" on storage.objects;
create policy "Admin update photos bucket" on storage.objects
for update
to authenticated
using (
  bucket_id = 'photos'
  and public.is_admin_user()
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'photos'
  and public.is_admin_user()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Admin delete photos bucket" on storage.objects;
create policy "Admin delete photos bucket" on storage.objects
for delete
to authenticated
using (
  bucket_id = 'photos'
  and public.is_admin_user()
  and (storage.foldername(name))[1] = auth.uid()::text
);
