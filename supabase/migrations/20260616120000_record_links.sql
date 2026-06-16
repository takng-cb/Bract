-- 任意レコード↔任意レコードの汎用双方向リンク（REQ-0078 / docs/data-model.md）
-- 双方向は (a_object_api:a_record_id) <= (b_object_api:b_record_id) に正規化して 1 行で格納。
-- 多態性のため FK なし（親削除時の掃除はアプリ層）。冪等。
-- 全 Neon（real-estate / auto-body / dev）に適用すること（base は破棄予定のため対象外）。

CREATE TABLE IF NOT EXISTS record_links (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  a_object_api text NOT NULL,
  a_record_id  uuid NOT NULL,
  b_object_api text NOT NULL,
  b_record_id  uuid NOT NULL,
  created_by   uuid,
  created_at   timestamptz DEFAULT now()
);

-- 同一ペアの二重登録を禁止（双方向は正規化済みのため 1 行）
CREATE UNIQUE INDEX IF NOT EXISTS record_links_pair_uniq
  ON record_links (a_object_api, a_record_id, b_object_api, b_record_id);

-- どちらの端からも引けるよう両側に index
CREATE INDEX IF NOT EXISTS record_links_a_idx ON record_links (a_object_api, a_record_id);
CREATE INDEX IF NOT EXISTS record_links_b_idx ON record_links (b_object_api, b_record_id);
