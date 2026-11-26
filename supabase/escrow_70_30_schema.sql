-- ==============================================================================
-- Zuggi Freight Marketplace — 70% Loading Advance + 30% POD Balance Escrow Engine
-- Supabase PostgreSQL Schema with Strict Row Level Security (RLS)
-- Run in Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. Custom Enum Types (idempotent creation)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'fleet_kyc_status_enum') then
    create type public.fleet_kyc_status_enum as enum ('PENDING', 'VERIFIED', 'REJECTED');
  end if;

  if not exists (select 1 from pg_type where typname = 'escrow_state_enum') then
    create type public.escrow_state_enum as enum (
      'AWAITING_PAYMENT',
      'FUNDED_LOCKED',
      'ADVANCE_70_RELEASED',
      'DISPUTE_HOLD',
      'FULLY_SETTLED',
      'REFUNDED'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'escrow_tranche_type_enum') then
    create type public.escrow_tranche_type_enum as enum ('ADVANCE_70', 'BALANCE_30');
  end if;

  if not exists (select 1 from pg_type where typname = 'escrow_tranche_status_enum') then
    create type public.escrow_tranche_status_enum as enum (
      'LOCKED',
      'QUEUED_FOR_RELEASE',
      'PROCESSING',
      'SETTLED',
      'FAILED'
    );
  end if;
end $$;

-- 2. Base trips reference table (if not already provisioned in this schema)
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  external_booking_id text unique,
  shipper_id uuid references auth.users (id) on delete set null,
  status text not null default 'ASSIGNED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Fleet Vendors Table (mapped 1:1 to Cashfree Easy Split Vendor ID)
create table if not exists public.fleet_vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  external_user_id text unique,
  cashfree_vendor_id text unique not null,
  kyc_status public.fleet_kyc_status_enum not null default 'PENDING',
  bank_account_last4 text,
  upi_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_fleet_vendors_user_id on public.fleet_vendors (user_id);
create index if not exists idx_fleet_vendors_kyc_status on public.fleet_vendors (kyc_status);

-- 4. Trip Escrow Ledger Table (Authoritative 70/30 Escrow Accounting)
create table if not exists public.trip_escrow_ledger (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid unique not null references public.trips (id) on delete restrict,
  external_trip_id text unique,
  shipper_id uuid references auth.users (id) on delete restrict,
  external_shipper_id text,
  vendor_id uuid not null references public.fleet_vendors (id) on delete restrict,
  cashfree_order_id text unique,
  cf_payment_id text,
  total_freight_inr numeric(12, 2) not null check (total_freight_inr > 0),
  platform_fee_inr numeric(12, 2) not null check (platform_fee_inr >= 0),
  net_vendor_payable_inr numeric(12, 2) not null check (net_vendor_payable_inr >= 0),
  advance_70_amount numeric(12, 2) not null check (advance_70_amount >= 0),
  balance_30_amount numeric(12, 2) not null check (balance_30_amount >= 0),
  escrow_state public.escrow_state_enum not null default 'AWAITING_PAYMENT',
  dispute_reason text,
  dispute_raised_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_escrow_net_sum check (
    round(advance_70_amount + balance_30_amount, 2) = round(net_vendor_payable_inr, 2)
  ),
  constraint chk_escrow_gross_sum check (
    round(platform_fee_inr + net_vendor_payable_inr, 2) = round(total_freight_inr, 2)
  )
);

create index if not exists idx_trip_escrow_ledger_shipper on public.trip_escrow_ledger (shipper_id);
create index if not exists idx_trip_escrow_ledger_vendor on public.trip_escrow_ledger (vendor_id);
create index if not exists idx_trip_escrow_ledger_state on public.trip_escrow_ledger (escrow_state);
create index if not exists idx_trip_escrow_ledger_order on public.trip_escrow_ledger (cashfree_order_id);

-- 5. Escrow Payout Tranches Table (Idempotent 70% Loading & 30% POD Releases)
create table if not exists public.escrow_payout_tranches (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.trip_escrow_ledger (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete restrict,
  tranche_type public.escrow_tranche_type_enum not null,
  amount_inr numeric(12, 2) not null check (amount_inr >= 0),
  idempotency_key text unique not null,
  cashfree_split_ref_id text,
  status public.escrow_tranche_status_enum not null default 'LOCKED',
  scheduled_release_at timestamptz,
  released_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_ledger_tranche_type unique (ledger_id, tranche_type)
);

create index if not exists idx_escrow_tranches_trip on public.escrow_payout_tranches (trip_id);
create index if not exists idx_escrow_tranches_status_sched
  on public.escrow_payout_tranches (status, scheduled_release_at)
  where status = 'QUEUED_FOR_RELEASE';

-- 6. Automatic updated_at Trigger
create or replace function public.set_escrow_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_fleet_vendors_updated_at on public.fleet_vendors;
create trigger trg_fleet_vendors_updated_at
  before update on public.fleet_vendors
  for each row execute function public.set_escrow_updated_at();

drop trigger if exists trg_trip_escrow_ledger_updated_at on public.trip_escrow_ledger;
create trigger trg_trip_escrow_ledger_updated_at
  before update on public.trip_escrow_ledger
  for each row execute function public.set_escrow_updated_at();

drop trigger if exists trg_escrow_payout_tranches_updated_at on public.escrow_payout_tranches;
create trigger trg_escrow_payout_tranches_updated_at
  before update on public.escrow_payout_tranches
  for each row execute function public.set_escrow_updated_at();

-- ==============================================================================
-- 7. Strict Row Level Security (RLS)
-- Backend service_role bypasses RLS for authoritative ledger mutations;
-- authenticated client reads are strictly scoped to own shipper / vendor rows.
-- ==============================================================================
alter table public.trips enable row level security;
alter table public.fleet_vendors enable row level security;
alter table public.trip_escrow_ledger enable row level security;
alter table public.escrow_payout_tranches enable row level security;

-- fleet_vendors policies: fleet owner can view only their own vendor record (all writes server-side only)
drop policy if exists "fleet_vendors_select_own" on public.fleet_vendors;
create policy "fleet_vendors_select_own"
  on public.fleet_vendors
  for select
  to authenticated
  using (user_id = auth.uid());

-- trip_escrow_ledger policies: shipper or assigned fleet vendor can read only their own trip ledger
drop policy if exists "trip_escrow_ledger_select_participant" on public.trip_escrow_ledger;
create policy "trip_escrow_ledger_select_participant"
  on public.trip_escrow_ledger
  for select
  to authenticated
  using (
    shipper_id = auth.uid()
    or exists (
      select 1
      from public.fleet_vendors fv
      where fv.id = trip_escrow_ledger.vendor_id
        and fv.user_id = auth.uid()
    )
  );

-- escrow_payout_tranches policies: visible only to the trip's shipper or assigned fleet vendor
drop policy if exists "escrow_tranches_select_participant" on public.escrow_payout_tranches;
create policy "escrow_tranches_select_participant"
  on public.escrow_payout_tranches
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.trip_escrow_ledger tel
      left join public.fleet_vendors fv on fv.id = tel.vendor_id
      where tel.id = escrow_payout_tranches.ledger_id
        and (tel.shipper_id = auth.uid() or fv.user_id = auth.uid())
    )
  );

-- Explicitly deny direct client INSERT/UPDATE/DELETE on all financial ledger tables
-- (No permissive write policies exist for anon/authenticated; only server service_role writes.)
