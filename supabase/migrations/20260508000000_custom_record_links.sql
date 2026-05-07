-- ──────────────────────────────────────────────────────────────────────
-- カスタムレコードへの活動履歴・ToDo・経費の紐付け
-- 商談への人物参照の追加
-- ──────────────────────────────────────────────────────────────────────

-- 1. 商談に人物（担当者）参照を追加
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL;

-- 2. 活動履歴にカスタムレコード参照を追加
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS custom_record_id uuid REFERENCES custom_records(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS activities_custom_record_idx ON activities(custom_record_id);

-- 3. ToDo にカスタムレコード参照を追加
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS custom_record_id uuid REFERENCES custom_records(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS tasks_custom_record_idx ON tasks(custom_record_id);

-- 4. 経費にカスタムレコード参照を追加
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS custom_record_id uuid REFERENCES custom_records(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS expenses_custom_record_idx ON expenses(custom_record_id);

-- 5. オブジェクト定義に機能切り替えフラグを追加
ALTER TABLE object_definitions
  ADD COLUMN IF NOT EXISTS enable_activities boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enable_tasks      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enable_expenses   boolean NOT NULL DEFAULT false;
