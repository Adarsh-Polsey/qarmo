-- 00011_partner_documents_storage_policies.sql
--
-- The live project (ljldyssqgkywlsivtvpu) was checked directly via `supabase db query
-- --linked` on 2026-07-27: the `partner-documents` bucket exists and the
-- public.partner_documents table has its RLS policies, but the storage.objects RLS
-- policies for this bucket (defined in 00009_beta_registration.sql, section 3) were
-- never applied. RLS is enabled on storage.objects project-wide, so zero policies
-- means every read/write to this bucket is silently denied for every role — every
-- Aadhaar/Driving Licence upload has been failing.
--
-- This re-applies exactly the storage.objects policies from 00009 — nothing else.
-- Safe to run more than once (drops before recreating, same as the source migration).

begin;

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

commit;

-- ─── Verify after running ──────────────────────────────────────────────────────
-- select policyname, cmd, roles from pg_policies
--   where schemaname = 'storage' and tablename = 'objects'
--     and policyname ilike '%documents%';
-- -- should return 4 rows (select/insert/update/delete)
