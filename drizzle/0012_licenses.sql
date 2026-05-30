-- ライセンス制御テーブル (Issue #67 Phase 1)
--
-- 1 行 = 1 テナントの契約状態。現状は単一テナント運用 (tenant_key='default') だが、
-- 将来のマルチテナント化に備えて tenant_key を持つ。
--
-- features は JSON で機能フラグを保持:
--   {
--     ai_summary:        boolean,
--     line_integration:  boolean,
--     extra_industries:  string[],
--     custom_documents:  boolean,
--     max_users:         number | null,    -- null = 無制限
--     max_storage_mb:    number | null
--   }

CREATE TABLE IF NOT EXISTS licenses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_key      text NOT NULL UNIQUE DEFAULT 'default',
  plan            text NOT NULL DEFAULT 'starter',
  features        jsonb NOT NULL DEFAULT '{}'::jsonb,
  industry_main   text,
  status          text NOT NULL DEFAULT 'active',
  starts_at       timestamp with time zone,
  expires_at      timestamp with time zone,
  stripe_subscription_id text,
  notes           text,
  created_at      timestamp with time zone DEFAULT NOW(),
  updated_at      timestamp with time zone DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS licenses_tenant_key_idx ON licenses (tenant_key);
CREATE INDEX IF NOT EXISTS licenses_status_idx     ON licenses (status);

-- 初期データ: default テナント (現状の運用想定)
-- features は空。env (AI_FEATURE_ENABLED 等) が引き続き優先される。
INSERT INTO licenses (tenant_key, plan, features, status)
VALUES ('default', 'starter', '{}'::jsonb, 'active')
ON CONFLICT (tenant_key) DO NOTHING;
