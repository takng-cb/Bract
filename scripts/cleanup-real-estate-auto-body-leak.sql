-- =================================================================
-- real-estate Neon (ep-soft-poetry) に誤って投入された
-- auto-body 用 object_definitions 行を削除する。
--
-- 原因:
--   scripts/seed-auto-body.ts を real-estate の DATABASE_URL で
--   実行してしまい、object_definitions に
--     - vehicles  (車両)
--     - parts     (部品マスタ)
--     - part_movements (入出庫履歴)
--   の 3 行が入った。/admin/objects は nav_enabled に関わらず全行
--   を表示するので、real-estate 環境にも「入出庫履歴」が見えて
--   いる状態。
--
-- 流す前に:
--   DATABASE_URL が real-estate Neon (ep-soft-poetry) を指している
--   ことを確認してください。
--   psql "$DATABASE_URL" -f scripts/cleanup-real-estate-auto-body-leak.sql
--
-- 確認 SQL (実行前/実行後):
--   SELECT api_name, label_plural FROM object_definitions
--    WHERE api_name IN ('vehicles', 'parts', 'part_movements');
-- =================================================================

BEGIN;

-- 1. field_definitions は CASCADE で消える設定だが念のため先に削除
DELETE FROM field_definitions
 WHERE object_id IN (
   SELECT id FROM object_definitions
    WHERE api_name IN ('vehicles', 'parts', 'part_movements')
 );

-- 2. object_definitions 本体
DELETE FROM object_definitions
 WHERE api_name IN ('vehicles', 'parts', 'part_movements');

-- 3. (もし auto-body migration も流してしまっていれば) テーブル自体を削除
--    real-estate にこれらのテーブルが必要になることはない。
DROP TABLE IF EXISTS part_movements CASCADE;
DROP TABLE IF EXISTS parts          CASCADE;
-- vehicles テーブルは object_definitions と別に CREATE される構成なので
-- 業種オーバーレイで残しても害は無いが、未使用なら下行のコメントを外す:
-- DROP TABLE IF EXISTS vehicles CASCADE;

-- 確認
SELECT '残存 object_definitions' AS check, COUNT(*) AS n
  FROM object_definitions
 WHERE api_name IN ('vehicles', 'parts', 'part_movements');

COMMIT;
