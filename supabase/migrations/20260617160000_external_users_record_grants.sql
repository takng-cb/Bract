-- 外部ユーザー基盤（REQ-0084 / ADR-0029・Phase2）
--   users.is_external: 外部ユーザーフラグ（true=社内アプリ不可・portal のみ）
--   record_grants: 外部ユーザーへのレコード個別共有（per-record ACL）
-- 冪等。全 Neon に適用（CLAUDE.md「全 Neon に全マイグレ」）。既定は無影響（is_external=false・grants なし）。

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_external boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS record_grants (
  object_api  text        NOT NULL,
  record_id   uuid        NOT NULL,
  grantee_id  uuid        NOT NULL,
  level       text        NOT NULL DEFAULT 'read',
  granted_by  uuid,
  expires_at  timestamptz,
  created_at  timestamptz DEFAULT now(),
  PRIMARY KEY (object_api, record_id, grantee_id)
);

CREATE INDEX IF NOT EXISTS record_grants_grantee_idx ON record_grants (grantee_id);
