-- /admin/objects に「入出庫」を出すため、part_movements の object_definitions 行を追加。
-- nav_enabled=false にしているのでサイドバーには出ない（履歴は parts 詳細から閲覧する想定）。

INSERT INTO object_definitions (
  api_name, label, label_plural, icon,
  is_builtin, nav_enabled, sort_order,
  enable_activities, enable_tasks, enable_expenses
)
VALUES (
  'part_movements', '入出庫', '入出庫履歴', '📦',
  false, false, 120,
  false, false, false
)
ON CONFLICT (api_name) DO NOTHING;
