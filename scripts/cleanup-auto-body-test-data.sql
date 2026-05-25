-- =================================================================
-- 板金 (auto-body) Neon のテストデータクリーンアップ SQL
-- =================================================================
--
-- 目的:
--   リリース前に、テストで作成した各オブジェクトのレコードを整理し、
--   オブジェクトごとに「代表的なテストデータ」を 1 件だけ残す。
--   残したレコードは名前の頭に「テストデータ_」を付けて、ユーザーが
--   テストデータと一目で分かるようにする。
--
-- 実行方法:
--   Neon Console → ep-young-meadow (auto-body) プロジェクト → SQL Editor
--   この SQL 全文をコピペして Run。
--
--   トランザクション (BEGIN...COMMIT) で囲まれているので、結果を見て
--   問題があれば最後の COMMIT を ROLLBACK に書き換えて再実行すれば
--   元の状態に戻せる。
--
-- 残すルール:
--   各テーブルから `created_at` が最も新しいレコードを 1 件選ぶ
--   （子テーブル: 親が残るレコードのうち最新を 1 件）
--   ※ 関係性が壊れないよう、anchor → 子の順に選定する
--
-- 影響しないテーブル (= そのまま残す):
--   - maintenance_templates / maintenance_template_lines / template_fees
--     ← テンプレートはマスタなので削除しない
--   - tags / taggables ← タグ master
--   - object_definitions / field_definitions / list_view_settings ← schema
--   - system_settings / user_preferences / saved_views ← 設定
--   - change_logs / import_logs ← 履歴 (どうせ後で増える)
--   - users / auth.* ← Supabase Auth
--   - relationship_definitions / relationship_fields ← 関係性 schema
--
-- 削除されるテーブル:
--   - accounts, contacts, opportunities
--   - vehicles, customer_vehicles
--   - maintenance_records (+ CASCADE: line_items, fees, payments, damage_pins)
--   - parts (+ CASCADE: part_movements)
--   - activities, tasks, expenses
--   - junction tables (CASCADE)
-- =================================================================

BEGIN;

-- ─── Step 1: 各テーブルから残す ID を一時テーブルに保存 ──────────
-- 「個人」プレースホルダ取引先 (auto-body の BtoC で自動生成される) は
-- 除外して、ちゃんと名前のある取引先を優先する

CREATE TEMP TABLE keep_accounts AS
  SELECT id FROM accounts
  WHERE status = 'active' AND COALESCE(name, '') NOT IN ('', '個人')
  ORDER BY created_at DESC
  LIMIT 1;

-- 該当無しなら最新の active 取引先 (フォールバック)
INSERT INTO keep_accounts
  SELECT id FROM accounts
  WHERE status = 'active'
    AND NOT EXISTS (SELECT 1 FROM keep_accounts)
  ORDER BY created_at DESC
  LIMIT 1;

CREATE TEMP TABLE keep_contacts AS
  -- まずは keep_accounts に紐づく contact を最新 1 件
  SELECT id FROM contacts
  WHERE account_id IN (SELECT id FROM keep_accounts)
  ORDER BY created_at DESC
  LIMIT 1;

INSERT INTO keep_contacts
  SELECT id FROM contacts
  WHERE NOT EXISTS (SELECT 1 FROM keep_contacts)
  ORDER BY created_at DESC
  LIMIT 1;

-- 在庫車両 (販売用)
CREATE TEMP TABLE keep_vehicles AS
  SELECT id FROM vehicles
  ORDER BY created_at DESC
  LIMIT 1;

-- 顧客車両 (整備対象)
CREATE TEMP TABLE keep_customer_vehicles AS
  -- keep_accounts に紐づく顧客車両を優先
  SELECT id FROM customer_vehicles
  WHERE account_id IN (SELECT id FROM keep_accounts)
     OR contact_id IN (SELECT id FROM keep_contacts)
  ORDER BY created_at DESC
  LIMIT 1;

INSERT INTO keep_customer_vehicles
  SELECT id FROM customer_vehicles
  WHERE NOT EXISTS (SELECT 1 FROM keep_customer_vehicles)
  ORDER BY created_at DESC
  LIMIT 1;

-- 整備
CREATE TEMP TABLE keep_maintenance AS
  -- 残す顧客車両 に紐づく整備を優先
  SELECT id FROM maintenance_records
  WHERE customer_vehicle_id IN (SELECT id FROM keep_customer_vehicles)
  ORDER BY created_at DESC
  LIMIT 1;

INSERT INTO keep_maintenance
  SELECT id FROM maintenance_records
  WHERE NOT EXISTS (SELECT 1 FROM keep_maintenance)
  ORDER BY created_at DESC
  LIMIT 1;

-- 部品
CREATE TEMP TABLE keep_parts AS
  SELECT id FROM parts
  ORDER BY created_at DESC
  LIMIT 1;

-- 商談
CREATE TEMP TABLE keep_opportunities AS
  SELECT id FROM opportunities
  WHERE account_id IN (SELECT id FROM keep_accounts)
  ORDER BY created_at DESC
  LIMIT 1;

INSERT INTO keep_opportunities
  SELECT id FROM opportunities
  WHERE NOT EXISTS (SELECT 1 FROM keep_opportunities)
  ORDER BY created_at DESC
  LIMIT 1;

-- 活動
CREATE TEMP TABLE keep_activities AS
  SELECT id FROM activities
  ORDER BY created_at DESC
  LIMIT 1;

-- ToDo
CREATE TEMP TABLE keep_tasks AS
  SELECT id FROM tasks
  ORDER BY created_at DESC
  LIMIT 1;

-- 経費
CREATE TEMP TABLE keep_expenses AS
  SELECT id FROM expenses
  ORDER BY created_at DESC
  LIMIT 1;

-- ─── Step 2: 削除 (子から親へ。CASCADE を活用) ──────────

-- 整備 — RESTRICT FK があるので最初に削除
-- これで maintenance_line_items / fees / payments / damage_pins / attachments(if FK)
-- / junction の activity_related_records (maintenance 経由) も CASCADE で消える
DELETE FROM maintenance_records WHERE id NOT IN (SELECT id FROM keep_maintenance);

-- 部品 → part_movements は CASCADE
DELETE FROM parts WHERE id NOT IN (SELECT id FROM keep_parts);

-- 顧客車両
DELETE FROM customer_vehicles WHERE id NOT IN (SELECT id FROM keep_customer_vehicles);

-- 在庫車両 — vehicles を参照する FK は loaner_vehicle_id (SET NULL) と
-- supplier_account_id (SET NULL) のみなので、残し以外は安全に削除可
DELETE FROM vehicles WHERE id NOT IN (SELECT id FROM keep_vehicles);

-- 商談
DELETE FROM opportunities WHERE id NOT IN (SELECT id FROM keep_opportunities);

-- 活動 → activity_related_records は CASCADE
DELETE FROM activities WHERE id NOT IN (SELECT id FROM keep_activities);

-- ToDo → task_related_records は CASCADE
DELETE FROM tasks WHERE id NOT IN (SELECT id FROM keep_tasks);

-- 経費 → expense_related_records は CASCADE
DELETE FROM expenses WHERE id NOT IN (SELECT id FROM keep_expenses);

-- 人物 — accounts より先に
DELETE FROM contacts WHERE id NOT IN (SELECT id FROM keep_contacts);

-- 取引先 — 最後 (他からの参照を全て削除済み)
-- 注: customer_vehicles.account_id CASCADE, opportunities.account_id CASCADE,
-- maintenance_records.account_id RESTRICT (もう消えている)、
-- vehicles.supplier_account_id SET NULL なので残された vehicle の supplier 関係は
-- 単に NULL になるだけ。
DELETE FROM accounts WHERE id NOT IN (SELECT id FROM keep_accounts);

-- ─── Step 3: 残したレコードに「テストデータ_」プレフィックスを追加 ──────────

UPDATE accounts
  SET name = CASE
    WHEN name LIKE 'テストデータ_%' THEN name
    ELSE 'テストデータ_取引先_' || COALESCE(NULLIF(name, ''), '名称未設定')
  END,
  updated_at = NOW()
  WHERE id IN (SELECT id FROM keep_accounts);

UPDATE contacts
  SET full_name = CASE
    WHEN full_name LIKE 'テストデータ_%' THEN full_name
    ELSE 'テストデータ_人物_' || COALESCE(NULLIF(full_name, ''), '名称未設定')
  END,
  updated_at = NOW()
  WHERE id IN (SELECT id FROM keep_contacts);

-- 在庫車両: model を変更（表示は "{maker} {model}" なので model に差す）
UPDATE vehicles
  SET model = CASE
    WHEN model LIKE 'テストデータ_%' THEN model
    ELSE 'テストデータ_' || COALESCE(NULLIF(model, ''), '車両')
  END,
  description = COALESCE(NULLIF(description, '') || E'\n', '') || '[テストデータ] リリース前検証用に保持されているサンプル車両',
  updated_at = NOW()
  WHERE id IN (SELECT id FROM keep_vehicles);

-- 顧客車両: car_model を変更
UPDATE customer_vehicles
  SET car_model = CASE
    WHEN car_model LIKE 'テストデータ_%' THEN car_model
    ELSE 'テストデータ_' || COALESCE(NULLIF(car_model, ''), '車種')
  END,
  memo = COALESCE(NULLIF(memo, '') || E'\n', '') || '[テストデータ] リリース前検証用に保持されているサンプル車両',
  updated_at = NOW()
  WHERE id IN (SELECT id FROM keep_customer_vehicles);

-- 整備: maintenance_no は YYYYMMDD-NNN 形式で UNIQUE なので触らない。
-- internal_memo (印字なし) と general_note 両方に明示
UPDATE maintenance_records
  SET internal_memo = COALESCE(NULLIF(internal_memo, '') || E'\n', '') || '[テストデータ] リリース前検証用に保持されているサンプル整備',
  updated_at = NOW()
  WHERE id IN (SELECT id FROM keep_maintenance);

UPDATE parts
  SET name = CASE
    WHEN name LIKE 'テストデータ_%' THEN name
    ELSE 'テストデータ_' || COALESCE(NULLIF(name, ''), '部品')
  END,
  updated_at = NOW()
  WHERE id IN (SELECT id FROM keep_parts);

UPDATE opportunities
  SET name = CASE
    WHEN name LIKE 'テストデータ_%' THEN name
    ELSE 'テストデータ_商談_' || COALESCE(NULLIF(name, ''), '名称未設定')
  END,
  updated_at = NOW()
  WHERE id IN (SELECT id FROM keep_opportunities);

UPDATE activities
  SET subject = CASE
    WHEN subject LIKE 'テストデータ_%' THEN subject
    ELSE 'テストデータ_活動_' || COALESCE(NULLIF(subject, ''), '名称未設定')
  END
  WHERE id IN (SELECT id FROM keep_activities);

UPDATE tasks
  SET title = CASE
    WHEN title LIKE 'テストデータ_%' THEN title
    ELSE 'テストデータ_ToDo_' || COALESCE(NULLIF(title, ''), '名称未設定')
  END,
  updated_at = NOW()
  WHERE id IN (SELECT id FROM keep_tasks);

UPDATE expenses
  SET title = CASE
    WHEN title LIKE 'テストデータ_%' THEN title
    ELSE 'テストデータ_経費_' || COALESCE(NULLIF(title, ''), '名称未設定')
  END,
  updated_at = NOW()
  WHERE id IN (SELECT id FROM keep_expenses);

-- ─── Step 4: 結果サマリーを表示 ──────────

SELECT '取引先' AS object, COUNT(*) AS remaining FROM accounts
UNION ALL SELECT '人物',           COUNT(*) FROM contacts
UNION ALL SELECT '在庫車両',       COUNT(*) FROM vehicles
UNION ALL SELECT '顧客車両',       COUNT(*) FROM customer_vehicles
UNION ALL SELECT '整備',           COUNT(*) FROM maintenance_records
UNION ALL SELECT '整備行',         COUNT(*) FROM maintenance_line_items
UNION ALL SELECT '整備諸費用',     COUNT(*) FROM maintenance_fees
UNION ALL SELECT '整備入金',       COUNT(*) FROM maintenance_payments
UNION ALL SELECT '損傷ピン',       COUNT(*) FROM maintenance_damage_pins
UNION ALL SELECT '部品',           COUNT(*) FROM parts
UNION ALL SELECT '部品入出庫',     COUNT(*) FROM part_movements
UNION ALL SELECT '商談',           COUNT(*) FROM opportunities
UNION ALL SELECT '活動',           COUNT(*) FROM activities
UNION ALL SELECT 'ToDo',           COUNT(*) FROM tasks
UNION ALL SELECT '経費',           COUNT(*) FROM expenses
ORDER BY object;

-- 残ったレコードの表示名一覧（テストデータ プレフィックスがついているか確認）
SELECT 'accounts'   AS table_name, id::text, name        AS display FROM accounts
UNION ALL SELECT 'contacts',           id::text, full_name        FROM contacts
UNION ALL SELECT 'vehicles',           id::text, maker || ' ' || model FROM vehicles
UNION ALL SELECT 'customer_vehicles',  id::text, COALESCE(plate_number, '—') || ' / ' || COALESCE(car_model, '—') FROM customer_vehicles
UNION ALL SELECT 'maintenance',        id::text, maintenance_no FROM maintenance_records
UNION ALL SELECT 'parts',              id::text, part_number || ' / ' || name FROM parts
UNION ALL SELECT 'opportunities',      id::text, name        FROM opportunities
UNION ALL SELECT 'activities',         id::text, subject     FROM activities
UNION ALL SELECT 'tasks',              id::text, title       FROM tasks
UNION ALL SELECT 'expenses',           id::text, title       FROM expenses
ORDER BY table_name;

-- ─── 最後の確認 ──────────
-- 結果を確認して問題なければ COMMIT、戻したければ ROLLBACK に書き換えて再実行
COMMIT;
-- ROLLBACK;
