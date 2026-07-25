-- 00008_beta2_location.sql

-- Enable PostGIS if not already enabled
create extension if not exists postgis;

-- Add new columns to profiles
alter table public.profiles
  add column if not exists account_type text not null default 'customer',
  add column if not exists partner_type text,
  add column if not exists last_location geography(Point),
  add column if not exists location_updated_at timestamptz;

-- Update existing profiles from roles array (backfill)
update public.profiles
set 
  account_type = case
    when 'auto_driver' = any(roles) or 'delivery_executive' = any(roles) then 'partner'
    else 'customer'
  end,
  partner_type = case
    when 'auto_driver' = any(roles) then 'ride'
    when 'delivery_executive' = any(roles) then 'delivery'
    else null
  end;

-- Create GiST index on location for fast bounding box queries
create index if not exists profiles_last_location_idx
  on public.profiles
  using gist (last_location);

-- Function to get partners within map bounding box
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

-- Replace complete_profile to write account_type and partner_type
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
