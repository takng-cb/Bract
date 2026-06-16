-- ユーザーごとのテーマ設定（REQ-0079）
-- theme_color: ブランド/アクセント色プリセットのキー（'green'(既定) | 'blue' | 'violet' | 'rose' | 'amber' | 'teal'）
-- theme_mode:  'light' | 'dark' | 'system'（既定は system = OS 設定追従）
-- どちらも nullable。未設定なら green / system として扱う（アプリ層）。
-- 全 Neon（base / real-estate / auto-body / dev）に適用すること。

ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS theme_color text;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS theme_mode  text;
