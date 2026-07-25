-- 00005_complete_profile_rpc.sql
-- Create database function for atomic profile completion

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
begin
  -- 1. Check if already completed (idempotency check)
  select profile_completed_at, referral_code 
  into already_completed, existing_code
  from public.profiles 
  where id = user_id;
  
  if already_completed is not null then
    return jsonb_build_object('success', true, 'referral_code', existing_code);
  end if;

  -- 2. Validate referral code if provided
  if referral_code is not null and referral_code != '' then
    -- Find referrer ID
    select id into referrer_id 
    from public.profiles 
    where referral_code = upper(trim(referral_code))
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
    
    -- Check uniqueness in profiles table
    select not exists(select 1 from public.profiles where referral_code = ref_code) into code_ok;
  end loop;

  -- 4. Insert referral row (if code used) in pending status first (H2)
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
  insert into public.vehicles (owner_id, role, vehicle_type, registration_number)
  select 
    user_id,
    (val->>'role')::text,
    (val->>'vehicle_type')::text,
    (val->>'registration_number')::text
  from jsonb_array_elements(vehicles) as val;

  -- 7. Update profile
  update public.profiles
  set 
    full_name = complete_profile.full_name,
    photo_url = complete_profile.photo_url,
    roles = complete_profile.roles,
    city = complete_profile.city,
    referral_code = ref_code,
    profile_completed_at = now()
  where id = user_id;

  -- 8. Flip referral status to 'awarded' and award points (H2)
  if referral_row_id is not null then
    update public.referrals
    set 
      status = 'awarded',
      points_awarded = 50,
      awarded_at = now()
    where id = referral_row_id;
  end if;

  -- 9. Fetch referrer's push tokens to return for Deno edge function notification (H3)
  if referrer_id is not null then
    select array_agg(expo_token) into referrer_push_tokens
    from public.push_tokens
    where user_id = referrer_id;
  end if;

  -- Return success, code, and referrer details for notification
  return jsonb_build_object(
    'success', true, 
    'referral_code', ref_code,
    'referrer_id', referrer_id,
    'referrer_push_tokens', coalesce(to_jsonb(referrer_push_tokens), '[]'::jsonb)
  );
end;
$$;
