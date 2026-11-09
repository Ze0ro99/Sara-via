-- SARA VIA initial Testnet data model
-- Apply in Supabase SQL editor. Keep service-role credentials server-side only.

create extension if not exists pgcrypto;

create table if not exists public.booking_intents (
  id uuid primary key default gen_random_uuid(),
  pi_uid text not null,
  category text not null check (category in ('flights','hotels','cruises','tours','transfer')),
  provider text not null,
  offer_reference text not null,
  offer_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'awaiting_provider_validation' check (status in ('awaiting_provider_validation','provider_validated','payment_pending','confirmed','cancelled','expired','failed')),
  payment_id text,
  txid text,
  provider_booking_reference text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists booking_intents_user_created_idx on public.booking_intents (pi_uid, created_at desc);
create index if not exists booking_intents_status_idx on public.booking_intents (status, created_at);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  pi_uid text not null,
  plan_id text not null,
  plan_version text not null,
  price_atomic text not null check (price_atomic ~ '^[0-9]+$'),
  currency text not null,
  billing_interval text not null check (billing_interval in ('monthly','yearly','one_time')),
  status text not null default 'pending_payment' check (status in ('pending_payment','active','past_due','cancelled','expired','refunded')),
  payment_id text,
  starts_at timestamptz,
  ends_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on public.subscriptions (pi_uid, created_at desc);

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  pi_uid text not null,
  carrier text not null,
  tracking_number text not null,
  status text not null default 'label_created',
  latest_event jsonb not null default '{}'::jsonb,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (carrier, tracking_number)
);

create table if not exists public.partner_profiles (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  partner_type text not null check (partner_type in ('airline','hotel','tour_operator','logistics','transfer','cruise')),
  contact_email text not null,
  status text not null default 'pending_review' check (status in ('pending_review','approved','suspended','rejected')),
  kyb_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.booking_intents enable row level security;
alter table public.subscriptions enable row level security;
alter table public.shipments enable row level security;
alter table public.partner_profiles enable row level security;

-- No anon/authenticated policies are intentionally created here. All access
-- currently goes through the backend service role after Pi UID verification.
