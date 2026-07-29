-- 00015_fix_complete_profile_ambiguous_referral_code.sql
--
-- Fixes complete_profile() throwing on its very first statement:
--   "column reference \"referral_code\" is ambiguous"
--
-- Root cause: the function takes a parameter named `referral_code`, and
-- public.profiles also has a `referral_code` column. The idempotency-check
-- SELECT below referenced `referral_code` unqualified, so PL/pgSQL (default
-- variable_conflict = error) could not tell the parameter from the column and
-- aborted the whole function — on EVERY call, before any work was done.
--
-- Effect of the bug: the complete-profile edge function always failed, the
-- client's baseline profiles update still stamped profile_completed_at, and no
-- referral_code was ever generated for new signups (partner dashboard "Your
-- code:" blank). This was present in 00005/00010/00013; 00013 backfilled
-- existing rows but left the ambiguous SELECT in place, so new signups kept
-- failing.
--
-- Fix: qualify every `referral_code` that appears alongside a table so it
-- unambiguously means the column (public.profiles.referral_code) or the
-- parameter (complete_profile.referral_code). Function body is otherwise
-- identical to 00013's hardened definition.
--
-- Two parts:
--   1. Redefine complete_profile() with the qualified references.
--   2. Re-run the one-time backfill to catch rows completed (code-less) after
--      00013's backfill but before this fix landed.

begin;

-- ─── 1. Redefine complete_profile() with unambiguous references ─────────────────

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
  -- `public.profiles.referral_code` is qualified so it can't collide with the
  -- `referral_code` parameter — this bare reference was the ambiguity bug.
  select profile_completed_at, public.profiles.referral_code
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
      upper(trim(complete_profile.referral_code)),
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

-- ─── 2. Re-run one-time backfill for rows affected after 00013 ──────────────────
-- Any profile completed (code-less) between 00013's backfill and this fix.

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
