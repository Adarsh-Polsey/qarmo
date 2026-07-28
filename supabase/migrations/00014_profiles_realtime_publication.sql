-- 00014_profiles_realtime_publication.sql
--
-- GlobalCounter (apps/partner/src/components/GlobalCounter.tsx) subscribes to
-- postgres_changes INSERT/UPDATE events on public.profiles to tick the "partners
-- onboarded" counter up live (spec: Beta Release 2, B2-23). Supabase Realtime only
-- emits postgres_changes for tables that are members of the `supabase_realtime`
-- publication — by default a fresh project's publication has no tables in it, so
-- without this the client subscribes successfully but never receives an event.
--
-- Safe to run more than once: guarded by a membership check since
-- `alter publication ... add table` errors if the table is already a member.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end;
$$;
