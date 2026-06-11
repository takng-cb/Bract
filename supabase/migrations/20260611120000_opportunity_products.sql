-- 商談の商品明細（opportunity_products）#5 / REQ
--
-- 商談レコードに「商品系のレコード」を明細として紐付ける専用テーブル。
-- 紐付け先は polymorphic（product_object_api + product_record_id）で、商品(products)・
-- 部品(parts) 等を選べる。name は選択時点のスナップショット（参照先が変わっても表示が壊れない）。
-- quantity / unit_price を持ち、見積明細として金額集計に使える。
--
-- 全 Neon に冪等適用すること（schema.ts は全業種共有）。未使用業種では空のままで害はない。

CREATE TABLE IF NOT EXISTS opportunity_products (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id     uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  product_object_api text NOT NULL DEFAULT 'product',  -- 'product' | 'part' | 将来の商品系ブック
  product_record_id  uuid,                              -- 紐付け先レコード（フリー入力明細なら NULL）
  name               text NOT NULL,                     -- 表示名スナップショット
  quantity           numeric NOT NULL DEFAULT 1,
  unit_price         numeric,
  note               text,
  sort_order         integer NOT NULL DEFAULT 0,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS opportunity_products_opp_idx ON opportunity_products(opportunity_id);
