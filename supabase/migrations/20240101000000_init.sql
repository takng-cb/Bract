-- users（Supabase Authと連携）
create table public.users (
  id uuid references auth.users(id) primary key,
  email text not null,
  full_name text,
  role text not null default 'member',
  created_at timestamptz default now()
);

-- accounts（取引先企業）
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text,
  phone text,
  website text,
  address text,
  status text not null default 'active',
  owner_id uuid references public.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- contacts（担当者）
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  title text,
  owner_id uuid references public.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- opportunities（商談）
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id) on delete cascade,
  name text not null,
  stage text not null default 'prospecting',
  amount numeric,
  close_date date,
  owner_id uuid references public.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- activities（活動履歴）
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  type text not null,
  subject text not null,
  body text,
  occurred_at timestamptz default now(),
  owner_id uuid references public.users(id),
  created_at timestamptz default now()
);
