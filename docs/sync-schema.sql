-- Dugout Lab sync schema. Lives in the same free Supabase project as Athletic Lab
-- (organization "Flesher Family", project "athletic-lab") in its own tables; the Athletic Lab
-- `records` table is not touched.
--
-- Two secrets travel in request headers and are never stored, only hashed:
--   x-team-key    the team secret, made once on the head coach's phone, carried by every invite link
--   x-coach-token a per-coach token, made per invite; revoking it shuts off that one phone
-- A request can read or write a team's rows only when the team key matches AND the coach token
-- belongs to a member of that team who has not been revoked. The head coach is a member too, with
-- head = true; only a head member can add or revoke members. The server stamps every accepted
-- note with the member's name from the invite, so attribution cannot be changed from a phone.
create extension if not exists pgcrypto;

create or replace function public.dugout_team_id() returns text
language sql stable as $$
  select encode(extensions.digest(coalesce(current_setting('request.headers', true)::json->>'x-team-key', ''), 'sha256'), 'hex')
$$;

create or replace function public.dugout_token_hash() returns text
language sql stable as $$
  select encode(extensions.digest(coalesce(current_setting('request.headers', true)::json->>'x-coach-token', ''), 'sha256'), 'hex')
$$;

create or replace function public.dugout_has_key() returns boolean
language sql stable as $$
  select length(coalesce(current_setting('request.headers', true)::json->>'x-team-key', '')) >= 16
     and length(coalesce(current_setting('request.headers', true)::json->>'x-coach-token', '')) >= 16
$$;

create table if not exists public.dugout_members (
  team_id text not null,
  token_hash text not null,
  name text not null,
  role text,
  head boolean not null default false,
  revoked boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen timestamptz,
  primary key (team_id, token_hash)
);

create table if not exists public.dugout_records (
  team_id text not null,
  tbl text not null,
  id text not null,
  stamp text not null,
  data jsonb,
  deleted boolean not null default false,
  device text,
  coach text,
  server_ts timestamptz not null default now(),
  primary key (team_id, tbl, id)
);
create index if not exists dugout_records_team_ts on public.dugout_records (team_id, server_ts);

-- These read dugout_members as the table owner so the policies below never recurse.
create or replace function public.dugout_member_row() returns public.dugout_members
language sql stable security definer set search_path = public as $$
  select m.* from public.dugout_members m
  where m.team_id = public.dugout_team_id() and m.token_hash = public.dugout_token_hash()
  limit 1
$$;

create or replace function public.dugout_is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select public.dugout_has_key() and exists (
    select 1 from public.dugout_members m
    where m.team_id = public.dugout_team_id() and m.token_hash = public.dugout_token_hash() and not m.revoked)
$$;

create or replace function public.dugout_is_head() returns boolean
language sql stable security definer set search_path = public as $$
  select public.dugout_has_key() and exists (
    select 1 from public.dugout_members m
    where m.team_id = public.dugout_team_id() and m.token_hash = public.dugout_token_hash() and not m.revoked and m.head)
$$;

create or replace function public.dugout_team_is_new() returns boolean
language sql stable security definer set search_path = public as $$
  select public.dugout_has_key() and not exists (select 1 from public.dugout_members m where m.team_id = public.dugout_team_id())
$$;

alter table public.dugout_members enable row level security;
drop policy if exists "members read" on public.dugout_members;
create policy "members read" on public.dugout_members for select to anon
  using (team_id = public.dugout_team_id() and public.dugout_has_key());
-- The first member of a brand-new team is the head coach's own phone; after that only a head coach adds people.
drop policy if exists "members insert" on public.dugout_members;
create policy "members insert" on public.dugout_members for insert to anon
  with check (team_id = public.dugout_team_id() and (public.dugout_is_head() or (public.dugout_team_is_new() and head and token_hash = public.dugout_token_hash())));
drop policy if exists "members update" on public.dugout_members;
create policy "members update" on public.dugout_members for update to anon
  using (team_id = public.dugout_team_id() and public.dugout_is_head())
  with check (team_id = public.dugout_team_id() and public.dugout_is_head());

alter table public.dugout_records enable row level security;
drop policy if exists "team rows" on public.dugout_records;
create policy "team rows" on public.dugout_records for all to anon
  using (team_id = public.dugout_team_id() and public.dugout_is_member())
  with check (team_id = public.dugout_team_id() and public.dugout_is_member());

-- An older or identical copy never overwrites what is there (so a phone echoing back a row it
-- pulled is a no-op and keeps the original coach's name); the server stamps every accepted write
-- with its time and with the writing coach's invite name, and notes when that coach was last seen.
create or replace function public.dugout_records_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare m public.dugout_members;
begin
  if tg_op = 'UPDATE' and new.stamp <= old.stamp then
    return old;
  end if;
  m := public.dugout_member_row();
  new.coach := m.name;
  new.server_ts := now();
  update public.dugout_members set last_seen = now() where team_id = m.team_id and token_hash = m.token_hash;
  return new;
end $$;
drop trigger if exists dugout_records_guard on public.dugout_records;
create trigger dugout_records_guard before insert or update on public.dugout_records
  for each row execute function public.dugout_records_guard();

grant select, insert, update on public.dugout_members to anon;
grant select, insert, update on public.dugout_records to anon;
