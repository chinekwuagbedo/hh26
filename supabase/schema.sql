create table if not exists public.tide_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tide_id text not null unique,
  display_name text not null,
  created_at timestamptz not null default now()
);

alter table public.tide_profiles enable row level security;

drop policy if exists tide_profiles_select_own on public.tide_profiles;
create policy tide_profiles_select_own
  on public.tide_profiles for select
  to authenticated
  using (user_id = (select auth.uid()));

grant select on public.tide_profiles to authenticated;

create or replace function public.claim_tide_profile(
  requested_tide_id text,
  requested_display_name text
)
returns table(tide_id text, display_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  existing_profile public.tide_profiles%rowtype;
  normalized_tide_id text := upper(btrim(requested_tide_id));
begin
  if actor_id is null then
    raise exception 'Sign in before linking a Tide ID.' using errcode = '42501';
  end if;

  if normalized_tide_id !~ '^TIDE-[A-Z0-9-]{4,24}$' then
    raise exception 'Enter a valid Tide ID.' using errcode = '22023';
  end if;

  select * into existing_profile
  from public.tide_profiles
  where user_id = actor_id;

  if found then
    if existing_profile.tide_id <> normalized_tide_id then
      raise exception 'This email is already linked to a different Tide ID.' using errcode = '23505';
    end if;
    return query select existing_profile.tide_id, existing_profile.display_name;
    return;
  end if;

  insert into public.tide_profiles(user_id, tide_id, display_name)
  values (actor_id, normalized_tide_id, left(btrim(requested_display_name), 80))
  returning * into existing_profile;

  return query select existing_profile.tide_id, existing_profile.display_name;
exception
  when unique_violation then
    raise exception 'This Tide ID is already linked to another email.' using errcode = '23505';
end;
$$;

revoke all on function public.claim_tide_profile(text, text) from public;
grant execute on function public.claim_tide_profile(text, text) to authenticated;

create table if not exists public.cycle_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  period boolean not null default false,
  symptoms text[] not null default '{}',
  feelings text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, log_date)
);

alter table public.cycle_logs enable row level security;

drop policy if exists cycle_logs_owner_all on public.cycle_logs;
create policy cycle_logs_owner_all
  on public.cycle_logs for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.cycle_logs to authenticated;

drop trigger if exists cycle_logs_updated_at on public.cycle_logs;
