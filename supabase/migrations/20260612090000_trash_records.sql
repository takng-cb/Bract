-- レコードのゴミ箱（REQ-0047）
-- 削除時にレコード全体を to_jsonb で退避し、復元（jsonb_populate_record）と
-- 保持期限切れの自動削除を可能にする。冪等。全 Neon に適用すること。

CREATE TABLE IF NOT EXISTS trash_records (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type  text NOT NULL,          -- 物理テーブル名（restore の whitelist と一致）
  object_label text NOT NULL,          -- 表示用ブック名（例: 取引先 / カスタム: 予約）
  record_id    uuid NOT NULL,
  label        text NOT NULL,          -- レコード表示名
  payload      jsonb NOT NULL,         -- to_jsonb(row)
  deleted_by   uuid,
  deleted_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trash_records_deleted_at_idx ON trash_records (deleted_at);
CREATE INDEX IF NOT EXISTS trash_records_deleted_by_idx ON trash_records (deleted_by, deleted_at);
