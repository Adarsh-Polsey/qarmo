-- 00009_beta_registration.sql
-- Beta Registration: partner_documents table, profiles updates, private storage bucket

-- ─── 1. Add new columns to profiles ────────────────────────────────────────────

alter table public.profiles
  add column if not exists plate_number text,
  add column if not exists referred_by  text;

-- ─── 2. partner_documents ───────────────────────────────────────────────────────

create table if not exists public.partner_documents (
  id            uuid primary key default gen_random_uuid(),
  partner_id    uuid not null references public.profiles(id) on delete cascade,
  doc_type      text not null check (doc_type in ('aadhaar', 'driving_licence')),
  storage_path  text not null,
  review_status text not null default 'pending'
                check (review_status in ('pending', 'verified', 'rejected')),
  uploaded_at   timestamptz not null default now(),
  unique (partner_id, doc_type)
);

-- Enable Row Level Security
alter table public.partner_documents enable row level security;

-- Partners may read/write only their own document rows
create policy "Partners can select their own documents"
  on public.partner_documents
  for select
  using (auth.uid() = partner_id);

create policy "Partners can insert their own documents"
  on public.partner_documents
  for insert
  to authenticated
  with check (auth.uid() = partner_id);

create policy "Partners can update their own documents"
  on public.partner_documents
  for update
  to authenticated
  using (auth.uid() = partner_id)
  with check (auth.uid() = partner_id);

create policy "Partners can delete their own documents"
  on public.partner_documents
  for delete
  to authenticated
  using (auth.uid() = partner_id);

-- ─── 3. Private partner-documents storage bucket ────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'partner-documents',
  'partner-documents',
  false,           -- private bucket — no public read
  10485760,        -- 10 MB limit per file
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Drop any stale policies to avoid conflicts
drop policy if exists "Partners can upload their own documents"  on storage.objects;
drop policy if exists "Partners can read their own documents"    on storage.objects;
drop policy if exists "Partners can update their own documents"  on storage.objects;
drop policy if exists "Partners can delete their own documents"  on storage.objects;

-- Only the owner may read their uploaded documents
create policy "Partners can read their own documents"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'partner-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Only the owner may upload into their own folder (uid/filename)
create policy "Partners can upload their own documents"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'partner-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Only the owner may replace their own files
create policy "Partners can update their own documents"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'partner-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'partner-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Only the owner may delete their own files
create policy "Partners can delete their own documents"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'partner-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─── 4. Security Definer RPC for Partner Counter ────────────────────────────────

create or replace function public.get_partner_count()
returns integer
security definer
set search_path = public
language plpgsql as $$
begin
  return (
    select count(*)::integer
    from public.profiles
    where account_type = 'partner'
       or 'auto_driver' = any(roles)
       or 'delivery_executive' = any(roles)
  );
end;
$$;
