-- attachments に「整備」「顧客車両」へのリンクを追加 (#46 関連)
--
-- 既存の attachments テーブルは accounts / contacts / opportunities / activities
-- にしか紐付かなかった。auto-body 業種で整備レコードと顧客車両に画像 / PDF /
-- 書類を添付したい要望に応えるため、対応する FK を 2 本追加する。
--
-- 各列は nullable。1 attachments 行は、添付先 (account_id / contact_id /
-- opportunity_id / activity_id / maintenance_id / customer_vehicle_id) のうち
-- どれか 1 つ以上に紐付く想定 (整合性チェックはアプリ側で行う)。

ALTER TABLE attachments
  ADD COLUMN IF NOT EXISTS maintenance_id       uuid REFERENCES maintenance_records(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS customer_vehicle_id  uuid REFERENCES customer_vehicles(id)   ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS attachments_maintenance_idx       ON attachments(maintenance_id);
CREATE INDEX IF NOT EXISTS attachments_customer_vehicle_idx  ON attachments(customer_vehicle_id);
