-- 経費にレシート項目を追加（#134 Phase A / ADR-0026）
-- vendor: 支払先（店名・会社名）
-- tax_rate: 税率（%）。Bract は消費税を計算しない（項目として保持のみ）
-- invoice_reg_no: インボイス登録番号（T+13桁。形式チェックのみ・真正性検証はしない）
-- 全 Neon（base / real-estate / auto-body / dev）に適用すること。

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vendor text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS tax_rate numeric;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS invoice_reg_no text;
