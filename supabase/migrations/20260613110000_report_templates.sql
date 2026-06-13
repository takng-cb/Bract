-- 業務報告テンプレート（#88 Phase 1 / ADR-0025 / REQ-0072）
-- レポート生成時に使う「書式＝AI へのシステムプロンプト断片」を保存する。
-- owner_id = NULL は全員共有テンプレ（編集は admin のみ・アプリ層で制御）。
-- テンプレが 0 件でもコード側にデフォルト 1 本を内蔵するため、本テーブルは任意。
-- 全 Neon（base / real-estate / auto-body / dev）に適用すること。

CREATE TABLE IF NOT EXISTS report_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  body        text NOT NULL,
  owner_id    uuid,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- 自分のテンプレ＋共有テンプレを引く用途のインデックス（owner_id IS NULL も拾う）
CREATE INDEX IF NOT EXISTS report_templates_owner_idx ON report_templates (owner_id);
