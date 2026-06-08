-- 案件の表示名（REQ-0017）。冪等・追加のみ。
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS title text;
