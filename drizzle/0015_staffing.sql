-- 人材アテンド業向け業種オーバーレイ (Issue #69 Phase 1)
--
-- accounts に account_role 列を追加し、人材会社 (supplier) と派遣先 (client) を識別。
-- staff (スタッフマスタ) と assignments (案件)、assignment_staff (案件→スタッフ junction) を新設。

-- 1. accounts に役割列を追加
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS account_role text;
  -- 'supplier' (人材会社) / 'client' (派遣先) / 'both' / NULL
  -- staffing 業種 UI でのみ意味を持つ

-- 2. staff (スタッフマスタ)
CREATE TABLE IF NOT EXISTS staff (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  belong_account_id      uuid REFERENCES accounts(id) ON DELETE SET NULL,
                              -- 所属人材会社 (supplier)
  name                   text NOT NULL,
  name_kana              text,
  gender                 text,         -- '男'/'女'/'その他'/NULL
  birth_date             date,
  phone                  text,
  email                  text,
  skills                 jsonb,        -- ['介護初任者研修','英語','接客5年']
  available_areas        jsonb,        -- ['東京','神奈川','埼玉']
  default_hourly_rate    numeric,      -- 標準時給 (顧客向け請求の参考値)
  default_cost_per_hour  numeric,      -- 標準仕入時給 (人材会社への支払)
  photo_url              text,
  status                 text NOT NULL DEFAULT '稼働中',
                              -- '稼働中'/'一時休止'/'引退'
  notes                  text,
  owner_id               uuid,
  created_at             timestamp with time zone DEFAULT NOW(),
  updated_at             timestamp with time zone DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS staff_belong_account_idx ON staff (belong_account_id);
CREATE INDEX IF NOT EXISTS staff_status_idx         ON staff (status);

-- 3. assignments (案件 = アテンド業務の発注)
CREATE TABLE IF NOT EXISTS assignments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_no        text NOT NULL UNIQUE,  -- 'YYYYMMDD-NNN' 形式
  client_account_id    uuid REFERENCES accounts(id) ON DELETE RESTRICT,  -- 派遣先
  client_contact_id    uuid REFERENCES contacts(id) ON DELETE SET NULL,  -- 窓口担当
  service_date         date,
  service_start_time   text,             -- HH:MM
  service_end_time     text,
  service_location     text,
  service_type         text,             -- 接客/介護補助/レセプション 等
  service_description  text,
  staff_count_required integer,          -- 募集人数
  status               text NOT NULL DEFAULT '予約',
                              -- '予約'/'確定'/'実施中'/'完了'/'キャンセル'
  client_total_fee     numeric,          -- 派遣先からの受取合計
  internal_memo        text,
  owner_id             uuid,
  created_at           timestamp with time zone DEFAULT NOW(),
  updated_at           timestamp with time zone DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS assignments_client_idx ON assignments (client_account_id);
CREATE INDEX IF NOT EXISTS assignments_date_idx   ON assignments (service_date);
CREATE INDEX IF NOT EXISTS assignments_status_idx ON assignments (status);

-- 4. assignment_staff (案件への個別スタッフアサイン junction)
CREATE TABLE IF NOT EXISTS assignment_staff (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  staff_id        uuid NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  service_hours   numeric,
  hourly_rate     numeric,            -- 顧客請求時給
  cost_per_hour   numeric,            -- スタッフ仕入時給
  status          text NOT NULL DEFAULT '予約',
                              -- '予約'/'確定'/'実施'/'完了'/'キャンセル'
  notes           text,
  created_at      timestamp with time zone DEFAULT NOW(),
  UNIQUE (assignment_id, staff_id)
);

CREATE INDEX IF NOT EXISTS assignment_staff_assignment_idx ON assignment_staff (assignment_id);
CREATE INDEX IF NOT EXISTS assignment_staff_staff_idx      ON assignment_staff (staff_id);
