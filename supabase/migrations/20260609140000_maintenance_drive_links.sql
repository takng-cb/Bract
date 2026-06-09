-- 整備レコードに外部リンク（Google Drive 等）を保持する drive_links 列を追加。
-- 形式: [{ "label": "...", "url": "..." }]（jsonb 配列）。
-- 方針: 冪等。全 Neon（base / real-estate / auto-body / 将来業種）に適用する（AGENTS.md）。
--   業種特化テーブルだが、未使用業種では空のままで害は無い。

ALTER TABLE maintenance_records
  ADD COLUMN IF NOT EXISTS drive_links jsonb;
