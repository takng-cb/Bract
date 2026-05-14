-- ============================================================
-- Phase 1: 関連レコード junction テーブル導入
-- ============================================================
-- 目的:
--   activities / tasks / expenses を「複数の任意オブジェクトのレコード」と
--   紐づけられるよう、多態性 junction テーブルを追加する。標準オブジェクト
--   (account/contact/opportunity) もカスタムオブジェクトも同じスキーマで扱う。
--
--   既存の account_id / contact_id / opportunity_id / custom_record_id 列は
--   Phase 1 では残存させ、dual-write で互換性を維持する。
--
--   activity_contacts は activity_related_records (related_object_api='contact')
--   に統合のため廃止する。
--
-- related_object_api の取りうる値:
--   - 'account' / 'contact' / 'opportunity'        標準オブジェクト
--   - object_definitions.api_name                  カスタムオブジェクト
--
-- 多態性のため FK 制約は付けない。レコード削除時のクリーンアップは app 層で
-- 行う想定（accounts/contacts/opportunities/custom_records の delete 時に
-- 対応する junction 行も削除する。Phase 2 で trigger 化検討）。
--
-- 注: scripts/apply-migration.ts は ; で文を分割して個別に実行するため、
-- BEGIN; ... COMMIT; を書いてもトランザクションは形成されない。各文は
-- それぞれ独立した暗黙トランザクションとして実行される。
--
-- 冪等性:
--   - CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS: 再実行 OK
--   - INSERT ... ON CONFLICT DO NOTHING: 再実行 OK
--   - INSERT FROM activity_contacts: 再実行不可（DROP 後はテーブルが
--     存在しないため失敗する）。一度成功した後の再実行は失敗するが、
--     既に backfill 済みなので問題なし。
--   - DROP TABLE IF EXISTS: 再実行 OK
-- ============================================================

-- 1. 新しい junction テーブルを作成 -----------------------------------

CREATE TABLE IF NOT EXISTS activity_related_records (
  activity_id        uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  related_object_api text NOT NULL,
  related_record_id  uuid NOT NULL,
  created_at         timestamp with time zone DEFAULT now(),
  PRIMARY KEY (activity_id, related_object_api, related_record_id)
);
CREATE INDEX IF NOT EXISTS activity_related_lookup_idx
  ON activity_related_records (related_object_api, related_record_id);

CREATE TABLE IF NOT EXISTS task_related_records (
  task_id            uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  related_object_api text NOT NULL,
  related_record_id  uuid NOT NULL,
  created_at         timestamp with time zone DEFAULT now(),
  PRIMARY KEY (task_id, related_object_api, related_record_id)
);
CREATE INDEX IF NOT EXISTS task_related_lookup_idx
  ON task_related_records (related_object_api, related_record_id);

CREATE TABLE IF NOT EXISTS expense_related_records (
  expense_id         uuid NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  related_object_api text NOT NULL,
  related_record_id  uuid NOT NULL,
  created_at         timestamp with time zone DEFAULT now(),
  PRIMARY KEY (expense_id, related_object_api, related_record_id)
);
CREATE INDEX IF NOT EXISTS expense_related_lookup_idx
  ON expense_related_records (related_object_api, related_record_id);

-- 2. 既存 FK 列からバックフィル --------------------------------------

-- 活動
INSERT INTO activity_related_records (activity_id, related_object_api, related_record_id)
  SELECT id, 'account', account_id FROM activities WHERE account_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO activity_related_records (activity_id, related_object_api, related_record_id)
  SELECT id, 'contact', contact_id FROM activities WHERE contact_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO activity_related_records (activity_id, related_object_api, related_record_id)
  SELECT id, 'opportunity', opportunity_id FROM activities WHERE opportunity_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- activity_contacts （複数人物の中間テーブル）も取り込む。
-- 注: Phase 1 Step A 時点では activity_contacts は残存させる。後続コミット
-- で 5 ファイル（actions/admin, actions/activities, activities/[id]/page,
-- activities/[id]/edit/page, schema）を junction 対応に移行してから
-- activity_contacts を DROP する。
INSERT INTO activity_related_records (activity_id, related_object_api, related_record_id)
  SELECT activity_id, 'contact', contact_id FROM activity_contacts
ON CONFLICT DO NOTHING;

-- 活動の custom_record_id → object_definitions.api_name 経由で解決
INSERT INTO activity_related_records (activity_id, related_object_api, related_record_id)
  SELECT a.id, od.api_name, a.custom_record_id
  FROM activities a
  JOIN custom_records cr      ON cr.id = a.custom_record_id
  JOIN object_definitions od  ON od.id = cr.object_id
  WHERE a.custom_record_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- タスク
INSERT INTO task_related_records (task_id, related_object_api, related_record_id)
  SELECT id, 'account', account_id FROM tasks WHERE account_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO task_related_records (task_id, related_object_api, related_record_id)
  SELECT id, 'contact', contact_id FROM tasks WHERE contact_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO task_related_records (task_id, related_object_api, related_record_id)
  SELECT id, 'opportunity', opportunity_id FROM tasks WHERE opportunity_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO task_related_records (task_id, related_object_api, related_record_id)
  SELECT t.id, od.api_name, t.custom_record_id
  FROM tasks t
  JOIN custom_records cr      ON cr.id = t.custom_record_id
  JOIN object_definitions od  ON od.id = cr.object_id
  WHERE t.custom_record_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 経費
INSERT INTO expense_related_records (expense_id, related_object_api, related_record_id)
  SELECT id, 'account', account_id FROM expenses WHERE account_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO expense_related_records (expense_id, related_object_api, related_record_id)
  SELECT id, 'contact', contact_id FROM expenses WHERE contact_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO expense_related_records (expense_id, related_object_api, related_record_id)
  SELECT id, 'opportunity', opportunity_id FROM expenses WHERE opportunity_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO expense_related_records (expense_id, related_object_api, related_record_id)
  SELECT e.id, od.api_name, e.custom_record_id
  FROM expenses e
  JOIN custom_records cr      ON cr.id = e.custom_record_id
  JOIN object_definitions od  ON od.id = cr.object_id
  WHERE e.custom_record_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. activity_contacts の廃止は Phase 1 後続コミットで実施
-- （5 ファイルのコード移行が完了してから DROP）

-- 完了: 以下のクエリで件数を確認できます
--   SELECT count(*) FROM activity_related_records;
--   SELECT count(*) FROM task_related_records;
--   SELECT count(*) FROM expense_related_records;
