-- 不動産プロジェクト（REQ-0080）。real-estate オーバーレイの案件単位。
-- 商談を参考にした専用リッチ画面で扱う。FK は accounts/contacts に set null。
-- properties と同じく industry 専用テーブル（src/industries/real-estate/schema.ts）で、
-- check:schema（src/lib/schema.ts のみ走査）の対象外。冪等。
-- 運用 Neon に適用（dev / real-estate / auto-body。base は破棄予定のため対象外）。

CREATE TABLE IF NOT EXISTS projects (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  status           text NOT NULL DEFAULT '計画',
  project_type     text,
  account_id       uuid REFERENCES accounts(id) ON DELETE SET NULL,
  contact_id       uuid REFERENCES contacts(id) ON DELETE SET NULL,
  location         text,
  start_date       date,
  end_date         date,
  budget           numeric,
  expected_revenue numeric,
  actual_cost      numeric NOT NULL DEFAULT 0,
  description      text,
  owner_id         uuid,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_account_idx ON projects (account_id);
CREATE INDEX IF NOT EXISTS projects_status_idx  ON projects (status);
