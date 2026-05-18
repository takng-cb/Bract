-- customer_vehicles も ToC（BtoC）顧客に対応:
-- account_id を nullable 化し、contact_id（本人を指す）を追加する。
-- 所有者は account_id (会社) か contact_id (本人) のいずれかが入る運用。

ALTER TABLE customer_vehicles
  ALTER COLUMN account_id DROP NOT NULL;

ALTER TABLE customer_vehicles
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL;
