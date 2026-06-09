-- part_movements に整備来歴リンク用カラムを追加（取りこぼしマイグレの補完）
--
-- schema.ts では以前から part_movements.maintenance_id / line_item_id を宣言していたが、
-- 対応する migration ファイルが存在せず（dev には手動 ALTER で入っていた）、本番 Neon に
-- 未適用だった。全 Neon を schema.ts に揃えるため、ここで冪等に追加する。
--
-- いずれも nullable な uuid。FK は付けない（schema.ts も .references を持たない＝
-- drizzle の循環参照回避のため text/uuid のみで来歴を保持する設計）。

ALTER TABLE part_movements ADD COLUMN IF NOT EXISTS maintenance_id uuid;
ALTER TABLE part_movements ADD COLUMN IF NOT EXISTS line_item_id   uuid;
