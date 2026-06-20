-- ============================================================
-- Git City — Ownership & Invites
-- ============================================================

-- 1. claimed_profiles
create table if not exists claimed_profiles (
  id uuid primary key default gen_random_uuid(),
  github_login text not null unique,
  claimed_by uuid references auth.users(id) on delete cascade not null,
  claimed_at timestamptz not null default now()
);

-- 2. building_owners
create table if not exists building_owners (
  id bigint generated always as identity primary key,
  developer_id bigint references developers(id) on delete cascade not null unique,
  owner_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default now()
);

-- 3. developer_invites
create table if not exists developer_invites (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique, -- e.g. "aryan" (GitHub login)
  invited_by uuid references auth.users(id) on delete set null,
  invited_email text,
  created_at timestamptz not null default now(),
  claimed boolean not null default false,
  claimed_at timestamptz
);

-- 4. invite_events
create table if not exists invite_events (
  id bigint generated always as identity primary key,
  invite_id uuid references developer_invites(id) on delete cascade not null,
  event_type text not null, -- 'created', 'sent', 'opened', 'claimed'
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table claimed_profiles enable row level security;
alter table building_owners enable row level security;
alter table developer_invites enable row level security;
alter table invite_events enable row level security;

-- Policies for public reading
create policy "Public read claimed_profiles" on claimed_profiles for select using (true);
create policy "Public read building_owners" on building_owners for select using (true);
create policy "Public read developer_invites" on developer_invites for select using (true);
create policy "Public read invite_events" on invite_events for select using (true);
