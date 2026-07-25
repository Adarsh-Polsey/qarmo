-- 00003_referrals.sql
-- Create referrals table and referral_points view

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null references public.profiles(id) on delete cascade unique,
  code_used text not null,
  status text not null default 'pending' check (status in ('pending', 'awarded')),
  points_awarded int not null default 0 check (points_awarded in (0, 50)),
  awarded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint check_not_self_referral check (referrer_id <> referred_id)
);

-- Enable RLS
alter table public.referrals enable row level security;

-- Create RLS Policies
create policy "Users can select referrals they referred"
  on public.referrals
  for select
  using (auth.uid() = referrer_id);

-- Create referral_points view
create or replace view public.referral_points with (security_invoker = true) as
select
  referrer_id as user_id,
  coalesce(sum(points_awarded), 0)::int as total_points
from
  public.referrals
group by
  referrer_id;
