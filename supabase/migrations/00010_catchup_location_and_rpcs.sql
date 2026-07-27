-- 00010_catchup_location_and_rpcs.sql
--
-- Catch-up migration: the live project (ljldyssqgkywlsivtvpu) was checked directly via
-- the PostgREST API on 2026-07-27 and found to be missing several pieces that migrations
-- 00007/00008/00009 already define in this repo:
--
--   - profiles.last_location          (missing — confirmed via 42703 "column does not exist")
--   - profiles.location_updated_at    (missing — same)
--   - public.partners_in_bounds(...)  (missing — confirmed via PGRST202 "not found")
--   - public.complete_profile(...)    (missing — same)
--   - public.validate_referral_code(...) (missing — same)
--   - public.get_partner_count()      (missing — same)
--
-- profiles.account_type / partner_type / plate_number / referred_by already exist live,
-- so this file deliberately does NOT touch those columns or re-run the 00008 backfill
-- UPDATE — see the commented-out section at the bottom if that backfill turns out to
-- still be needed.
--
-- Safe to run more than once: every statement is create-if-missing / create-or-replace.

begin;

-- ─── 1. PostGIS + location columns (from 00008) ────────────────────────────────

create extension if not exists postgis;

alter table public.profiles
  add column if not exists last_location geography(Point),
  add column if not exists location_updated_at timestamptz;

create index if not exists profiles_last_location_idx
  on public.profiles
  using gist (last_location);

-- ─── 2. partners_in_bounds (from 00008) ────────────────────────────────────────

create or replace function public.partners_in_bounds(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision
)
returns table (
  id uuid,
  partner_type text,
  lng double precision,
  lat double precision
)
security definer
set search_path = public
language plpgsql as $$
begin
  return query
  select
    p.id,
    p.partner_type,
    st_x(p.last_location::geometry) as lng,
    st_y(p.last_location::geometry) as lat
  from public.profiles p
  where p.account_type = 'partner'
    and p.last_location is not null
    and p.last_location && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  order by p.last_location <-> st_centroid(st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326))
  limit 100;
end;
$$;

-- ─── 3. validate_referral_code (from 00007) ────────────────────────────────────

create or replace function public.validate_referral_code(code text)
returns boolean
security definer
set search_path = public
language plpgsql as $$
begin
  return exists(
    select 1 from public.profiles
    where referral_code = code
      and profile_completed_at is not null
  );
end;
$$;

-- ─── 4. complete_profile (final 00008 version — supersedes 00005's) ───────────

create or replace function public.complete_profile(
  user_id uuid,
  full_name text,
  photo_url text,
  roles text[],
  city text,
  vehicles jsonb,
  referral_code text
)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
declare
  ref_code text;
  code_ok boolean := false;
  already_completed timestamptz;
  existing_code text;
  referrer_id uuid := null;
  referral_row_id uuid := null;
  referrer_push_tokens text[];
  new_account_type text := 'customer';
  new_partner_type text := null;
begin
  -- 1. Check if already completed
  select profile_completed_at, referral_code
  into already_completed, existing_code
  from public.profiles
  where id = user_id;

  if already_completed is not null then
    return jsonb_build_object('success', true, 'referral_code', existing_code);
  end if;

  -- 2. Validate referral code if provided
  if referral_code is not null and referral_code != '' then
    select id into referrer_id
    from public.profiles
    where public.profiles.referral_code = upper(trim(complete_profile.referral_code))
      and profile_completed_at is not null;

    if referrer_id is null then
      return jsonb_build_object('success', false, 'error', 'Invalid referral code');
    end if;

    if referrer_id = user_id then
      return jsonb_build_object('success', false, 'error', 'You cannot use your own referral code');
    end if;

    if exists(select 1 from public.referrals where referred_id = user_id) then
      return jsonb_build_object('success', false, 'error', 'You have already been referred');
    end if;
  end if;

  -- 3. Generate unique referral code for user
  while not code_ok loop
    ref_code := '';
    for i in 1..6 loop
      ref_code := ref_code || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random() * 32 + 1)::int, 1);
    end loop;

    select not exists(select 1 from public.profiles p where p.referral_code = ref_code) into code_ok;
  end loop;

  -- 4. Insert referral row (pending)
  if referrer_id is not null then
    insert into public.referrals (
      referrer_id,
      referred_id,
      code_used,
      status,
      points_awarded,
      created_at
    ) values (
      referrer_id,
      user_id,
      upper(trim(referral_code)),
      'pending',
      0,
      now()
    ) returning id into referral_row_id;
  end if;

  -- 5. Clear existing vehicles
  delete from public.vehicles where owner_id = user_id;

  -- 6. Insert new vehicles
  if jsonb_typeof(vehicles) = 'array' then
    insert into public.vehicles (owner_id, role, vehicle_type, registration_number)
    select
      user_id,
      (val->>'role')::text,
      (val->>'vehicle_type')::text,
      (val->>'registration_number')::text
    from jsonb_array_elements(vehicles) as val;
  end if;

  -- Derive account_type and partner_type
  if 'auto_driver' = any(roles) or 'delivery_executive' = any(roles) then
    new_account_type := 'partner';
  end if;
  if 'auto_driver' = any(roles) then
    new_partner_type := 'ride';
  elsif 'delivery_executive' = any(roles) then
    new_partner_type := 'delivery';
  end if;

  -- 7. Update profile
  update public.profiles
  set
    full_name = complete_profile.full_name,
    photo_url = complete_profile.photo_url,
    roles = complete_profile.roles,
    city = complete_profile.city,
    referral_code = ref_code,
    profile_completed_at = now(),
    account_type = new_account_type,
    partner_type = new_partner_type
  where id = user_id;

  -- 8. Flip referral status to 'awarded'
  if referral_row_id is not null then
    update public.referrals
    set
      status = 'awarded',
      points_awarded = 50,
      awarded_at = now()
    where id = referral_row_id;
  end if;

  -- 9. Fetch referrer's push tokens
  if referrer_id is not null then
    select array_agg(expo_token) into referrer_push_tokens
    from public.push_tokens
    where public.push_tokens.user_id = referrer_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'referral_code', ref_code,
    'referrer_id', referrer_id,
    'referrer_push_tokens', coalesce(to_jsonb(referrer_push_tokens), '[]'::jsonb)
  );
end;
$$;

-- ─── 5. get_partner_count (from 00009) ─────────────────────────────────────────

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

-- ─── 6. Explicit grants ─────────────────────────────────────────────────────────
-- None of the source migrations had explicit grants — PostgREST calls to a
-- newly-created function typically work off Postgres's default PUBLIC execute
-- grant, but that default can be revoked at the project level. Granting explicitly
-- removes the ambiguity rather than relying on whatever the project's current
-- default privileges happen to be.
--
-- complete_profile is deliberately excluded from the anon/authenticated grants
-- below, and its default PUBLIC execute grant is explicitly revoked instead: it
-- takes a client-suppliable `user_id` with no check that it matches auth.uid(), so
-- any direct caller (not just the complete-profile edge function) could complete or
-- corrupt an arbitrary OTHER user's profile and manipulate referral awarding. The
-- only legitimate caller is supabase/functions/complete-profile, which uses the
-- service_role key — service_role already has execute independent of these grants,
-- so this revoke has no effect on the app's actual functionality.

grant execute on function public.partners_in_bounds(double precision, double precision, double precision, double precision) to anon, authenticated;
grant execute on function public.validate_referral_code(text) to anon, authenticated;
grant execute on function public.get_partner_count() to anon, authenticated;
revoke execute on function public.complete_profile(uuid, text, text, text[], text, jsonb, text) from public;

commit;

-- ─── Verify after running ──────────────────────────────────────────────────────
-- select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'profiles'
--     and column_name in ('last_location', 'location_updated_at');
--
-- select routine_name from information_schema.routines
--   where routine_schema = 'public'
--     and routine_name in ('partners_in_bounds', 'validate_referral_code', 'complete_profile', 'get_partner_count');

-- ─── NOT included: the 00008 account_type/partner_type backfill ───────────────
-- 00008 also backfills account_type/partner_type from the `roles` array for
-- pre-existing rows:
--
--   update public.profiles
--   set
--     account_type = case when 'auto_driver' = any(roles) or 'delivery_executive' = any(roles)
--                     then 'partner' else 'customer' end,
--     partner_type = case when 'auto_driver' = any(roles) then 'ride'
--                     when 'delivery_executive' = any(roles) then 'delivery' else null end;
--
-- Deliberately left out here: those columns already exist and are presumably
-- already populated for rows created through the app's own direct-update fallback
-- path, which sets account_type/partner_type directly (not via `roles`). Running
-- this blindly against ALL rows could overwrite already-correct values for anyone
-- whose `roles` array doesn't happen to match their real account_type. Only run
-- this — and only scoped with a WHERE guard (e.g. `where account_type is null`) —
-- after checking how many existing rows actually need it:
--
--   select count(*) from public.profiles where account_type is null;
