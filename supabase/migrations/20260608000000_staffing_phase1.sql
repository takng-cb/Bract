-- staffing Phase1（#15 / REQ-0005）：既存テーブルへの追加カラム + outreach/invoices/events
-- 冪等。全 Neon に適用可（未使用業種でも nullable/DEFAULT で無害）。

-- accounts（クライアント=client / 紹介会社=supplier の拡張）
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS line_type text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS specialties jsonb;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS contact_person text;

-- staff（人材）
ALTER TABLE staff ADD COLUMN IF NOT EXISTS default_fixed_rate numeric;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_repeat boolean DEFAULT false;

-- assignments（案件）
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS raw_message text;

-- assignment_staff（候補）
ALTER TABLE assignment_staff ADD COLUMN IF NOT EXISTS agency_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;
ALTER TABLE assignment_staff ADD COLUMN IF NOT EXISTS proposed_rate numeric;
ALTER TABLE assignment_staff ADD COLUMN IF NOT EXISTS talent_name text;
ALTER TABLE assignment_staff ADD COLUMN IF NOT EXISTS candidate_status text DEFAULT '候補';

-- outreach（打診 / RFQ）
CREATE TABLE IF NOT EXISTS outreach (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  agency_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT '打診済',
  sent_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- invoices（売上・請求）
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid REFERENCES assignments(id) ON DELETE SET NULL,
  candidate_id uuid REFERENCES assignment_staff(id) ON DELETE SET NULL,
  billing_amount numeric,
  payment_amount numeric,
  margin numeric,
  billing_status text NOT NULL DEFAULT '未請求',
  payment_status text NOT NULL DEFAULT '未払',
  billed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- events（予定。自動リマインドは MVP 外＝ADR-0011）
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid REFERENCES assignments(id) ON DELETE SET NULL,
  type text,
  title text,
  start_at timestamptz,
  end_at timestamptz,
  reminder_offsets jsonb,
  reminded boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
