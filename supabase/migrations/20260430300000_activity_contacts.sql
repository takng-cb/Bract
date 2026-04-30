-- 活動と担当者の多対多テーブル
create table if not exists public.activity_contacts (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  contact_id  uuid not null references public.contacts(id) on delete cascade,
  created_at  timestamptz default now(),
  unique(activity_id, contact_id)
);

-- 既存の contact_id から activity_contacts へデータ移行
insert into public.activity_contacts (activity_id, contact_id)
select id, contact_id
from public.activities
where contact_id is not null
on conflict do nothing;
