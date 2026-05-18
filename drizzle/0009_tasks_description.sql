-- tasks に description カラム（詳細・メモ）を追加。
-- 任意・複数行テキスト想定。

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS description text;
