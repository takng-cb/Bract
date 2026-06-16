-- プロジェクト管理モジュール（REQ-0080）。用地取得〜開発〜販売を束ねる案件単位。
-- inventory 同様の業種非依存 ERP モジュール。src/lib/schema.ts に定義＝check:schema 追跡対象。
-- そのため全運用 Neon に適用が必要（dev / real-estate / auto-body。base は破棄予定のため対象外）。冪等。

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
