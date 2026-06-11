-- レコード承認 Phase2（REQ-0037 / #85）: ステータス遷移トリガー
-- 承認完了時に適用するステータス変更 { field, from, to } を保持する。null = 手動申請。
-- 冪等。全 Neon に適用すること。

ALTER TABLE approvals ADD COLUMN IF NOT EXISTS transition jsonb;
