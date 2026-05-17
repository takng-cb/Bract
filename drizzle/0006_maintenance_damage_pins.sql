-- ============================================================
-- 損傷箇所マップ（板金特化機能）
-- ============================================================
-- 車両俯瞰図 / 4 面図にクリックでピン打ちした損傷箇所を保存。
-- view = top/front/back/left/right
-- x_pct, y_pct = 図面内の相対座標 0-100 (%)
-- ============================================================

CREATE TABLE IF NOT EXISTS maintenance_damage_pins (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_id uuid NOT NULL REFERENCES maintenance_records(id) ON DELETE CASCADE,
  view           text NOT NULL,        -- top / front / back / left / right
  x_pct          numeric NOT NULL,     -- 0-100 (%)
  y_pct          numeric NOT NULL,     -- 0-100 (%)
  category       text NOT NULL,        -- 凹み / 擦り傷 / 塗装剥がれ / 破損 / サビ / その他
  severity       text NOT NULL DEFAULT '中',  -- 軽 / 中 / 大
  note           text,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maintenance_damage_idx
  ON maintenance_damage_pins (maintenance_id, view, sort_order);
