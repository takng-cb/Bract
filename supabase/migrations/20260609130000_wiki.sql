-- ============================================================
-- Wiki（社内ナレッジ）module — wiki_pages テーブル (Issue #78)
--
-- 適用方針（AGENTS.md「全 Neon に全マイグレを適用する」）:
--   本マイグレは base / real-estate / auto-body / 将来の業種すべての Neon に適用する。
--   wiki は platform カテゴリのモジュールであり、空のテーブルが他業種 Neon に
--   存在しても害はない（逆に無いと schema.ts の SELECT が落ちる）。
--
-- すべて冪等（IF NOT EXISTS）。
-- ============================================================

CREATE TABLE IF NOT EXISTS wiki_pages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  body       text,
  parent_id  uuid,
  owner_id   uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 自己参照 FK（階層）。親が消えたら子の parent_id は NULL（孤児化してルート扱い）。
-- drizzle 側は循環参照回避のため列をプレーン宣言しているため、FK はここで付与する。
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wiki_pages_parent_id_fkey'
  ) THEN
    ALTER TABLE wiki_pages
      ADD CONSTRAINT wiki_pages_parent_id_fkey
      FOREIGN KEY (parent_id) REFERENCES wiki_pages(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS wiki_pages_parent_idx ON wiki_pages (parent_id);
