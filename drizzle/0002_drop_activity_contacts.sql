-- ============================================================
-- Phase 1 Step H: activity_contacts を廃止
-- ============================================================
-- 経緯:
--   0001_related_records.sql で activity_contacts → activity_related_records
--   への backfill 済み。Phase 1 中盤までは dual-write で両テーブルに書き込ん
--   でいたが、本コミット (Step H) でコード側から activity_contacts への参照
--   を全削除。テーブル本体もここで DROP する。
--
-- 適用順:
--   1. 0001_related_records.sql を全 Neon に適用済みであること
--   2. main にコード側 Step H をマージ前に、本ファイルを適用しないと
--      「DB に table があるのに schema には無い」状態になる（check:schema
--      は dbOnly 警告のみで build は通る）。安全のため Step H デプロイ前後
--      どちらかで適用する。
--
-- 冪等: DROP TABLE IF EXISTS なので再実行 OK。
-- ============================================================

DROP TABLE IF EXISTS activity_contacts;

-- 完了: 確認用
--   SELECT count(*) FROM information_schema.tables
--   WHERE table_schema='public' AND table_name='activity_contacts';
--   → 0 (テーブル存在しない) であれば成功
