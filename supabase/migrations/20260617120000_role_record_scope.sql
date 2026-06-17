-- レコードスコープ（REQ-0083 / ADR-0029）
-- role_permissions に read_scope / write_scope を追加。
--   'all' = 全件（既定・現挙動）/ 'own' = owner_id が自分のレコードのみ（将来 'team'）。
-- 冪等。全 Neon に適用（CLAUDE.md「全 Neon に全マイグレ」）。既定 'all' のため未設定業種でも無害。

ALTER TABLE role_permissions
  ADD COLUMN IF NOT EXISTS read_scope  text NOT NULL DEFAULT 'all';

ALTER TABLE role_permissions
  ADD COLUMN IF NOT EXISTS write_scope text NOT NULL DEFAULT 'all';
