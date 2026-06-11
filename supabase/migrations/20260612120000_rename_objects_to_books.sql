-- 「オブジェクト」語彙の内部リネーム（#21 / REQ-0050 / ADR-0018 の語彙「ブック」に統一）
--   object_definitions → book_definitions
--   field_definitions  → book_fields
--   custom_records     → book_records
-- 過去のマイグレーションは旧名のまま実行され、最後に本マイグレで改名される（replay 安全）。
-- 冪等（ALTER TABLE IF EXISTS: 改名済み＝旧名が無ければ何もしない）。
-- ※ apply-migration.ts はセミコロン分割のため DO $$ ブロックは使わない。

ALTER TABLE IF EXISTS object_definitions RENAME TO book_definitions;

ALTER TABLE IF EXISTS field_definitions RENAME TO book_fields;

ALTER TABLE IF EXISTS custom_records RENAME TO book_records;
