-- tasks に owner_id (担当者) を追加。
-- auth.users への参照 (FK は張らずに UUID を保持)。

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS owner_id uuid;
