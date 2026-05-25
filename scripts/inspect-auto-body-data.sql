-- =================================================================
-- 板金 (auto-body) Neon の現在のデータ状況を確認する SQL
-- =================================================================
--
-- 目的:
--   cleanup-auto-body-test-data.sql を実行する前後で、各オブジェクトの
--   件数と内容を確認するための read-only SQL。
--
-- 実行方法:
--   Neon Console → ep-young-meadow (auto-body) プロジェクト → SQL Editor
--   この SQL を Run。データは一切変更されない。
-- =================================================================

-- ─── オブジェクトごとの件数 ──────────
SELECT '取引先' AS object, COUNT(*) AS records FROM accounts
UNION ALL SELECT '人物',          COUNT(*) FROM contacts
UNION ALL SELECT '在庫車両',      COUNT(*) FROM vehicles
UNION ALL SELECT '顧客車両',      COUNT(*) FROM customer_vehicles
UNION ALL SELECT '整備',          COUNT(*) FROM maintenance_records
UNION ALL SELECT '整備行',        COUNT(*) FROM maintenance_line_items
UNION ALL SELECT '整備諸費用',    COUNT(*) FROM maintenance_fees
UNION ALL SELECT '整備入金',      COUNT(*) FROM maintenance_payments
UNION ALL SELECT '損傷ピン',      COUNT(*) FROM maintenance_damage_pins
UNION ALL SELECT '部品',          COUNT(*) FROM parts
UNION ALL SELECT '部品入出庫',    COUNT(*) FROM part_movements
UNION ALL SELECT '商談',          COUNT(*) FROM opportunities
UNION ALL SELECT '活動',          COUNT(*) FROM activities
UNION ALL SELECT 'ToDo',          COUNT(*) FROM tasks
UNION ALL SELECT '経費',          COUNT(*) FROM expenses
UNION ALL SELECT '整備テンプレ',  COUNT(*) FROM maintenance_templates
ORDER BY object;

-- ─── 各オブジェクトの最新 5 件 ──────────

SELECT '--- 取引先 (accounts) ---' AS section;
SELECT id::text, name, status, industry, created_at
FROM accounts ORDER BY created_at DESC LIMIT 5;

SELECT '--- 人物 (contacts) ---' AS section;
SELECT id::text, full_name, email, account_id::text, created_at
FROM contacts ORDER BY created_at DESC LIMIT 5;

SELECT '--- 在庫車両 (vehicles) ---' AS section;
SELECT id::text, maker, model, license_plate, status, created_at
FROM vehicles ORDER BY created_at DESC LIMIT 5;

SELECT '--- 顧客車両 (customer_vehicles) ---' AS section;
SELECT id::text, plate_number, car_model, account_id::text, contact_id::text, created_at
FROM customer_vehicles ORDER BY created_at DESC LIMIT 5;

SELECT '--- 整備 (maintenance_records) ---' AS section;
SELECT id::text, maintenance_no, status, customer_vehicle_id::text, account_id::text, intake_date, created_at
FROM maintenance_records ORDER BY created_at DESC LIMIT 5;

SELECT '--- 部品 (parts) ---' AS section;
SELECT id::text, part_number, name, unit_price, reorder_level, created_at
FROM parts ORDER BY created_at DESC LIMIT 5;

SELECT '--- 商談 (opportunities) ---' AS section;
SELECT id::text, name, stage, account_id::text, close_date, created_at
FROM opportunities ORDER BY created_at DESC LIMIT 5;

SELECT '--- 活動 (activities) ---' AS section;
SELECT id::text, type, subject, occurred_at, created_at
FROM activities ORDER BY created_at DESC LIMIT 5;

SELECT '--- ToDo (tasks) ---' AS section;
SELECT id::text, title, done, due_date, priority, created_at
FROM tasks ORDER BY created_at DESC LIMIT 5;

SELECT '--- 経費 (expenses) ---' AS section;
SELECT id::text, title, amount, expense_date, created_at
FROM expenses ORDER BY created_at DESC LIMIT 5;
