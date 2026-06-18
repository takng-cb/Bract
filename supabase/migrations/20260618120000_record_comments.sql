-- レコードコメント（REQ-0084 Phase3）
--   外部ユーザー（grant あり）・社内ユーザー（閲覧可）がレコードにコメントを残す。
-- 冪等。全 Neon に適用（CLAUDE.md「全 Neon に全マイグレ」）。既定は無影響（行なし）。

CREATE TABLE IF NOT EXISTS record_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_api  text        NOT NULL,
  record_id   uuid        NOT NULL,
  author_id   uuid        NOT NULL,
  body        text        NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS record_comments_record_idx
  ON record_comments (object_api, record_id, created_at);
