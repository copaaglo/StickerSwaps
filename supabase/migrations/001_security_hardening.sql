-- ============================================================
-- 001_security_hardening.sql
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- Safe to re-run — all blocks check before acting.
-- ============================================================


-- ── HIGH #1: Precise GPS coordinates publicly readable ─────
-- Replace the too-broad "viewable by everyone" policy so that
-- unauthenticated callers can no longer query location_lat/lng.

drop policy if exists "Public profiles are viewable by everyone" on public.profiles;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'Authenticated users can view all profiles'
  ) then
    create policy "Authenticated users can view all profiles"
      on public.profiles for select
      to authenticated
      using (true);
  end if;
end $$;

-- Safe view for unauthenticated contexts (no coordinates)
create or replace view public.profiles_safe as
  select id, username, full_name, avatar_url, location_city, bio, created_at
  from public.profiles;

grant select on public.profiles_safe to anon, authenticated;


-- ── HIGH #2: Trade IDOR — proposer could self-accept ───────
-- Replace the single unrestricted update policy with two
-- narrow ones that enforce valid state transitions.

drop policy if exists "Trade parties can update their trades" on public.trades;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trades'
      and policyname = 'Receivers can respond to pending trades'
  ) then
    create policy "Receivers can respond to pending trades"
      on public.trades for update
      to authenticated
      using  (auth.uid() = receiver_id and status = 'pending')
      with check (status in ('accepted', 'rejected'));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trades'
      and policyname = 'Trade parties can complete accepted trades'
  ) then
    create policy "Trade parties can complete accepted trades"
      on public.trades for update
      to authenticated
      using  ((auth.uid() = proposer_id or auth.uid() = receiver_id) and status = 'accepted')
      with check (status = 'completed');
  end if;
end $$;


-- ── MEDIUM #3: DB-level field length constraints ────────────
-- Postgres has no ADD CONSTRAINT IF NOT EXISTS syntax.
-- Use DO blocks checking pg_constraint for idempotency.

-- First, clean any existing rows that would violate the new username constraints.
do $$
declare
  rec   record;
  clean text;
begin
  for rec in select id, username from public.profiles loop
    clean := lower(regexp_replace(rec.username, '[^a-zA-Z0-9_]', '', 'g'));
    clean := substring(clean from 1 for 20);
    if char_length(clean) < 3 then
      clean := 'user_' || substring(rec.id::text from 1 for 8);
    end if;
    if clean <> rec.username then
      if exists (select 1 from public.profiles where username = clean and id <> rec.id) then
        clean := substring(clean from 1 for 12) || '_' || substring(rec.id::text from 1 for 7);
      end if;
      update public.profiles set username = clean where id = rec.id;
    end if;
  end loop;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_length') then
    alter table public.profiles add constraint profiles_username_length
      check (char_length(username) between 3 and 20);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_format') then
    alter table public.profiles add constraint profiles_username_format
      check (username ~ '^[a-z0-9_]+$');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_full_name_length') then
    alter table public.profiles add constraint profiles_full_name_length
      check (full_name is null or char_length(full_name) <= 100);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_bio_length') then
    alter table public.profiles add constraint profiles_bio_length
      check (bio is null or char_length(bio) <= 500);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_location_city_length') then
    alter table public.profiles add constraint profiles_location_city_length
      check (location_city is null or char_length(location_city) <= 100);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trades_message_length') then
    alter table public.trades add constraint trades_message_length
      check (message is null or char_length(message) <= 500);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'messages_content_length') then
    alter table public.messages add constraint messages_content_length
      check (char_length(content) <= 1000);
  end if;
end $$;


-- ── MEDIUM #4: handle_new_user() accepts arbitrary metadata ─
-- Sanitize the username before inserting into profiles.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  raw_username  text;
  safe_username text;
begin
  raw_username := coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1)
  );

  -- Lowercase, strip non-alphanumeric/underscore, cap at 20 chars
  safe_username := lower(
    substring(regexp_replace(raw_username, '[^a-zA-Z0-9_]', '', 'g') from 1 for 20)
  );

  -- Fallback if too short after stripping
  if char_length(safe_username) < 3 then
    safe_username := 'user_' || substring(new.id::text from 1 for 8);
  end if;

  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    safe_username,
    substring(coalesce(new.raw_user_meta_data->>'full_name', '') from 1 for 100),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;
