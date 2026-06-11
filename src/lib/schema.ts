import {
  pgTable,
  uuid,
  text,
  numeric,
  integer,
  boolean,
  date,
  bigint,
  timestamp,
  unique,
  index,
  jsonb,
  primaryKey,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ----------------------------------------------------------------
// accounts（取引先企業）
// ----------------------------------------------------------------
export const accounts = pgTable('accounts', {
  id:             uuid('id').primaryKey().defaultRandom(),
  name:           text('name').notNull(),
  industry:       text('industry'),
  phone:          text('phone'),
  website:        text('website'),
  address:        text('address'),
  status:         text('status').notNull().default('active'),
  type:           text('type'),
  // staffing 業種オーバーレイ用 (Issue #69):
  //   'supplier' (人材会社) / 'client' (派遣先) / 'both' / NULL
  account_role:   text('account_role'),
  line_type:      text('line_type'),       // staffing: 'individual'|'official'（LINE種別）
  specialties:    jsonb('specialties'),    // staffing: 紹介会社の得意領域
  contact_person: text('contact_person'),  // 主担当者名（簡易）
  annual_revenue: numeric('annual_revenue'),
  employee_count: integer('employee_count'),
  description:    text('description'),
  owner_id:       uuid('owner_id'),
  created_at:     timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:     timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// contacts（担当者）
// ----------------------------------------------------------------
export const contacts = pgTable('contacts', {
  id:           uuid('id').primaryKey().defaultRandom(),
  account_id:   uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  contact_type: text('contact_type').notNull().default('business'), // 'business' | 'consumer'
  full_name:    text('full_name').notNull(),
  email:        text('email'),
  phone:        text('phone'),
  title:        text('title'),
  department:   text('department'),
  birthday:     date('birthday'),
  description:  text('description'),
  owner_id:     uuid('owner_id'),
  created_at:   timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:   timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// opportunities（商談）
// ----------------------------------------------------------------
export const opportunities = pgTable('opportunities', {
  id:          uuid('id').primaryKey().defaultRandom(),
  account_id:  uuid('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
  contact_id:  uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  name:        text('name').notNull(),
  stage:       text('stage').notNull().default('prospecting'),
  amount:      numeric('amount'),
  probability: integer('probability'),
  close_date:  date('close_date'),
  description: text('description'),
  owner_id:    uuid('owner_id'),
  // ─── 業種オーバーレイ：不動産業（INDUSTRY=real-estate のときのみ UI で使用） ───
  // 共通テーブルに置く理由は industry/real-estate Neon に既存データが存在するため。
  // base モードでは未使用（UI に出ないし、書き込みも発生しない）。
  // 取引区分（'売買' | '賃貸'）
  transaction_type: text('transaction_type').notNull().default('売買'),
  // 仲介手数料（円、税抜）
  commission_fee:  numeric('commission_fee'),
  // 仲介種別（売買: '両手'|'売り'|'買い' / 賃貸: '両手'|'貸主'|'借主'）
  brokerage_type:  text('brokerage_type'),
  // その他利益（円、税抜）
  other_profit:    numeric('other_profit').notNull().default('0'),
  // ─── 業種オーバーレイ：板金屋・自動車整備業（INDUSTRY=auto-body のときのみ UI で使用） ───
  // service_type: '車両販売' | '板金修理' | '整備' | '車検' | 'その他'
  service_type: text('service_type'),
  // 対象車両への参照（vehicles テーブル、auto-body 用）。型は uuid だが他業種で vehicles 不在のためビルド時 references を使わない。
  vehicle_id:   uuid('vehicle_id'),
  // 部品仕入原価（円、税抜）。利益 = amount - parts_cost
  parts_cost:   numeric('parts_cost').notNull().default('0'),
  created_at:  timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:  timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// activities（活動履歴）
// ----------------------------------------------------------------
export const activities = pgTable('activities', {
  id:          uuid('id').primaryKey().defaultRandom(),
  type:        text('type').notNull(),
  subject:     text('subject').notNull(),
  body:        text('body'),
  occurred_at: timestamp('occurred_at', { withTimezone: true }).defaultNow(),
  owner_id:    uuid('owner_id'),
  created_at:  timestamp('created_at', { withTimezone: true }).defaultNow(),
  // 関連先は activity_related_records junction で管理（Phase 2 で FK 列撤廃）
})

// ----------------------------------------------------------------
// activity_related_records（活動 ↔ 関連レコード 多態性 junction）
//
// activities/tasks/expenses が「複数の任意オブジェクトのレコード」と
// 紐づくための多態性関連テーブル。標準オブジェクト（account/contact/
// opportunity）もカスタムオブジェクトも同じスキーマで扱う。
//
// related_object_api の値:
//   - 'account' / 'contact' / 'opportunity'（標準オブジェクト）
//   - object_definitions.api_name（カスタムオブジェクト、例: 'properties'）
//
// related_record_id の参照先:
//   - 標準: それぞれの accounts/contacts/opportunities テーブルの id
//   - カスタム: custom_records.id
//
// FK 制約は多態性のため設定できない。レコード削除時のクリーンアップは
// app 層で実施する（accounts/contacts/opportunities/custom_records の
// delete 時に対応する junction 行も削除）。
// ----------------------------------------------------------------
export const activity_related_records = pgTable('activity_related_records', {
  activity_id:        uuid('activity_id').notNull().references(() => activities.id, { onDelete: 'cascade' }),
  related_object_api: text('related_object_api').notNull(),
  related_record_id:  uuid('related_record_id').notNull(),
  created_at:         timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.activity_id, t.related_object_api, t.related_record_id] }),
  index('activity_related_lookup_idx').on(t.related_object_api, t.related_record_id),
])

// ----------------------------------------------------------------
// task_related_records（タスク ↔ 関連レコード）— activity_related_records と同じスキーマ
// ----------------------------------------------------------------
export const task_related_records = pgTable('task_related_records', {
  task_id:            uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  related_object_api: text('related_object_api').notNull(),
  related_record_id:  uuid('related_record_id').notNull(),
  created_at:         timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.task_id, t.related_object_api, t.related_record_id] }),
  index('task_related_lookup_idx').on(t.related_object_api, t.related_record_id),
])

// ----------------------------------------------------------------
// expense_related_records（経費 ↔ 関連レコード）— activity_related_records と同じスキーマ
// ----------------------------------------------------------------
export const expense_related_records = pgTable('expense_related_records', {
  expense_id:         uuid('expense_id').notNull().references(() => expenses.id, { onDelete: 'cascade' }),
  related_object_api: text('related_object_api').notNull(),
  related_record_id:  uuid('related_record_id').notNull(),
  created_at:         timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.expense_id, t.related_object_api, t.related_record_id] }),
  index('expense_related_lookup_idx').on(t.related_object_api, t.related_record_id),
])

// ----------------------------------------------------------------
// tasks（タスク / ToDo）
// ----------------------------------------------------------------
export const tasks = pgTable('tasks', {
  id:          uuid('id').primaryKey().defaultRandom(),
  title:       text('title').notNull(),
  description: text('description'),                                    // 詳細・メモ（任意・複数行）
  due_date:    date('due_date'),
  done:        boolean('done').notNull().default(false),
  priority:    text('priority').notNull().default('medium'),
  owner_id:    uuid('owner_id'),                                       // 担当者 (auth user id)
  created_at:  timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:  timestamp('updated_at', { withTimezone: true }).defaultNow(),
  // 関連先は task_related_records junction で管理（Phase 2 で FK 列撤廃）
})

// ----------------------------------------------------------------
// attachments（添付ファイルのメタデータ）
// ----------------------------------------------------------------
export const attachments = pgTable('attachments', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  file_name:           text('file_name').notNull(),
  storage_path:        text('storage_path').notNull(),
  file_size:           bigint('file_size', { mode: 'number' }),
  content_type:        text('content_type'),
  account_id:          uuid('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
  contact_id:          uuid('contact_id').references(() => contacts.id, { onDelete: 'cascade' }),
  opportunity_id:      uuid('opportunity_id').references(() => opportunities.id, { onDelete: 'cascade' }),
  activity_id:         uuid('activity_id').references(() => activities.id, { onDelete: 'cascade' }),
  // auto-body オブジェクトへの紐付け (#46 関連)
  // FK は migration 0017 で定義済み。auto-body Neon にのみ参照先テーブルが
  // 存在する設計のため、Drizzle 側で .references() は付けず column 宣言のみ。
  maintenance_id:      uuid('maintenance_id'),
  customer_vehicle_id: uuid('customer_vehicle_id'),
  created_at:          timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// expenses（経費申請）
// ----------------------------------------------------------------
export const expenses = pgTable('expenses', {
  id:           uuid('id').primaryKey().defaultRandom(),
  title:        text('title').notNull(),
  amount:       numeric('amount').notNull(),
  category:     text('category').notNull().default('その他'),
  expense_date: date('expense_date').notNull(),
  notes:        text('notes'),
  created_at:   timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:   timestamp('updated_at', { withTimezone: true }).defaultNow(),
  // 関連先は expense_related_records junction で管理（Phase 2 で FK 列撤廃）
})

// ----------------------------------------------------------------
// vehicles（車両）— 業種オーバーレイ：板金屋・自動車整備業
//   INDUSTRY=auto-body のときのみ UI で使用。base モードでは未使用。
// ----------------------------------------------------------------
export const vehicles = pgTable('vehicles', {
  id:            uuid('id').primaryKey().defaultRandom(),
  // 車両情報
  maker:         text('maker').notNull(),
  model:         text('model').notNull(),
  year:          integer('year'),
  mileage:       integer('mileage'),
  color:         text('color'),
  license_plate: text('license_plate'),
  vin:           text('vin'),
  // 状態
  status:        text('status').notNull().default('在庫'),
  // 仕入
  purchase_date:        date('purchase_date'),
  purchase_price:       numeric('purchase_price'),
  supplier_account_id:  uuid('supplier_account_id').references(() => accounts.id, { onDelete: 'set null' }),
  // 販売
  sale_price:           numeric('sale_price'),
  sold_date:            date('sold_date'),
  sold_price:           numeric('sold_price'),
  buyer_account_id:     uuid('buyer_account_id').references(() => accounts.id, { onDelete: 'set null' }),
  // 車検
  next_inspection_date: date('next_inspection_date'),
  // メタ
  description:   text('description'),
  owner_id:      uuid('owner_id'),
  created_at:    timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:    timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const vehiclesRelations = relations(vehicles, ({ one }) => ({
  supplier: one(accounts, { fields: [vehicles.supplier_account_id], references: [accounts.id], relationName: 'vehicle_supplier' }),
  buyer:    one(accounts, { fields: [vehicles.buyer_account_id],    references: [accounts.id], relationName: 'vehicle_buyer' }),
}))

// ----------------------------------------------------------------
// parts（部品マスタ）— 業種オーバーレイ：板金屋・自動車整備業
//   INDUSTRY=auto-body のときのみ UI で使用
// ----------------------------------------------------------------
export const parts = pgTable('parts', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  part_number:         text('part_number').notNull().unique(),
  name:                text('name').notNull(),
  category:            text('category'),
  supplier_account_id: uuid('supplier_account_id').references(() => accounts.id, { onDelete: 'set null' }),
  unit_price:          numeric('unit_price'),
  description:         text('description'),
  reorder_level:       integer('reorder_level').notNull().default(0),
  owner_id:            uuid('owner_id'),
  created_at:          timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:          timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// part_movements（部品入出庫履歴）— 業種オーバーレイ：auto-body
// ----------------------------------------------------------------
export const part_movements = pgTable('part_movements', {
  id:             uuid('id').primaryKey().defaultRandom(),
  part_id:        uuid('part_id').notNull().references(() => parts.id, { onDelete: 'cascade' }),
  movement_type:  text('movement_type').notNull(),
  quantity:       integer('quantity').notNull(),
  unit_price:     numeric('unit_price'),
  occurred_at:    date('occurred_at').notNull().defaultNow(),
  opportunity_id: uuid('opportunity_id'),
  vehicle_id:     uuid('vehicle_id'),
  // 整備とのリンク (Issue #47 Phase 2)
  //   整備の作業項目に部品をセットすると自動的に出庫レコードが作られる。
  //   ここに maintenance_id / line_item_id を持たせて来歴を辿れるようにする。
  maintenance_id: uuid('maintenance_id'),  // FK は migration 側 (drizzle 循環参照回避のため text)
  line_item_id:   uuid('line_item_id'),
  notes:          text('notes'),
  owner_id:       uuid('owner_id'),
  created_at:     timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// customer_vehicles（顧客車両）— 業種オーバーレイ：板金屋・自動車整備業
//   既存 vehicles（在庫車両・売り物）と別物。整備対象として顧客が持ち込む車。
//   account_id = 車両の所有者（顧客）。
//   INDUSTRY=auto-body のときのみ UI で使用。
// ----------------------------------------------------------------
export const customer_vehicles = pgTable('customer_vehicles', {
  id:                       uuid('id').primaryKey().defaultRandom(),
  // 所有者: BtoB は account_id（会社）、BtoC は contact_id（本人）。
  // どちらか一方が入る運用（アプリ層で検証）。
  account_id:               uuid('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
  contact_id:               uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  // ナンバープレート
  transport_branch:         text('transport_branch'),       // 運輸支局
  classification_number:    text('classification_number'),  // 分類番号
  kana:                     text('kana'),                   // かな
  plate_number:             text('plate_number'),           // 車両番号（ナンバー）
  // 車名・型式
  car_name:                 text('car_name'),               // 車名
  car_model:                text('car_model'),              // 車種
  grade:                    text('grade'),                  // グレード
  vehicle_kind:             text('vehicle_kind'),           // 種別（軽・小型・普通）
  vehicle_usage:            text('vehicle_usage'),          // 用途（乗用・貨物）
  private_business:         text('private_business'),       // 自家・事業
  body_shape:               text('body_shape'),             // 車体の形状
  vin:                      text('vin'),                    // 車台番号
  type_designation:         text('type_designation'),       // 型式指定
  class_category:           text('class_category'),         // 類別区分
  first_registration_year:  text('first_registration_year'),// 初年度年（'令和7' などの和暦テキストも受ける）
  first_registration_month: text('first_registration_month'),
  inspection_due_date:      date('inspection_due_date'),    // 車検満了日
  memo:                     text('memo'),                   // 車両メモ
  owner_id:                 uuid('owner_id'),               // 担当
  created_at:               timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:               timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// maintenance_records（整備）— 業種オーバーレイ：板金屋・自動車整備業
//   顧客車両に対する整備・車検・修理の業務記録。
//   maintenance_no は 'YYYYMMDD-NNN'（全社で日付内連番）形式で発番。
// ----------------------------------------------------------------
export const maintenance_records = pgTable('maintenance_records', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  maintenance_no:       text('maintenance_no').notNull().unique(), // 'YYYYMMDD-NNN'

  // 主体
  //   BtoB: account_id（会社）+ contact_id（窓口担当者）
  //   BtoC: account_id NULL + contact_id（本人＝顧客）
  //   いずれか必須（アプリ層で検証）。
  customer_vehicle_id:  uuid('customer_vehicle_id').notNull().references(() => customer_vehicles.id, { onDelete: 'restrict' }),
  account_id:           uuid('account_id').references(() => accounts.id, { onDelete: 'restrict' }),
  contact_id:           uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  billing_account_id:   uuid('billing_account_id').references(() => accounts.id, { onDelete: 'set null' }),

  // 日時・場所
  intake_date:          date('intake_date'),                // 入庫日
  intake_time:          text('intake_time'),                // 入庫時間（HH:MM テキスト保持）
  delivery_date:        date('delivery_date'),              // 納車日
  delivery_time:        text('delivery_time'),
  pickup_location:      text('pickup_location'),            // 引取場所
  delivery_location:    text('delivery_location'),          // 引渡場所
  sales_recording_date: date('sales_recording_date'),       // 売上計上日
  mileage:              integer('mileage'),                 // 総走行距離 km
  branch_id:            text('branch_id'),                  // 拠点（一旦 text、将来 branches テーブル化）
  intake_category:      text('intake_category'),            // 入庫区分（自由入力）
  reception_owner_id:   uuid('reception_owner_id'),         // 受付担当者
  worker_owner_id:      uuid('worker_owner_id'),            // 作業担当者

  // メモ
  internal_memo:        text('internal_memo'),              // 整備メモ（印字なし）
  work_order_note:      text('work_order_note'),            // 作業指示備考
  general_note:         text('general_note'),               // 備考

  // 外部リンク（Google Drive 等）: [{ label, url }]
  drive_links:          jsonb('drive_links'),

  // 税
  tax_mode:             text('tax_mode').notNull().default('税別10%'), // 消費税区分
  tax_rounding:         text('tax_rounding').notNull().default('切り捨て'),
  lever_rate:           numeric('lever_rate'),              // レバーレート（税別内）

  // ステータス
  status:               text('status').notNull().default('予約'), // 予約/受付/作業中/納車待ち/完了/キャンセル

  // 代車 (Issue #45)
  //   loaner_vehicle_id がセットされている間、vehicles.status は '代車中'。
  //   maintenance.status が「完了」「キャンセル」に変わったタイミングで
  //   自動的に '在庫' に戻す（アプリ層のサーバーアクションで担保）。
  loaner_vehicle_id:    uuid('loaner_vehicle_id').references(() => vehicles.id, { onDelete: 'set null' }),
  loaner_handover_at:   timestamp('loaner_handover_at', { withTimezone: true }),
  loaner_return_at:     timestamp('loaner_return_at', { withTimezone: true }),
  loaner_mileage_out:   integer('loaner_mileage_out'),
  loaner_mileage_in:    integer('loaner_mileage_in'),
  loaner_fuel_out:      text('loaner_fuel_out'),
  loaner_fuel_in:       text('loaner_fuel_in'),
  loaner_notes:         text('loaner_notes'),

  // 請求・支払 (Issue #48 Phase 2)
  //   billing_target:    請求先種別 ('顧客' / '保険会社' / 'リース会社' / 'その他')
  //   invoice_no:        請求書番号 (自由入力)
  //   invoice_issued_at: 請求書発行日
  //   payment_due_date:  支払期限
  //   payment_status:    '未請求' / '請求済' / '一部入金' / '入金済' / '貸倒'
  //   payment_terms:     支払条件 (例: '月末締め翌月末払い')
  billing_target:       text('billing_target'),
  invoice_no:           text('invoice_no'),
  invoice_issued_at:    date('invoice_issued_at'),
  payment_due_date:     date('payment_due_date'),
  payment_status:       text('payment_status'),
  payment_terms:        text('payment_terms'),

  owner_id:             uuid('owner_id'),
  created_at:           timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:           timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('maintenance_vehicle_idx').on(t.customer_vehicle_id),
  index('maintenance_account_idx').on(t.account_id),
  index('maintenance_status_idx').on(t.status),
])

// ----------------------------------------------------------------
// maintenance_line_items（整備の作業項目行）
// ----------------------------------------------------------------
export const maintenance_line_items = pgTable('maintenance_line_items', {
  id:               uuid('id').primaryKey().defaultRandom(),
  maintenance_id:   uuid('maintenance_id').notNull().references(() => maintenance_records.id, { onDelete: 'cascade' }),
  sort_order:       integer('sort_order').notNull().default(0),
  work_category:    text('work_category'),     // 作業区分
  item_name:        text('item_name'),         // 作業項目名
  hours:            numeric('hours'),          // 工数
  labor_amount:     numeric('labor_amount'),   // 作業代（税別）
  parts_qty:        numeric('parts_qty'),      // 部品数
  parts_unit:       text('parts_unit'),        // 単位
  parts_unit_price: numeric('parts_unit_price'),
  cost_unit_price:  numeric('cost_unit_price'),// 原単価（税別）
  // 部品マスタとのリンク (Issue #47 Phase 2)
  //   part_id をセットすると、整備の完了時に部品在庫から自動出庫される
  //   （actions/maintenance.ts と actions/maintenanceLineItems.ts で
  //    part_movement の生成・削除を管理）
  part_id:          uuid('part_id').references(() => parts.id, { onDelete: 'set null' }),
  note:             text('note'),              // 備考（印字なし）
  state:            text('state'),             // 状態（自由文字列、部品取置中など）
  is_excluded:      boolean('is_excluded').notNull().default(false),
  work_status:      text('work_status').notNull().default('未完了'), // 未完了/完了
  created_at:       timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('maintenance_line_idx').on(t.maintenance_id, t.sort_order),
])

// ----------------------------------------------------------------
// maintenance_fees（諸費用）
// ----------------------------------------------------------------
export const maintenance_fees = pgTable('maintenance_fees', {
  id:             uuid('id').primaryKey().defaultRandom(),
  maintenance_id: uuid('maintenance_id').notNull().references(() => maintenance_records.id, { onDelete: 'cascade' }),
  sort_order:     integer('sort_order').notNull().default(0),
  category:       text('category').notNull(),  // '課税' | '非課税'
  item_name:      text('item_name').notNull(),
  amount:         numeric('amount'),
  cost_amount:    numeric('cost_amount'),
  meta:           jsonb('meta'),               // 期間ヶ月など追加メタ
  created_at:     timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('maintenance_fee_idx').on(t.maintenance_id, t.sort_order),
])

// ----------------------------------------------------------------
// maintenance_payments（入金）
// ----------------------------------------------------------------
export const maintenance_payments = pgTable('maintenance_payments', {
  id:             uuid('id').primaryKey().defaultRandom(),
  maintenance_id: uuid('maintenance_id').notNull().references(() => maintenance_records.id, { onDelete: 'cascade' }),
  payment_method: text('payment_method').notNull(), // 現金/クレジット/銀行振込/その他
  memo:           text('memo'),
  amount:         numeric('amount').notNull(),
  payment_date:   date('payment_date').notNull(),
  owner_id:       uuid('owner_id'),                 // 入金担当者
  branch_id:      text('branch_id'),
  created_at:     timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('maintenance_payment_idx').on(t.maintenance_id),
])

// ----------------------------------------------------------------
// maintenance_templates（整備パッケージ／作業セットテンプレート）
//
// よくある作業セット（車検基本パック / オイル交換セット / 板金小傷修理 等）を
// 1 行のテンプレートにまとめ、整備の行アイテム編集画面から「テンプレを適用」
// で 1 クリック投入する。
// ----------------------------------------------------------------
export const maintenance_templates = pgTable('maintenance_templates', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        text('name').notNull(),
  description: text('description'),
  category:    text('category'),  // 車検 / 一般整備 / 板金修理 / 新車納車 等
  is_active:   boolean('is_active').notNull().default(true),
  sort_order:  integer('sort_order').notNull().default(0),
  owner_id:    uuid('owner_id'),
  created_at:  timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:  timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// テンプレートに含まれる作業行（maintenance_line_items の雛形）
export const maintenance_template_lines = pgTable('maintenance_template_lines', {
  id:               uuid('id').primaryKey().defaultRandom(),
  template_id:      uuid('template_id').notNull().references(() => maintenance_templates.id, { onDelete: 'cascade' }),
  sort_order:       integer('sort_order').notNull().default(0),
  work_category:    text('work_category'),
  item_name:        text('item_name').notNull(),
  hours:            numeric('hours'),
  labor_amount:     numeric('labor_amount'),
  parts_qty:        numeric('parts_qty'),
  parts_unit:       text('parts_unit'),
  parts_unit_price: numeric('parts_unit_price'),
  cost_unit_price:  numeric('cost_unit_price'),
  note:             text('note'),
  created_at:       timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('maintenance_tpl_line_idx').on(t.template_id, t.sort_order),
])

// テンプレートに含まれる諸費用（maintenance_fees の雛形）
export const maintenance_template_fees = pgTable('maintenance_template_fees', {
  id:           uuid('id').primaryKey().defaultRandom(),
  template_id:  uuid('template_id').notNull().references(() => maintenance_templates.id, { onDelete: 'cascade' }),
  sort_order:   integer('sort_order').notNull().default(0),
  category:     text('category').notNull(),  // '課税' | '非課税'
  item_name:    text('item_name').notNull(),
  amount:       numeric('amount'),
  cost_amount:  numeric('cost_amount'),
  meta:         jsonb('meta'),
  created_at:   timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('maintenance_tpl_fee_idx').on(t.template_id, t.sort_order),
])

// ----------------------------------------------------------------
// maintenance_damage_pins（損傷箇所マップ）
// 車両俯瞰図 / 4 面図にクリックでピン打ちした損傷箇所の記録。
// 板金特化機能として CarRide には無いユニーク要素。
// ----------------------------------------------------------------
export const maintenance_damage_pins = pgTable('maintenance_damage_pins', {
  id:             uuid('id').primaryKey().defaultRandom(),
  maintenance_id: uuid('maintenance_id').notNull().references(() => maintenance_records.id, { onDelete: 'cascade' }),
  view:           text('view').notNull(),       // 'top' | 'front' | 'back' | 'left' | 'right'
  x_pct:          numeric('x_pct').notNull(),   // 図面内の x 座標 (0-100, %)
  y_pct:          numeric('y_pct').notNull(),   // 図面内の y 座標 (0-100, %)
  category:       text('category').notNull(),   // '凹み' | '擦り傷' | '塗装剥がれ' | '破損' | 'サビ' | 'その他'
  severity:       text('severity').notNull().default('中'),  // '軽' | '中' | '大'
  note:           text('note'),
  sort_order:     integer('sort_order').notNull().default(0),
  created_at:     timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('maintenance_damage_idx').on(t.maintenance_id, t.view, t.sort_order),
])

// ----------------------------------------------------------------
// tags（タグマスタ）
// ----------------------------------------------------------------
export const tags = pgTable('tags', {
  id:         uuid('id').primaryKey().defaultRandom(),
  name:       text('name').notNull().unique(),
  color:      text('color').notNull().default('#71717a'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// taggables（タグ紐づけ・ポリモーフィック）
// ----------------------------------------------------------------
export const taggables = pgTable('taggables', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tag_id:      uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
  object_type: text('object_type').notNull(),
  object_id:   uuid('object_id').notNull(),
  created_at:  timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  unique().on(t.tag_id, t.object_type, t.object_id),
  index('taggables_object_idx').on(t.object_type, t.object_id),
])

// ----------------------------------------------------------------
// change_logs（変更履歴）
// ----------------------------------------------------------------
export const change_logs = pgTable('change_logs', {
  id:          uuid('id').primaryKey().defaultRandom(),
  object_type: text('object_type').notNull(),
  object_id:   uuid('object_id').notNull(),
  field_name:  text('field_name').notNull(),
  field_label: text('field_label').notNull(),
  old_value:   text('old_value'),
  new_value:   text('new_value'),
  changed_at:  timestamp('changed_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('change_logs_object_idx').on(t.object_type, t.object_id, t.changed_at),
])

// ----------------------------------------------------------------
// object_definitions（カスタムオブジェクト定義）
// ----------------------------------------------------------------
export const object_definitions = pgTable('object_definitions', {
  id:                uuid('id').primaryKey().defaultRandom(),
  api_name:          text('api_name').notNull().unique(),   // URL・DB キー。変更不可想定
  label:             text('label').notNull(),               // 単数形表示名
  label_plural:      text('label_plural').notNull(),        // 複数形表示名
  icon:              text('icon').notNull().default('📦'),
  is_builtin:        boolean('is_builtin').notNull().default(false), // 組み込みオブジェクトは削除不可
  nav_enabled:       boolean('nav_enabled').notNull().default(true),
  sort_order:        integer('sort_order').notNull().default(0),
  enable_activities: boolean('enable_activities').notNull().default(false),
  enable_tasks:      boolean('enable_tasks').notNull().default(false),
  enable_expenses:   boolean('enable_expenses').notNull().default(false),
  created_at:        timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:        timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// field_definitions（カスタムフィールド定義）
// ----------------------------------------------------------------
export const field_definitions = pgTable('field_definitions', {
  id:          uuid('id').primaryKey().defaultRandom(),
  object_id:   uuid('object_id').notNull().references(() => object_definitions.id, { onDelete: 'cascade' }),
  api_name:    text('api_name').notNull(),             // フィールドキー
  label:       text('label').notNull(),
  field_type:  text('field_type').notNull().default('text'), // 'text'|'number'|'date'|'boolean'|'select'|'textarea'
  options:     text('options'),                        // select 時の選択肢 JSON: string[]
  is_required: boolean('is_required').notNull().default(false),
  is_builtin:  boolean('is_builtin').notNull().default(false),
  is_visible:  boolean('is_visible').notNull().default(true),
  sort_order:  integer('sort_order').notNull().default(0),
  created_at:  timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:  timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  unique().on(t.object_id, t.api_name),
])

// ----------------------------------------------------------------
// custom_records（カスタムオブジェクトのレコード）
// ----------------------------------------------------------------
export const custom_records = pgTable('custom_records', {
  id:        uuid('id').primaryKey().defaultRandom(),
  object_id: uuid('object_id').notNull().references(() => object_definitions.id, { onDelete: 'cascade' }),
  data:      jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
  owner_id:  uuid('owner_id'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('custom_records_object_idx').on(t.object_id),
])

// ----------------------------------------------------------------
// custom_field_values（組み込みオブジェクトのカスタムフィールド値）
// ----------------------------------------------------------------
export const custom_field_values = pgTable('custom_field_values', {
  id:        uuid('id').primaryKey().defaultRandom(),
  field_id:  uuid('field_id').notNull().references(() => field_definitions.id, { onDelete: 'cascade' }),
  record_id: uuid('record_id').notNull(),  // 任意テーブルの id
  value:     text('value'),               // 値をテキストで保存（型は field_type で解釈）
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  unique().on(t.field_id, t.record_id),
  index('cfv_record_idx').on(t.record_id),
])

// ----------------------------------------------------------------
// Relations
// ----------------------------------------------------------------
export const accountsRelations = relations(accounts, ({ many }) => ({
  contacts:      many(contacts),
  opportunities: many(opportunities),
  activities:    many(activities),
  tasks:         many(tasks),
  expenses:      many(expenses),
  attachments:   many(attachments),
}))

export const contactsRelations = relations(contacts, ({ one }) => ({
  // named 'accounts' to match Supabase's embedded select naming
  accounts: one(accounts, { fields: [contacts.account_id], references: [accounts.id] }),
}))

export const opportunitiesRelations = relations(opportunities, ({ one, many }) => ({
  accounts:    one(accounts, { fields: [opportunities.account_id], references: [accounts.id] }),
  activities:  many(activities),
  tasks:       many(tasks),
  expenses:    many(expenses),
  attachments: many(attachments),
}))

export const activitiesRelations = relations(activities, ({ many }) => ({
  // 関連先は activity_related_records 経由（Phase 2 で FK relation 撤廃）
  attachments: many(attachments),
}))

export const tasksRelations = relations(tasks, () => ({
  // 関連先は task_related_records 経由（Phase 2 で FK relation 撤廃）
}))

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  accounts:      one(accounts, { fields: [attachments.account_id], references: [accounts.id] }),
  contacts:      one(contacts, { fields: [attachments.contact_id], references: [contacts.id] }),
  opportunities: one(opportunities, { fields: [attachments.opportunity_id], references: [opportunities.id] }),
  activities:    one(activities, { fields: [attachments.activity_id], references: [activities.id] }),
}))

export const expensesRelations = relations(expenses, () => ({
  // 関連先は expense_related_records 経由（Phase 2 で FK relation 撤廃）
}))


export const taggablesRelations = relations(taggables, ({ one }) => ({
  tags: one(tags, { fields: [taggables.tag_id], references: [tags.id] }),
}))

export const tagsRelations = relations(tags, ({ many }) => ({
  taggables: many(taggables),
}))

export const objectDefinitionsRelations = relations(object_definitions, ({ many }) => ({
  field_definitions: many(field_definitions),
  custom_records:    many(custom_records),
}))

export const fieldDefinitionsRelations = relations(field_definitions, ({ one }) => ({
  object_definition: one(object_definitions, { fields: [field_definitions.object_id], references: [object_definitions.id] }),
}))

export const customRecordsRelations = relations(custom_records, ({ one }) => ({
  object_definition: one(object_definitions, { fields: [custom_records.object_id], references: [object_definitions.id] }),
}))

// ----------------------------------------------------------------
// users（アプリユーザー・Supabase Auth と連携）
// ----------------------------------------------------------------
export const users = pgTable('users', {
  id:         uuid('id').primaryKey(),           // Supabase Auth UID
  email:      text('email').notNull(),
  role:       text('role').notNull().default('viewer'), // 'admin' | 'editor' | 'viewer'（RBAC 移行中のフォールバック）
  role_id:    uuid('role_id').references(() => roles.id, { onDelete: 'set null' }), // RBAC ロール割当（ADR-0023）
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// roles / role_permissions（RBAC: ロール × ブック別 CRUD。REQ-0031 / ADR-0023）
//   admin/editor/viewer は is_system=true の system ロール（削除・改名不可）。
//   role_permissions.book_api='*' はワイルドカード既定。ブック個別行が優先。
// ----------------------------------------------------------------
export const roles = pgTable('roles', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        text('name').notNull().unique(),
  description: text('description'),
  is_system:   boolean('is_system').notNull().default(false),
  created_at:  timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:  timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const role_permissions = pgTable('role_permissions', {
  role_id:    uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  book_api:   text('book_api').notNull(),
  can_create: boolean('can_create').notNull().default(false),
  can_read:   boolean('can_read').notNull().default(false),
  can_update: boolean('can_update').notNull().default(false),
  can_delete: boolean('can_delete').notNull().default(false),
}, (t) => [
  primaryKey({ columns: [t.role_id, t.book_api] }),
])

// ----------------------------------------------------------------
// user_preferences（ユーザー個別設定）
// ----------------------------------------------------------------
export const user_preferences = pgTable('user_preferences', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  user_id:            text('user_id').notNull().unique(), // Supabase Auth UID
  nav_order:          text('nav_order'),                  // JSON: string[] of hrefs
  display_name:       text('display_name'),               // サイドバー表示名
  // ダッシュボードウィジェットの ON/OFF と並び順 (ベース機能)
  // 形式: { "widget_id": { "enabled": boolean, "order": number } }
  // 未設定なら DASHBOARD_WIDGETS 定義の defaultEnabled に従う
  dashboard_widgets:  jsonb('dashboard_widgets'),
  created_at:         timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:         timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// system_settings（システム全体設定）
// ----------------------------------------------------------------
export const system_settings = pgTable('system_settings', {
  key:        text('key').primaryKey(),
  value:      text('value').notNull(), // JSON value
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// licenses（ライセンス制御 - Issue #67）
//   1 行 = 1 テナントの契約状態
//   現状は単一テナント運用 (tenant_key='default')
//   将来マルチテナント化時は tenant_key で識別
// ----------------------------------------------------------------
export const licenses = pgTable('licenses', {
  id:                     uuid('id').primaryKey().defaultRandom(),
  tenant_key:             text('tenant_key').notNull().unique().default('default'),
  plan:                   text('plan').notNull().default('starter'),
  // features: JSON で機能フラグを保持
  //   {
  //     ai_summary:        boolean,
  //     line_integration:  boolean,
  //     extra_industries:  string[],
  //     custom_documents:  boolean,
  //     max_users:         number | null,
  //     max_storage_mb:    number | null,
  //   }
  features:               jsonb('features').notNull().default({}),
  industry_main:          text('industry_main'),     // 'auto-body' / 'real-estate' / 'staffing'
  status:                 text('status').notNull().default('active'),
                          // 'active' / 'trial' / 'expired' / 'suspended'
  starts_at:              timestamp('starts_at', { withTimezone: true }),
  expires_at:             timestamp('expires_at', { withTimezone: true }),
  stripe_subscription_id: text('stripe_subscription_id'),
  notes:                  text('notes'),
  created_at:             timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:             timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// staff（スタッフマスタ）— 業種オーバーレイ：人材アテンド業 (Issue #69)
//   accounts (人材会社) に属するスタッフ。自社との個別契約は無く、
//   人材会社からの派遣を仲介する形態。
//   INDUSTRY=staffing のときのみ UI で使用。
// ----------------------------------------------------------------
export const staff = pgTable('staff', {
  id:                     uuid('id').primaryKey().defaultRandom(),
  belong_account_id:      uuid('belong_account_id').references(() => accounts.id, { onDelete: 'set null' }),
  name:                   text('name').notNull(),
  name_kana:              text('name_kana'),
  gender:                 text('gender'),
  birth_date:             date('birth_date'),
  phone:                  text('phone'),
  email:                  text('email'),
  skills:                 jsonb('skills'),
  available_areas:        jsonb('available_areas'),
  default_hourly_rate:    numeric('default_hourly_rate'),
  default_cost_per_hour:  numeric('default_cost_per_hour'),
  default_fixed_rate:     numeric('default_fixed_rate'),    // 案件固定単価の既定値（ADR-0010）
  is_repeat:              boolean('is_repeat').default(false), // リピート人材（REQ-0005 B2）
  photo_url:              text('photo_url'),
  status:                 text('status').notNull().default('稼働中'),
  notes:                  text('notes'),
  owner_id:               uuid('owner_id'),
  created_at:             timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:             timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// assignments（案件 = アテンド業務の発注）— 業種オーバーレイ：staffing
//   派遣先 (account_role='client') からの案件発注を管理する。
//   1 案件に複数スタッフをアサイン可能 (assignment_staff junction)。
// ----------------------------------------------------------------
export const assignments = pgTable('assignments', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  assignment_no:        text('assignment_no').notNull().unique(),  // 'YYYYMMDD-NNN'
  title:                text('title'),         // 表示名（取引先名＋日付＋内容 等。REQ-0017）
  client_account_id:    uuid('client_account_id').references(() => accounts.id, { onDelete: 'restrict' }),
  client_contact_id:    uuid('client_contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  service_date:         date('service_date'),
  service_start_time:   text('service_start_time'),
  service_end_time:     text('service_end_time'),
  service_location:     text('service_location'),
  service_type:         text('service_type'),
  service_description:  text('service_description'),
  role:                 text('role'),          // 募集職種・役割（REQ-0005）
  raw_message:          text('raw_message'),    // 貼付したLINE原文（クイック登録の出所保持）
  staff_count_required: integer('staff_count_required'),
  status:               text('status').notNull().default('予約'),
  client_total_fee:     numeric('client_total_fee'),
  internal_memo:        text('internal_memo'),
  owner_id:             uuid('owner_id'),
  created_at:           timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:           timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// assignment_staff（案件 ↔ スタッフ junction with detail）
// ----------------------------------------------------------------
export const assignment_staff = pgTable('assignment_staff', {
  id:             uuid('id').primaryKey().defaultRandom(),
  assignment_id:  uuid('assignment_id').notNull().references(() => assignments.id, { onDelete: 'cascade' }),
  staff_id:       uuid('staff_id').notNull().references(() => staff.id, { onDelete: 'restrict' }),
  agency_account_id: uuid('agency_account_id').references(() => accounts.id, { onDelete: 'set null' }), // どの紹介会社からの候補か
  service_hours:  numeric('service_hours'),
  hourly_rate:    numeric('hourly_rate'),
  cost_per_hour:  numeric('cost_per_hour'),
  proposed_rate:  numeric('proposed_rate'),    // 提示単価（案件固定。ADR-0010）
  talent_name:    text('talent_name'),         // staff 未登録時の候補名
  candidate_status: text('candidate_status').default('候補'), // 候補/確定/辞退
  status:         text('status').notNull().default('予約'),
  notes:          text('notes'),
  created_at:     timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// outreach（打診 / RFQ）— staffing。複数紹介会社への打診管理（REQ-0005）
// ----------------------------------------------------------------
export const outreach = pgTable('outreach', {
  id:                uuid('id').primaryKey().defaultRandom(),
  assignment_id:     uuid('assignment_id').notNull().references(() => assignments.id, { onDelete: 'cascade' }),
  agency_account_id: uuid('agency_account_id').references(() => accounts.id, { onDelete: 'set null' }),
  status:            text('status').notNull().default('打診済'), // 打診済/返信待ち/候補あり/該当なし
  sent_at:           timestamp('sent_at', { withTimezone: true }),
  notes:             text('notes'),
  created_at:        timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// invoices（売上・請求）— staffing。粗利=発注単価−提示単価（REQ-0007/ADR-0010）
// ----------------------------------------------------------------
export const invoices = pgTable('invoices', {
  id:             uuid('id').primaryKey().defaultRandom(),
  assignment_id:  uuid('assignment_id').references(() => assignments.id, { onDelete: 'set null' }),
  candidate_id:   uuid('candidate_id').references(() => assignment_staff.id, { onDelete: 'set null' }),
  billing_amount: numeric('billing_amount'),   // 請求額＝発注単価
  payment_amount: numeric('payment_amount'),   // 支払額＝提示単価
  margin:         numeric('margin'),           // 粗利
  billing_status: text('billing_status').notNull().default('未請求'),
  payment_status: text('payment_status').notNull().default('未払'),
  billed_at:      timestamp('billed_at', { withTimezone: true }),
  paid_at:        timestamp('paid_at', { withTimezone: true }),
  created_at:     timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// events（予定）— staffing。予定の記録/表示用。自動リマインドは MVP 外（ADR-0011）
// ----------------------------------------------------------------
export const events = pgTable('events', {
  id:               uuid('id').primaryKey().defaultRandom(),
  assignment_id:    uuid('assignment_id').references(() => assignments.id, { onDelete: 'set null' }),
  type:             text('type'),    // 打合せ/案件実施/返信期限/その他
  title:            text('title'),
  start_at:         timestamp('start_at', { withTimezone: true }),
  end_at:           timestamp('end_at', { withTimezone: true }),
  reminder_offsets: jsonb('reminder_offsets'), // 将来用（['P1D','PT2H']）
  reminded:         boolean('reminded').default(false),
  created_at:       timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// list_view_settings（リストビューのカラム設定）
// ----------------------------------------------------------------
export const list_view_settings = pgTable('list_view_settings', {
  id:          uuid('id').primaryKey().defaultRandom(),
  object_type: text('object_type').notNull().unique(),
  columns:     text('columns').notNull().default('[]'), // JSON: string[]
  updated_at:  timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// saved_views（保存済みビュー: フィルター・グルーピング条件）
// ----------------------------------------------------------------
export const saved_views = pgTable('saved_views', {
  id:            uuid('id').primaryKey().defaultRandom(),
  object_type:   text('object_type').notNull(),
  name:          text('name').notNull(),
  filter_params: text('filter_params').notNull().default('[]'), // JSON: string[]
  group_params:  text('group_params').notNull().default(''),    // comma-separated group fields
  sort_params:   text('sort_params').notNull().default(''),     // "field:asc,field2:desc"
  scope:         text('scope').notNull().default('user'),       // 'user' | 'system'
  user_id:       text('user_id'),                              // null for system scope
  is_default:    boolean('is_default').notNull().default(false),
  created_at:    timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('saved_views_object_idx').on(t.object_type, t.scope),
])

// ----------------------------------------------------------------
// relationship_definitions（関係性定義 - 管理者が設定する多対多の関係）
// ----------------------------------------------------------------
export const relationship_definitions = pgTable('relationship_definitions', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  source_object_type:  text('source_object_type').notNull(),  // 'properties', 'opportunities', etc.
  target_object_type:  text('target_object_type').notNull(),
  label:               text('label').notNull(),               // 表示名 例：「関連商談」
  reverse_label:       text('reverse_label'),                 // 逆方向の表示名 例：「関連物件」
  cardinality:         text('cardinality').notNull().default('many_to_many'), // 'many_to_many' | 'one_to_many'
  created_at:          timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  unique().on(t.source_object_type, t.target_object_type, t.label),
])

// ----------------------------------------------------------------
// relationship_values（関係性の実データ）
// ----------------------------------------------------------------
export const relationship_values = pgTable('relationship_values', {
  id:               uuid('id').primaryKey().defaultRandom(),
  relationship_id:  uuid('relationship_id').notNull().references(() => relationship_definitions.id, { onDelete: 'cascade' }),
  source_record_id: uuid('source_record_id').notNull(),
  target_record_id: uuid('target_record_id').notNull(),
  created_at:       timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  unique().on(t.relationship_id, t.source_record_id, t.target_record_id),
  index('rv_source_idx').on(t.relationship_id, t.source_record_id),
  index('rv_target_idx').on(t.relationship_id, t.target_record_id),
])

// ----------------------------------------------------------------
// import_logs（インポート実行ログ）
// ----------------------------------------------------------------
export const import_logs = pgTable('import_logs', {
  id:           uuid('id').primaryKey().defaultRandom(),
  route:        text('route').notNull(),          // 例: '/api/import/properties'
  imported:     integer('imported').notNull().default(0),
  updated:      integer('updated').notNull().default(0),
  user_errors:  text('user_errors'),              // JSON: string[] — ユーザー向けエラー
  raw_errors:   text('raw_errors'),               // JSON: string[] — 管理者向け詳細エラー
  created_at:   timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// inventory モジュール PoC（Issue #48）: products / warehouses / stock_movements
// lot/serial は #71 へ先送り。在庫数は stock_movements の集計で算出（冗長カラム無し）。
// ----------------------------------------------------------------
export const products = pgTable('products', {
  id:            uuid('id').primaryKey().defaultRandom(),
  sku:           text('sku').notNull().unique(),
  name:          text('name').notNull(),
  category:      text('category'),
  unit:          text('unit'),                 // 個/箱/kg 等
  unit_price:    numeric('unit_price'),         // 売価
  cost_price:    numeric('cost_price'),         // 原価
  reorder_level: integer('reorder_level').notNull().default(0),
  supplier_account_id: uuid('supplier_account_id').references(() => accounts.id, { onDelete: 'set null' }),
  description:   text('description'),
  owner_id:      uuid('owner_id'),
  created_at:    timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:    timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// wiki_pages（社内ナレッジ / Wiki, Issue #78）
//   parent_id は自己参照（階層）。drizzle 循環参照回避のため列はプレーン宣言し、
//   FK 制約は migration 側 (ON DELETE SET NULL) で付与する（part_movements.maintenance_id 同様）。
// ----------------------------------------------------------------
export const wiki_pages = pgTable('wiki_pages', {
  id:         uuid('id').primaryKey().defaultRandom(),
  title:      text('title').notNull(),
  body:       text('body'),                 // Markdown
  parent_id:  uuid('parent_id'),            // 自己参照（階層）。FK は migration 側で ON DELETE SET NULL
  owner_id:   uuid('owner_id'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('wiki_pages_parent_idx').on(t.parent_id),
])

export const warehouses = pgTable('warehouses', {
  id:         uuid('id').primaryKey().defaultRandom(),
  code:       text('code').notNull().unique(),
  name:       text('name').notNull(),
  location:   text('location'),
  note:       text('note'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const stock_movements = pgTable('stock_movements', {
  id:           uuid('id').primaryKey().defaultRandom(),
  product_id:   uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  warehouse_id: uuid('warehouse_id').references(() => warehouses.id, { onDelete: 'set null' }),
  movement_type: text('movement_type').notNull(),  // '入庫' | '出庫' | '調整'
  quantity:     integer('quantity').notNull(),      // 符号なし。type で増減を解釈
  unit_price:   numeric('unit_price'),
  occurred_at:  date('occurred_at').notNull().defaultNow(),
  reference:    text('reference'),                  // 伝票番号等
  note:         text('note'),
  owner_id:     uuid('owner_id'),
  created_at:   timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('stock_movements_product_idx').on(t.product_id),
  index('stock_movements_warehouse_idx').on(t.warehouse_id),
])

// ----------------------------------------------------------------
// ai_rate_log（AI機能のレート制限ログ）— セキュリティ
//   ユーザー単位で短時間の AI 呼び出し回数を制限する（濫用/コスト対策）。
// ----------------------------------------------------------------
export const ai_rate_log = pgTable('ai_rate_log', {
  id:         uuid('id').primaryKey().defaultRandom(),
  user_id:    uuid('user_id').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('ai_rate_log_user_idx').on(t.user_id, t.created_at),
])
