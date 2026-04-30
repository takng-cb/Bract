-- ============================================================
-- Phase 2: Schema enhancement
-- - Existing tables: add new columns
-- - New tables: tasks, attachments
-- - Storage: attachments bucket
-- ============================================================

-- accounts: 取引先種別・年間売上・従業員数・概要
alter table public.accounts
  add column if not exists type text,
  add column if not exists annual_revenue numeric,
  add column if not exists employee_count integer,
  add column if not exists description text;

-- contacts: 部署・誕生日・メモ
alter table public.contacts
  add column if not exists department text,
  add column if not exists birthday date,
  add column if not exists description text;

-- opportunities: 確度・説明
alter table public.opportunities
  add column if not exists probability integer,
  add column if not exists description text;

-- tasks (ToDoリスト)
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  due_date date,
  done boolean not null default false,
  priority text not null default 'medium', -- 'high' | 'medium' | 'low'
  account_id uuid references public.accounts(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- attachments (添付ファイルのメタデータ)
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  storage_path text not null,
  file_size bigint,
  content_type text,
  account_id uuid references public.accounts(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete cascade,
  created_at timestamptz default now()
);

-- Storage bucket (public read for dev)
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

-- Storage policies (dev: anon can read/write/delete)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'crm_attachments_select'
  ) then
    execute 'create policy "crm_attachments_select" on storage.objects
      for select to anon using (bucket_id = ''attachments'')';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'crm_attachments_insert'
  ) then
    execute 'create policy "crm_attachments_insert" on storage.objects
      for insert to anon with check (bucket_id = ''attachments'')';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'crm_attachments_delete'
  ) then
    execute 'create policy "crm_attachments_delete" on storage.objects
      for delete to anon using (bucket_id = ''attachments'')';
  end if;
end $$;
