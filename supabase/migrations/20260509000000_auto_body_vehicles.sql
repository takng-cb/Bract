-- ──────────────────────────────────────────────────────────────────────
-- 業種オーバーレイ：板金屋・自動車整備業 (auto-body)
--
-- 1. vehicles（車両）テーブル新設
--    自社で仕入れる中古車・受託整備の対象車を一元管理する。
--
-- 2. opportunities への業種カラム追加
--    商談単位で「車両販売 / 板金 / 整備 / 車検 / その他」を区別し、
--    対象車両への参照と部品仕入原価を持つ。利益 = amount − parts_cost。
--
-- 適用先: auto-body 用に独立した Neon / Supabase プロジェクトを想定。
--         既存の不動産特化 DB には適用しないこと。
-- ──────────────────────────────────────────────────────────────────────

-- 1. vehicles テーブル
CREATE TABLE IF NOT EXISTS vehicles (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 車両情報
  maker                text NOT NULL,
  model                text NOT NULL,
  year                 integer,
  mileage              integer,
  color                text,
  license_plate        text,
  vin                  text,                                              -- 車台番号
  -- 状態
  status               text NOT NULL DEFAULT '在庫',                      -- 在庫 | 販売済 | 修理中 | メンテ中 | 車検中 | 納車待ち | 廃車
  -- 仕入
  purchase_date        date,
  purchase_price       numeric,
  supplier_account_id  uuid REFERENCES accounts(id) ON DELETE SET NULL,   -- 仕入元
  -- 販売
  sale_price           numeric,                                            -- 希望売価
  sold_date            date,
  sold_price           numeric,                                            -- 実売価
  buyer_account_id     uuid REFERENCES accounts(id) ON DELETE SET NULL,   -- 売却先
  -- 車検
  next_inspection_date date,                                              -- 次回車検期日
  -- メタ
  description          text,
  owner_id             uuid,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vehicles_status_idx              ON vehicles(status);
CREATE INDEX IF NOT EXISTS vehicles_supplier_idx            ON vehicles(supplier_account_id);
CREATE INDEX IF NOT EXISTS vehicles_buyer_idx               ON vehicles(buyer_account_id);
CREATE INDEX IF NOT EXISTS vehicles_next_inspection_idx     ON vehicles(next_inspection_date);

-- 2. opportunities への業種カラム追加（auto-body）
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS service_type text,                                              -- 車両販売 | 板金修理 | 整備 | 車検 | その他
  ADD COLUMN IF NOT EXISTS vehicle_id   uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parts_cost   numeric NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS opportunities_vehicle_idx ON opportunities(vehicle_id);
