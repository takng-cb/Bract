-- properties（不動産物件）
create table public.properties (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  property_type    text not null default 'その他',
  -- 'マンション' | '戸建て' | '土地' | 'ビル' | '店舗' | '倉庫' | 'その他'
  transaction_type text not null default '売買',
  -- '売買' | '賃貸'
  status           text not null default '募集中',
  -- '募集中' | '交渉中' | '成約' | '管理中' | '終了'
  address          text,
  area             numeric,          -- 面積（㎡）
  price            numeric,          -- 売価 or 賃料（円）
  floor            integer,          -- 所在階
  total_floors     integer,          -- 総階数
  built_year       integer,          -- 築年（西暦）
  account_id       uuid references public.accounts(id) on delete set null,
  contact_id       uuid references public.contacts(id) on delete set null,
  description      text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
