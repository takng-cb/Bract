-- ============================================================
-- タグ管理 & 変更履歴
-- ============================================================

-- タグマスタ
create table if not exists public.tags (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  color      text not null default '#71717a',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- タグ紐づけ（ポリモーフィック）
create table if not exists public.taggables (
  id          uuid primary key default gen_random_uuid(),
  tag_id      uuid not null references public.tags(id) on delete cascade,
  object_type text not null,  -- 'account' | 'contact' | 'opportunity'
  object_id   uuid not null,
  created_at  timestamptz default now(),
  unique(tag_id, object_type, object_id)
);

create index if not exists taggables_object_idx on public.taggables(object_type, object_id);

-- 変更ログ
create table if not exists public.change_logs (
  id          uuid primary key default gen_random_uuid(),
  object_type text not null,  -- 'account' | 'contact' | 'opportunity'
  object_id   uuid not null,
  field_name  text not null,
  field_label text not null,
  old_value   text,
  new_value   text,
  changed_at  timestamptz default now()
);

create index if not exists change_logs_object_idx on public.change_logs(object_type, object_id, changed_at desc);

-- サンプルタグ
insert into public.tags (name, color) values
  ('重要',   '#ef4444'),
  ('VIP',    '#f97316'),
  ('要注意', '#eab308'),
  ('新規',   '#22c55e'),
  ('紹介元', '#3b82f6'),
  ('長期',   '#8b5cf6')
on conflict (name) do nothing;
