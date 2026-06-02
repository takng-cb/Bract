-- ダッシュボードウィジェットのユーザー個別設定 (Issue 補足)
--
-- user_preferences.dashboard_widgets JSON にウィジェットの ON/OFF と並び順を保持する。
-- 形式:
--   { "widget_id": { "enabled": true|false, "order": number } }
--
-- 未設定なら DASHBOARD_WIDGETS 定義の defaultEnabled に従う。

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS dashboard_widgets jsonb;
