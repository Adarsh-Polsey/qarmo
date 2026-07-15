-- supabase/storage/buckets.sql
-- Configure avatars storage bucket and RLS policies

-- Create the avatars bucket if it doesn't exist
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB limit
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Enable RLS on storage.objects (already enabled by Supabase)
-- Policies for avatars bucket

-- Drop existing policies if they exist to avoid conflicts
drop policy if exists "Public Access to Avatars" on storage.objects;
drop policy if exists "Owners can upload avatars" on storage.objects;
drop policy if exists "Owners can update avatars" on storage.objects;
drop policy if exists "Owners can delete avatars" on storage.objects;

-- Create policies for storage.objects
create policy "Public Access to Avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Owners can upload avatars"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars' 
    and name = auth.uid()::text || '/profile.jpg'
  );

create policy "Owners can update avatars"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars' 
    and name = auth.uid()::text || '/profile.jpg'
  )
  with check (
    bucket_id = 'avatars' 
    and name = auth.uid()::text || '/profile.jpg'
  );

create policy "Owners can delete avatars"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars' 
    and name = auth.uid()::text || '/profile.jpg'
  );
