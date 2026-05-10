-- ──────────────────────────────────────────────────────────────────────
-- 業種オーバーレイ：板金屋・自動車整備業 (auto-body)
--
-- 部品マスタ + 入出庫履歴
--   - parts          ：部品マスタ（品番・名称・カテゴリ・単価・標準仕入元）
--   - part_movements ：入出庫履歴。現在庫は SUM(in) - SUM(out) で計算
--
-- 適用先: auto-body 用 Neon のみ（real-estate 等には不要）
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS parts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 識別
  part_number          text NOT NULL,                          -- 品番
  name                 text NOT NULL,                          -- 部品名
  category             text,                                   -- カテゴリ（外装/内装/エンジン/etc）
  -- マスタ情報
  supplier_account_id  uuid REFERENCES accounts(id) ON DELETE SET NULL,
  unit_price           numeric,                                -- 標準仕入単価（税抜）
  description          text,
  -- 在庫アラートしきい値
  reorder_level        integer NOT NULL DEFAULT 0,             -- これ以下になったら警告したい在庫数
  -- メタ
  owner_id             uuid,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS parts_part_number_uq ON parts(part_number);
CREATE INDEX IF NOT EXISTS parts_supplier_idx       ON parts(supplier_account_id);

-- 入出庫履歴
CREATE TABLE IF NOT EXISTS part_movements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id         uuid NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  movement_type   text NOT NULL,                              -- '入庫' | '出庫' | '棚卸調整'
  quantity        integer NOT NULL,                           -- 正の整数（出庫も正で書き、type で増減判定）
  unit_price      numeric,                                    -- その時点の単価（任意）
  occurred_at     date NOT NULL DEFAULT CURRENT_DATE,
  -- 関連先（オプション）
  opportunity_id  uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  vehicle_id      uuid,                                       -- vehicles.id へ参照（FK は型整合のため省略）
  notes           text,
  owner_id        uuid,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS part_movements_part_idx        ON part_movements(part_id);
CREATE INDEX IF NOT EXISTS part_movements_opportunity_idx ON part_movements(opportunity_id);
CREATE INDEX IF NOT EXISTS part_movements_occurred_idx    ON part_movements(occurred_at);
