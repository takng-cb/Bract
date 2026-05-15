-- ============================================================
-- 整備（板金・自動車整備業）データモデルを追加
-- ============================================================
-- 概要:
--   - customer_vehicles    : 顧客車両（整備対象車）。既存 vehicles（在庫車両）と別。
--   - maintenance_records  : 整備本体（顧客車両に対する整備・車検・修理の業務記録）
--   - maintenance_line_items : 作業項目（行アイテム）
--   - maintenance_fees     : 諸費用（課税・非課税）
--   - maintenance_payments : 入金履歴
--
-- 整備番号 (maintenance_no) は 'YYYYMMDD-NNN' 形式。app 層で発番する。
-- ============================================================

CREATE TABLE IF NOT EXISTS customer_vehicles (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id               uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  transport_branch         text,
  classification_number    text,
  kana                     text,
  plate_number             text,
  car_name                 text,
  car_model                text,
  grade                    text,
  vehicle_kind             text,
  vehicle_usage            text,
  private_business         text,
  body_shape               text,
  vin                      text,
  type_designation         text,
  class_category           text,
  first_registration_year  text,
  first_registration_month text,
  inspection_due_date      date,
  memo                     text,
  owner_id                 uuid,
  created_at               timestamp with time zone DEFAULT now(),
  updated_at               timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_vehicles_account_idx
  ON customer_vehicles (account_id);

CREATE TABLE IF NOT EXISTS maintenance_records (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_no       text NOT NULL UNIQUE,
  customer_vehicle_id  uuid NOT NULL REFERENCES customer_vehicles(id) ON DELETE RESTRICT,
  account_id           uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  contact_id           uuid REFERENCES contacts(id) ON DELETE SET NULL,
  billing_account_id   uuid REFERENCES accounts(id) ON DELETE SET NULL,
  intake_date          date,
  intake_time          text,
  delivery_date        date,
  delivery_time        text,
  pickup_location      text,
  delivery_location    text,
  sales_recording_date date,
  mileage              integer,
  branch_id            text,
  intake_category      text,
  reception_owner_id   uuid,
  worker_owner_id      uuid,
  internal_memo        text,
  work_order_note      text,
  general_note         text,
  tax_mode             text NOT NULL DEFAULT '税別10%',
  tax_rounding         text NOT NULL DEFAULT '切り捨て',
  lever_rate           numeric,
  status               text NOT NULL DEFAULT '予約',
  owner_id             uuid,
  created_at           timestamp with time zone DEFAULT now(),
  updated_at           timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maintenance_vehicle_idx ON maintenance_records (customer_vehicle_id);
CREATE INDEX IF NOT EXISTS maintenance_account_idx ON maintenance_records (account_id);
CREATE INDEX IF NOT EXISTS maintenance_status_idx  ON maintenance_records (status);

CREATE TABLE IF NOT EXISTS maintenance_line_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_id   uuid NOT NULL REFERENCES maintenance_records(id) ON DELETE CASCADE,
  sort_order       integer NOT NULL DEFAULT 0,
  work_category    text,
  item_name        text,
  hours            numeric,
  labor_amount     numeric,
  parts_qty        numeric,
  parts_unit       text,
  parts_unit_price numeric,
  cost_unit_price  numeric,
  note             text,
  state            text,
  is_excluded      boolean NOT NULL DEFAULT false,
  work_status      text NOT NULL DEFAULT '未完了',
  created_at       timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maintenance_line_idx
  ON maintenance_line_items (maintenance_id, sort_order);

CREATE TABLE IF NOT EXISTS maintenance_fees (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_id uuid NOT NULL REFERENCES maintenance_records(id) ON DELETE CASCADE,
  sort_order     integer NOT NULL DEFAULT 0,
  category       text NOT NULL,
  item_name      text NOT NULL,
  amount         numeric,
  cost_amount    numeric,
  meta           jsonb,
  created_at     timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maintenance_fee_idx
  ON maintenance_fees (maintenance_id, sort_order);

CREATE TABLE IF NOT EXISTS maintenance_payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_id uuid NOT NULL REFERENCES maintenance_records(id) ON DELETE CASCADE,
  payment_method text NOT NULL,
  memo           text,
  amount         numeric NOT NULL,
  payment_date   date NOT NULL,
  owner_id       uuid,
  branch_id      text,
  created_at     timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maintenance_payment_idx
  ON maintenance_payments (maintenance_id);
