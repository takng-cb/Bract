-- custom_records.data を TEXT から JSONB に変更
-- 既存の JSON 文字列データは自動変換される

-- DEFAULT を一旦削除（text の DEFAULT は jsonb に自動キャストできないため）
ALTER TABLE custom_records ALTER COLUMN data DROP DEFAULT;

-- 型変換
ALTER TABLE custom_records ALTER COLUMN data TYPE JSONB USING data::jsonb;

-- DEFAULT を jsonb 型で復元
ALTER TABLE custom_records ALTER COLUMN data SET DEFAULT '{}'::jsonb;

-- JSONB 全体に対する GIN インデックス（任意フィールドの検索を高速化）
CREATE INDEX IF NOT EXISTS idx_custom_records_data_gin
  ON custom_records USING gin(data);
