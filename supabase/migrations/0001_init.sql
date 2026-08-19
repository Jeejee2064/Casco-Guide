-- ═══════════════════════════════════════════════════════════════
-- Panama City Guide — Phase 1 (Casco Viejo)
-- Initial schema: spots, events, categories
-- ═══════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ─── Enums ────────────────────────────────────────────────────

do $$ begin
  create type spot_category as enum (
    'restaurant', 'bar', 'cafe', 'attraction', 'museum', 'shop', 'gallery', 'hotel'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_category as enum (
    'music', 'food', 'art', 'cultural', 'party', 'festival', 'tour', 'walking-tour'
  );
exception when duplicate_object then null; end $$;

do $enum$ begin
  create type price_range as enum ('$', '$$', '$$$', '$$$$');
exception when duplicate_object then null; end $enum$;

do $$ begin
  create type parking_type as enum ('street', 'paid-lot', 'none');
exception when duplicate_object then null; end $$;

do $$ begin
  create type recurrence_type as enum ('once', 'daily', 'weekly', 'monthly');
exception when duplicate_object then null; end $$;

-- ─── Helper: updated_at trigger ──────────────────────────────

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ─── Casco Viejo bounding box (sanity check for coords) ───────
-- Roughly: lat 8.949–8.968, lng -79.545 to -79.523
-- Kept generous to tolerate real-world GPS noise; enforced as a
-- soft check (warning), not a hard constraint, so future
-- neighborhoods can reuse this schema in Phase 2+.

-- ─── Categories ───────────────────────────────────────────────

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  icon text,
  color text,
  emoji text,
  description text,
  created_at timestamptz not null default now()
);

-- ─── Spots ────────────────────────────────────────────────────

create table if not exists spots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  article text,
  category spot_category not null,

  -- location
  latitude double precision not null,
  longitude double precision not null,
  address text,
  neighborhood text default 'Casco Viejo',
  phone text,
  website text,
  email text,

  -- hours: [{ "open": "HH:MM", "close": "HH:MM" }, ...] or null if closed
  hours_monday jsonb,
  hours_tuesday jsonb,
  hours_wednesday jsonb,
  hours_thursday jsonb,
  hours_friday jsonb,
  hours_saturday jsonb,
  hours_sunday jsonb,
  hours_note text,

  -- details
  price_range price_range,
  cuisine_type text,
  dietary_options text[] default '{}',
  reservation_required boolean default false,
  accepts_cards boolean default true,
  parking parking_type,

  -- media
  photos jsonb default '[]',
  featured_photo text,

  -- metadata
  tags text[] default '{}',
  rating numeric(2,1) check (rating >= 0 and rating <= 5),
  review_count integer default 0,
  is_featured boolean not null default false,
  is_verified boolean not null default false,

  -- timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_verified timestamptz,

  constraint spots_latitude_range check (latitude between -90 and 90),
  constraint spots_longitude_range check (longitude between -180 and 180)
);

create index if not exists idx_spots_category on spots (category);
create index if not exists idx_spots_is_featured on spots (is_featured);
create index if not exists idx_spots_price_range on spots (price_range);
create index if not exists idx_spots_tags on spots using gin (tags);
create index if not exists idx_spots_dietary_options on spots using gin (dietary_options);
create index if not exists idx_spots_search on spots using gin (
  to_tsvector('spanish', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(article, '') || ' ' || coalesce(cuisine_type, ''))
);

drop trigger if exists trg_spots_updated_at on spots;
create trigger trg_spots_updated_at
  before update on spots
  for each row execute function set_updated_at();

-- ─── Events ───────────────────────────────────────────────────

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  article text,
  category event_category not null,

  -- timing
  date date not null,
  time_start time not null,
  time_end time,
  recurring recurrence_type default 'once',
  recurring_until date,

  -- location
  latitude double precision not null,
  longitude double precision not null,
  address text,
  spot_id uuid references spots (id) on delete set null,

  -- details
  capacity integer,
  price numeric(10,2),
  booking_url text,
  organizer text,
  organizer_contact text,

  -- media
  photo text,
  photos jsonb default '[]',

  -- metadata
  tags text[] default '{}',
  is_featured boolean not null default false,
  is_verified boolean not null default false,

  -- timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_verified timestamptz,

  constraint events_latitude_range check (latitude between -90 and 90),
  constraint events_longitude_range check (longitude between -180 and 180)
);

create index if not exists idx_events_category on events (category);
create index if not exists idx_events_date on events (date);
create index if not exists idx_events_spot_id on events (spot_id);
create index if not exists idx_events_tags on events using gin (tags);

drop trigger if exists trg_events_updated_at on events;
create trigger trg_events_updated_at
  before update on events
  for each row execute function set_updated_at();

-- ─── Seed categories (safe to re-run) ────────────────────────

insert into categories (name, slug, icon, color, emoji, description) values
  ('Restaurant', 'restaurant', 'utensils',    '#FF6B35', '🍽️', 'Places to eat'),
  ('Bar',        'bar',        'martini',     '#EC4899', '🍹', 'Bars & nightlife'),
  ('Café',       'cafe',       'coffee',      '#0EA5E9', '☕', 'Coffee shops & cafés'),
  ('Attraction', 'attraction', 'landmark',    '#10B981', '🏛️', 'Sights & attractions'),
  ('Museum',     'museum',     'building-2',  '#8B5CF6', '🖼️', 'Museums'),
  ('Shop',       'shop',       'shopping-bag','#F59E0B', '🛍️', 'Shops & boutiques'),
  ('Gallery',    'gallery',    'palette',     '#EF4444', '🎨', 'Art galleries'),
  ('Hotel',      'hotel',      'bed',         '#14B8A6', '🏨', 'Hotels & stays')
on conflict (slug) do nothing;

-- ─── Table grants ─────────────────────────────────────────────
-- RLS policies only restrict rows; the roles still need the base
-- GRANTs that the Supabase dashboard normally adds automatically.

grant usage on schema public to anon, authenticated;

grant select on categories, spots, events to anon, authenticated;
grant insert, update, delete on spots, events, categories to authenticated;

-- ─── Row Level Security ───────────────────────────────────────
-- Public (anon) can read everything. Writes require an
-- authenticated user (the admin, via Supabase Auth).

alter table categories enable row level security;
alter table spots enable row level security;
alter table events enable row level security;

drop policy if exists "Public read categories" on categories;
create policy "Public read categories" on categories for select using (true);

drop policy if exists "Public read spots" on spots;
create policy "Public read spots" on spots for select using (true);

drop policy if exists "Public read events" on events;
create policy "Public read events" on events for select using (true);

drop policy if exists "Authenticated write spots" on spots;
create policy "Authenticated write spots" on spots
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated write events" on events;
create policy "Authenticated write events" on events
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated write categories" on categories;
create policy "Authenticated write categories" on categories
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ─── Storage bucket for photos ───────────────────────────────

insert into storage.buckets (id, name, public)
values ('spot-photos', 'spot-photos', true)
on conflict (id) do nothing;

drop policy if exists "Public read spot photos" on storage.objects;
create policy "Public read spot photos" on storage.objects
  for select using (bucket_id = 'spot-photos');

drop policy if exists "Authenticated upload spot photos" on storage.objects;
create policy "Authenticated upload spot photos" on storage.objects
  for insert with check (bucket_id = 'spot-photos' and auth.role() = 'authenticated');

drop policy if exists "Authenticated update spot photos" on storage.objects;
create policy "Authenticated update spot photos" on storage.objects
  for update using (bucket_id = 'spot-photos' and auth.role() = 'authenticated');

drop policy if exists "Authenticated delete spot photos" on storage.objects;
create policy "Authenticated delete spot photos" on storage.objects
  for delete using (bucket_id = 'spot-photos' and auth.role() = 'authenticated');
