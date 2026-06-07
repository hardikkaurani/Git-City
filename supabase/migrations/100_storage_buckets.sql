-- Ensure storage buckets required by a fresh Git City project exist.
-- Runtime upload routes still create these defensively, but migrations should
-- make a new Supabase project usable before the first cron/upload request.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('city-data', 'city-data', true, 52428800, array['application/json', 'application/gzip']),
  ('portfolio', 'portfolio', true, 2097152, array['image/png', 'image/jpeg', 'image/webp']),
  ('billboards', 'billboards', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
