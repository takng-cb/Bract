-- ============================================================
-- Phase 2 Step 2G: activities/tasks/expenses から FK 列を削除
-- ============================================================
-- 経緯:
--   Phase 1 で関連レコード junction (X_related_records) を導入し、Phase 2 で
--   コード側を junction 専用に書き換え済み。本マイグレーションで FK 列の
--   実体を DB から削除する。
--
-- 影響:
--   - 旧 FK 列 (activities/tasks/expenses.{account_id, contact_id,
--     opportunity_id, custom_record_id}) が完全消失。
--   - DB 側 ON DELETE CASCADE / SET NULL の挙動も消失。親レコード削除時の
--     クリーンアップは app 層の cleanupRelatedRecordsForParent() が担う。
--   - 業務挙動の変化: 取引先削除時に関連活動は他関連先があれば残る（新仕様）。
--
-- 順序:
--   1. 本マイグレーションを 3 つの Neon に適用
--   2. コード deploy (schema.ts も FK 列削除済み)
--   どちらの順でも check:schema は通る（dbOnly 警告は build を止めないため）。
-- ============================================================

ALTER TABLE activities
  DROP COLUMN IF EXISTS account_id,
  DROP COLUMN IF EXISTS contact_id,
  DROP COLUMN IF EXISTS opportunity_id,
  DROP COLUMN IF EXISTS custom_record_id;

ALTER TABLE tasks
  DROP COLUMN IF EXISTS account_id,
  DROP COLUMN IF EXISTS contact_id,
  DROP COLUMN IF EXISTS opportunity_id,
  DROP COLUMN IF EXISTS custom_record_id;

ALTER TABLE expenses
  DROP COLUMN IF EXISTS account_id,
  DROP COLUMN IF EXISTS contact_id,
  DROP COLUMN IF EXISTS opportunity_id,
  DROP COLUMN IF EXISTS custom_record_id;

-- 確認:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name IN ('activities','tasks','expenses')
--     AND column_name IN ('account_id','contact_id','opportunity_id','custom_record_id');
--   → 0 行であれば成功
