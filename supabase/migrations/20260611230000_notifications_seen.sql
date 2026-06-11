-- 通知ベルの既読タイムスタンプ方式（REQ-0040）
-- ベルを開いた時刻のみ保持し、通知の中身はその場で集計する（notifications テーブルは作らない）。
-- 冪等。全 Neon に適用すること。

ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS notifications_seen_at timestamptz;
