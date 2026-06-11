-- 「オブジェクト」語彙の内部リネーム（#21 / REQ-0050 / ADR-0018 の語彙「ブック」に統一）
--   object_definitions → book_definitions
--   field_definitions  → book_fields
--   custom_records     → book_records
-- 過去のマイグレーションは旧名のまま実行され、最後に本マイグレで改名される（replay 安全）。
-- 冪等。全 Neon に適用すること。

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'object_definitions')
     AND NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'book_definitions') THEN
    ALTER TABLE object_definitions RENAME TO book_definitions;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'field_definitions')
     AND NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'book_fields') THEN
    ALTER TABLE field_definitions RENAME TO book_fields;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'custom_records')
     AND NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'book_records') THEN
    ALTER TABLE custom_records RENAME TO book_records;
  END IF;
END $$;
