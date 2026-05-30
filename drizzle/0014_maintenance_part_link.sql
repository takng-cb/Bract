-- 部品在庫 本格対応 (Issue #47 Phase 2)
--
-- maintenance_line_items に part_id を追加し、部品マスタとリンクできるようにする。
-- part_id がセットされている行は、整備完了時に part_movements に '出庫' を自動記録する
-- （アプリ層のサーバーアクションで担保）。
--
-- 既存の part_movements は手動入力としても引き続き利用可能。

ALTER TABLE maintenance_line_items
  ADD COLUMN IF NOT EXISTS part_id uuid REFERENCES parts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS maintenance_line_part_idx
  ON maintenance_line_items (part_id)
  WHERE part_id IS NOT NULL;

-- part_movements に「整備に紐づく出庫」かどうか追跡するために
-- maintenance_id 列を追加（オプション、後方互換性のため nullable）
ALTER TABLE part_movements
  ADD COLUMN IF NOT EXISTS maintenance_id uuid REFERENCES maintenance_records(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS line_item_id   uuid REFERENCES maintenance_line_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS part_movements_maintenance_idx
  ON part_movements (maintenance_id)
  WHERE maintenance_id IS NOT NULL;
