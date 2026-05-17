-- ============================================================
-- 整備パッケージ（テンプレート） — Phase 2 機能差別化
-- ============================================================
-- よくある作業セット（車検基本パック / オイル交換セット / 板金小傷修理 等）を
-- 1 行のテンプレートにまとめ、整備の行アイテム編集画面から「テンプレを適用」
-- で 1 クリック投入する。
--
--   maintenance_templates         : テンプレ本体（名前・カテゴリ等）
--   maintenance_template_lines    : テンプレに含まれる作業項目（line_items 雛形）
--   maintenance_template_fees     : テンプレに含まれる諸費用（fees 雛形）
-- ============================================================

CREATE TABLE IF NOT EXISTS maintenance_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  category    text,                                   -- 車検 / 一般整備 / 板金修理 / 新車納車 等
  is_active   boolean NOT NULL DEFAULT TRUE,
  sort_order  integer NOT NULL DEFAULT 0,
  owner_id    uuid,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maintenance_tpl_active_idx
  ON maintenance_templates (is_active, sort_order);

CREATE TABLE IF NOT EXISTS maintenance_template_lines (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id      uuid NOT NULL REFERENCES maintenance_templates(id) ON DELETE CASCADE,
  sort_order       integer NOT NULL DEFAULT 0,
  work_category    text,
  item_name        text NOT NULL,
  hours            numeric,
  labor_amount     numeric,
  parts_qty        numeric,
  parts_unit       text,
  parts_unit_price numeric,
  cost_unit_price  numeric,
  note             text,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maintenance_tpl_line_idx
  ON maintenance_template_lines (template_id, sort_order);

CREATE TABLE IF NOT EXISTS maintenance_template_fees (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  uuid NOT NULL REFERENCES maintenance_templates(id) ON DELETE CASCADE,
  sort_order   integer NOT NULL DEFAULT 0,
  category     text NOT NULL,  -- '課税' | '非課税'
  item_name    text NOT NULL,
  amount       numeric,
  cost_amount  numeric,
  meta         jsonb,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maintenance_tpl_fee_idx
  ON maintenance_template_fees (template_id, sort_order);
