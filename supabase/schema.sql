-- VahanSetu Freight — Supabase PostgreSQL Schema
-- Paste and run once in Supabase Dashboard -> SQL Editor

create table if not exists public.vs_users (
  id text primary key,
  name text not null,
  phone text,
  email text,
  role text not null,
  is_blocked boolean default false,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_vs_users_phone on public.vs_users (phone);
create index if not exists idx_vs_users_role on public.vs_users (role);

create table if not exists public.vs_vehicles (
  id text primary key,
  owner_id text not null,
  registration_number text not null,
  is_online boolean default false,
  is_available boolean default true,
  verification_status text default 'pending',
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_vs_vehicles_owner on public.vs_vehicles (owner_id);

create table if not exists public.vs_loads (
  id text primary key,
  customer_id text not null,
  status text not null,
  pickup_city text,
  delivery_city text,
  weight_kg numeric default 0,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_vs_loads_status on public.vs_loads (status);
create index if not exists idx_vs_loads_customer on public.vs_loads (customer_id);

create table if not exists public.vs_quotations (
  id text primary key,
  load_id text not null,
  transporter_id text not null,
  status text not null,
  quote_amount_inr numeric default 0,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_vs_quotations_load on public.vs_quotations (load_id);

create table if not exists public.vs_bookings (
  id text primary key,
  load_id text not null,
  customer_id text not null,
  transporter_id text not null,
  driver_id text,
  vehicle_id text,
  status text not null,
  total_agreed_amount_inr numeric default 0,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_vs_bookings_customer on public.vs_bookings (customer_id);
create index if not exists idx_vs_bookings_driver on public.vs_bookings (driver_id);

create table if not exists public.vs_trips (
  id text primary key,
  load_id text not null,
  assigned_vehicle_id text not null,
  assigned_driver_id text not null,
  status text not null,
  tracking_token text not null,
  latest_lat double precision,
  latest_lng double precision,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_vs_trips_load on public.vs_trips (load_id);

create table if not exists public.vs_location_pings (
  id bigserial primary key,
  trip_id text not null,
  lat double precision not null,
  lng double precision not null,
  speed numeric default 0,
  heading numeric default 0,
  battery_level numeric default 100,
  is_buffered boolean default false,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_vs_location_pings_trip_time
  on public.vs_location_pings (trip_id, recorded_at desc);

create table if not exists public.vs_support_tickets (
  id text primary key,
  user_id text not null,
  status text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security (backend connects securely with secret/service_role key)
alter table public.vs_users enable row level security;
alter table public.vs_vehicles enable row level security;
alter table public.vs_loads enable row level security;
alter table public.vs_quotations enable row level security;
alter table public.vs_bookings enable row level security;
alter table public.vs_trips enable row level security;
alter table public.vs_location_pings enable row level security;
alter table public.vs_support_tickets enable row level security;
