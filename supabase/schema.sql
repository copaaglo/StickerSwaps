-- Enable PostGIS for geolocation queries
create extension if not exists "uuid-ossp";

-- =====================
-- PROFILES
-- =====================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  full_name text,
  avatar_url text,
  location_lat double precision,
  location_lng double precision,
  location_city text,
  bio text,
  created_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =====================
-- STICKERS CATALOG
-- =====================
create table public.stickers (
  id serial primary key,
  sticker_code varchar(10) not null,
  name varchar(255) not null,
  team varchar(100) not null,
  team_code varchar(5) not null,
  position integer not null,
  type varchar(20) not null,
  is_foil boolean not null default false,
  group_letter varchar(2) not null default ''
);

alter table public.stickers enable row level security;
create policy "Stickers are viewable by everyone" on public.stickers for select using (true);

-- =====================
-- USER STICKER COLLECTIONS
-- =====================
create table public.user_stickers (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  sticker_id integer references public.stickers(id) on delete cascade not null,
  quantity_have integer default 0 not null,
  quantity_duplicate integer default 0 not null,
  wants boolean default false not null,
  created_at timestamptz default now() not null,
  unique(user_id, sticker_id)
);

alter table public.user_stickers enable row level security;

create policy "User stickers viewable by everyone"
  on public.user_stickers for select using (true);

create policy "Users manage their own stickers"
  on public.user_stickers for all using (auth.uid() = user_id);

-- =====================
-- TRADES
-- =====================
create table public.trades (
  id uuid default uuid_generate_v4() primary key,
  proposer_id uuid references public.profiles(id) on delete cascade not null,
  receiver_id uuid references public.profiles(id) on delete cascade not null,
  status text default 'pending' not null check (status in ('pending','accepted','rejected','completed','cancelled')),
  message text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.trades enable row level security;

create policy "Trade parties can view their trades"
  on public.trades for select
  using (auth.uid() = proposer_id or auth.uid() = receiver_id);

create policy "Authenticated users can create trades"
  on public.trades for insert
  with check (auth.uid() = proposer_id);

create policy "Trade parties can update their trades"
  on public.trades for update
  using (auth.uid() = proposer_id or auth.uid() = receiver_id);

create table public.trade_stickers (
  id uuid default uuid_generate_v4() primary key,
  trade_id uuid references public.trades(id) on delete cascade not null,
  sticker_id integer references public.stickers(id) not null,
  direction text not null check (direction in ('giving', 'receiving'))
);

alter table public.trade_stickers enable row level security;

create policy "Trade stickers viewable by trade parties"
  on public.trade_stickers for select
  using (
    exists (
      select 1 from public.trades
      where id = trade_id
      and (proposer_id = auth.uid() or receiver_id = auth.uid())
    )
  );

create policy "Trade proposer can insert trade stickers"
  on public.trade_stickers for insert
  with check (
    exists (
      select 1 from public.trades
      where id = trade_id and proposer_id = auth.uid()
    )
  );

-- =====================
-- MESSAGES
-- =====================
create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  receiver_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  trade_id uuid references public.trades(id) on delete set null,
  read boolean default false not null,
  created_at timestamptz default now() not null
);

alter table public.messages enable row level security;

create policy "Message parties can view their messages"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Authenticated users can send messages"
  on public.messages for insert
  with check (auth.uid() = sender_id);

create policy "Receivers can mark messages as read"
  on public.messages for update
  using (auth.uid() = receiver_id);

-- =====================
-- COMMUNITY POSTS
-- =====================
create table public.posts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  tags text[] not null default '{}',
  content text not null check (char_length(content) <= 300),
  created_at timestamptz default now() not null
);

alter table public.posts enable row level security;

create policy "Posts are viewable by everyone"
  on public.posts for select using (true);

create policy "Authenticated users can create posts"
  on public.posts for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own posts"
  on public.posts for delete using (auth.uid() = user_id);

-- =====================
-- REALTIME
-- =====================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.trades;
alter publication supabase_realtime add table public.posts;
