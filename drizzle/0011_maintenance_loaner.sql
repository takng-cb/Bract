-- 代車管理 (Issue #45): maintenance_records に代車関連カラムを追加
--
-- 代車自体は専用テーブルを設けず、既存 vehicles（在庫車両）テーブルを
-- 流用する。vehicles.status の値として '代車中' を運用上利用する
-- （vehicles.status は text 型なので enum 変更は不要）。

ALTER TABLE maintenance_records
  ADD COLUMN IF NOT EXISTS loaner_vehicle_id   uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS loaner_handover_at  timestamp with time zone,
  ADD COLUMN IF NOT EXISTS loaner_return_at    timestamp with time zone,
  ADD COLUMN IF NOT EXISTS loaner_mileage_out  integer,
  ADD COLUMN IF NOT EXISTS loaner_mileage_in   integer,
  ADD COLUMN IF NOT EXISTS loaner_fuel_out     text,
  ADD COLUMN IF NOT EXISTS loaner_fuel_in      text,
  ADD COLUMN IF NOT EXISTS loaner_notes        text;

CREATE INDEX IF NOT EXISTS maintenance_loaner_idx
  ON maintenance_records (loaner_vehicle_id)
  WHERE loaner_vehicle_id IS NOT NULL;
