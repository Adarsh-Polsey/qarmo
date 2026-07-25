-- 00007_validate_referral_code.sql
-- Create validate_referral_code RPC function

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
