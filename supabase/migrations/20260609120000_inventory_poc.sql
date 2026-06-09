-- ================================================================
-- inventory モジュール PoC（Issue #48）
--   products / warehouses / stock_movements
--   lot/serial は #71 へ先送り。
--
-- 適用方針: 全 Neon に適用する（AGENTS.md「全 Neon に全マイグレを適用する」）。
--   base / real-estate / auto-body / 将来の業種すべてに流す。
--   業種特化テーブルが空のまま存在するのは害ではなく、無いと Drizzle の
--   SELECT が column/relation does not exist で落ちる。
--
-- 冪等: CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS
-- ================================================================

-- 商品（products）
CREATE TABLE IF NOT EXISTS products (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku                 text NOT NULL UNIQUE,
  name                text NOT NULL,
  category            text,
  unit                text,                       -- 個/箱/kg 等
  unit_price          numeric,                    -- 売価
  cost_price          numeric,                    -- 原価
  reorder_level       integer NOT NULL DEFAULT 0,
  supplier_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  description         text,
  owner_id            uuid,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- 倉庫（warehouses）
CREATE TABLE IF NOT EXISTS warehouses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  name        text NOT NULL,
  location    text,
  note        text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- 在庫移動（stock_movements）
CREATE TABLE IF NOT EXISTS stock_movements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id  uuid REFERENCES warehouses(id) ON DELETE SET NULL,
  movement_type text NOT NULL,                    -- '入庫' | '出庫' | '調整'
  quantity      integer NOT NULL,                 -- 符号なし。type で増減を解釈
  unit_price    numeric,
  occurred_at   date NOT NULL DEFAULT now(),
  reference     text,                             -- 伝票番号等
  note          text,
  owner_id      uuid,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_movements_product_idx   ON stock_movements (product_id);
CREATE INDEX IF NOT EXISTS stock_movements_warehouse_idx ON stock_movements (warehouse_id);
