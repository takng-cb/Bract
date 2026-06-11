-- レコード承認（REQ-0023 / ADR-0022 / #85）Phase1
-- 汎用 approval レイヤー：polymorphic（object_type, object_id）で任意レコードに付く。
-- 冪等。全 Neon に適用すること（AGENTS.md「全 Neon に全マイグレを適用する」）。

CREATE TABLE IF NOT EXISTS approvals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type    text NOT NULL,
  object_id      uuid NOT NULL,
  status         text NOT NULL DEFAULT 'pending',
  requested_by   uuid NOT NULL,
  current_step   integer NOT NULL DEFAULT 1,
  route_snapshot jsonb NOT NULL,
  comment        text,
  requested_at   timestamptz DEFAULT now(),
  decided_at     timestamptz
);

CREATE INDEX IF NOT EXISTS approvals_object_idx ON approvals (object_type, object_id, requested_at);
CREATE INDEX IF NOT EXISTS approvals_status_idx ON approvals (status);

CREATE TABLE IF NOT EXISTS approval_decisions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id uuid NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
  step        integer NOT NULL,
  approver_id uuid NOT NULL,
  decision    text NOT NULL,
  comment     text,
  decided_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS approval_decisions_approval_idx ON approval_decisions (approval_id);
