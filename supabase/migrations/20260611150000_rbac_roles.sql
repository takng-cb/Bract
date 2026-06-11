-- RBAC: ロール × ブック別 CRUD 権限（REQ-0031 / ADR-0023）
--
-- roles: ロール定義。既存の admin/editor/viewer は is_system=true の system ロールとして
--        行を持たせ後方互換（削除・改名不可。権限マトリクスも固定）。
-- role_permissions: ロールごとの「ブック単位 CRUD」。book_api='*' はワイルドカード既定で、
--        ブック個別行があればそちらが優先。
-- users.role_id: ユーザーへのロール割当。NULL の間は users.role（テキスト）に
--        フォールバック＝挙動非変更（ストラングラー）。
--
-- 全 Neon に冪等適用すること（schema.ts は全業種共有）。

CREATE TABLE IF NOT EXISTS roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  description text,
  is_system   boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id    uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  book_api   text NOT NULL,                 -- object_definitions.api_name / typed テーブル名 / '*'
  can_create boolean NOT NULL DEFAULT false,
  can_read   boolean NOT NULL DEFAULT false,
  can_update boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  PRIMARY KEY (role_id, book_api)
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES roles(id) ON DELETE SET NULL;

-- system ロールの seed（冪等）
INSERT INTO roles (name, description, is_system) VALUES
  ('admin',  '全権（システム管理者）', true),
  ('editor', '全ブックの作成・閲覧・更新・削除', true),
  ('viewer', '全ブックの閲覧のみ', true)
ON CONFLICT (name) DO NOTHING;

-- system ロールのワイルドカード権限（冪等）
INSERT INTO role_permissions (role_id, book_api, can_create, can_read, can_update, can_delete)
SELECT id, '*', true, true, true, true FROM roles WHERE name IN ('admin', 'editor')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, book_api, can_create, can_read, can_update, can_delete)
SELECT id, '*', false, true, false, false FROM roles WHERE name = 'viewer'
ON CONFLICT DO NOTHING;

-- 既存ユーザーの role_id を users.role テキストから backfill（冪等）
UPDATE users SET role_id = r.id
FROM roles r
WHERE users.role_id IS NULL AND r.name = users.role;
