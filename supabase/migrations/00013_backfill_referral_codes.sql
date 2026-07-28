-- 00013_backfill_referral_codes.sql
--
-- Fixes partners/customers ending up with a NULL referral_code even though their
-- profile is completed ("Your code:" renders blank on the partner dashboard).
--
-- Root cause: the client's handlePartnerSubmit wrote profiles twice — a direct
-- "baseline" update that stamped profile_completed_at, followed by the
-- complete-profile edge function whose complete_profile() RPC is the only thing
-- that generates a referral_code. But complete_profile()'s idempotency guard
-- short-circuits the moment profile_completed_at is non-null and returned the
-- (still NULL) existing_code without ever generating one. The client ordering is
-- fixed separately; this migration hardens the RPC so the failure can't recur and
-- backfills everyone already affected.
--
-- Two parts:
--   1. Harden complete_profile() — when a profile is already completed but has no
--      code, backfill a unique one instead of returning NULL.
--   2. One-time backfill for existing completed-but-codeless rows.

begin;

-- ─── 1. Harden complete_profile() ──────────────────────────────────────────────
-- Identical to the 00010 definition except the idempotency guard now backfills a
-- code when one is missing rather than returning NULL.

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
    -- Already completed with a code → true idempotent no-op.
    if existing_code is not null and existing_code <> '' then
      return jsonb_build_object('success', true, 'referral_code', existing_code);
    end if;

    -- Already completed but WITHOUT a code (e.g. a baseline update stamped
    -- profile_completed_at before this RPC could generate one): backfill a unique
    -- code now instead of leaving the user permanently code-less.
    while not code_ok loop
      ref_code := '';
      for i in 1..6 loop
        ref_code := ref_code || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random() * 32 + 1)::int, 1);
      end loop;
      select not exists(select 1 from public.profiles p where p.referral_code = ref_code) into code_ok;
    end loop;

    update public.profiles set referral_code = ref_code where id = user_id;
    return jsonb_build_object('success', true, 'referral_code', ref_code);
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

-- ─── 2. One-time backfill for existing affected rows ───────────────────────────
-- Every profile that is completed but has no code gets a fresh unique one.

do $$
declare
  r record;
  ref_code text;
  code_ok boolean;
begin
  for r in
    select id from public.profiles
    where profile_completed_at is not null
      and (referral_code is null or referral_code = '')
  loop
    code_ok := false;
    while not code_ok loop
      ref_code := '';
      for i in 1..6 loop
        ref_code := ref_code || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random() * 32 + 1)::int, 1);
      end loop;
      select not exists(select 1 from public.profiles p where p.referral_code = ref_code) into code_ok;
    end loop;
    update public.profiles set referral_code = ref_code where id = r.id;
  end loop;
end $$;

commit;

-- ─── Verify after running ──────────────────────────────────────────────────────
-- select count(*) from public.profiles
--   where profile_completed_at is not null
--     and (referral_code is null or referral_code = '');
-- -- expected: 0
