-- ToC（BtoC）顧客のために maintenance_records.account_id を nullable 化。
-- account_id = NULL の整備は「個人顧客」(contact_id が顧客本人) を表す。

ALTER TABLE maintenance_records
  ALTER COLUMN account_id DROP NOT NULL;
