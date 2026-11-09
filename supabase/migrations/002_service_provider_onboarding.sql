-- SARA VIA service provider onboarding (Testnet)
-- Apply after 001_initial_testnet_schema.sql.
-- Never store provider API keys, webhook secrets, wallet seeds or passwords here.

create table if not exists public.service_provider_applications (
  id uuid primary key default gen_random_uuid(),
  pi_uid text not null,
  legal_name text not null,
  service_type text not null check (service_type in ('airline','hotel','cruise','tour_operator','transfer','logistics')),
  country_code char(2) not null,
  contact_email text not null,
  website_url text,
  description text not null,
  status text not null default 'pending_review' check (status in ('pending_review','kyb_required','approved','rejected','suspended')),
  reviewed_by text,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pi_uid, service_type)
);
create index if not exists service_provider_applications_status_idx on public.service_provider_applications (status, created_at);
create index if not exists service_provider_applications_uid_idx on public.service_provider_applications (pi_uid, created_at desc);

create table if not exists public.provider_integrations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.service_provider_applications(id) on delete cascade,
  provider_name text not null,
  integration_type text not null check (integration_type in ('api','webhook','manual')),
  api_base_url text,
  credential_secret_ref text,
  webhook_secret_ref text,
  status text not null default 'awaiting_approval' check (status in ('awaiting_approval','pending_configuration','testing','active','disabled','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, provider_name)
);
create index if not exists provider_integrations_status_idx on public.provider_integrations (status);

alter table public.service_provider_applications enable row level security;
alter table public.provider_integrations enable row level security;

-- No anon/authenticated policies are created. Server-side service role access
-- follows Pi UID verification and administrator review. Secret reference fields
-- point to an external encrypted secret manager; they are not the secret values.
