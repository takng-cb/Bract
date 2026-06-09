-- AI 機能のレート制限ログ（ユーザー単位・濫用/コスト対策）。
-- 方針: 冪等。全 Neon に適用（AGENTS.md）。

CREATE TABLE IF NOT EXISTS ai_rate_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_rate_log_user_idx ON ai_rate_log (user_id, created_at);
