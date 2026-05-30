-- 売掛金管理本格対応 (Issue #48 Phase 2)
--
-- 整備レコードに請求・入金関連のカラムを追加:
--   - billing_target:     請求先種別 (顧客 / 保険会社 / リース会社 等)
--   - invoice_no:         請求書番号 (任意、自由入力)
--   - invoice_issued_at:  請求書発行日
--   - payment_due_date:   支払期限
--   - payment_status:     支払状況 (未請求 / 請求済 / 一部入金 / 入金済 / 貸倒)
--                         入金合計と請求合計から自動算出も可能だが、明示的に保持
--   - payment_terms:      支払条件 (月末締め翌月末払い 等の自由入力)
--
-- 既存の maintenance_payments テーブルはそのまま使用。
-- これらのカラムはオプションで、未入力でも既存動作は維持される。

ALTER TABLE maintenance_records
  ADD COLUMN IF NOT EXISTS billing_target     text,
  ADD COLUMN IF NOT EXISTS invoice_no         text,
  ADD COLUMN IF NOT EXISTS invoice_issued_at  date,
  ADD COLUMN IF NOT EXISTS payment_due_date   date,
  ADD COLUMN IF NOT EXISTS payment_status     text,
  ADD COLUMN IF NOT EXISTS payment_terms      text;

-- 請求期限超過の検索を高速化
CREATE INDEX IF NOT EXISTS maintenance_payment_due_idx
  ON maintenance_records (payment_due_date)
  WHERE payment_due_date IS NOT NULL AND payment_status IN ('請求済', '一部入金');
