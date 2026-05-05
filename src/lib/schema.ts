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
  name:        text('name').notNull(),
  stage:       text('stage').notNull().default('prospecting'),
  amount:      numeric('amount'),
  probability: integer('probability'),
  close_date:  date('close_date'),
  description: text('description'),
  owner_id:    uuid('owner_id'),
  created_at:  timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:  timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// activities（活動履歴）
// ----------------------------------------------------------------
export const activities = pgTable('activities', {
  id:             uuid('id').primaryKey().defaultRandom(),
  account_id:     uuid('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
  contact_id:     uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  opportunity_id: uuid('opportunity_id').references(() => opportunities.id, { onDelete: 'set null' }),
  type:           text('type').notNull(),
  subject:        text('subject').notNull(),
  body:           text('body'),
  occurred_at:    timestamp('occurred_at', { withTimezone: true }).defaultNow(),
  owner_id:       uuid('owner_id'),
  created_at:     timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// activity_contacts（活動 ↔ 担当者 中間テーブル）
// ----------------------------------------------------------------
export const activity_contacts = pgTable('activity_contacts', {
  id:          uuid('id').primaryKey().defaultRandom(),
  activity_id: uuid('activity_id').notNull().references(() => activities.id, { onDelete: 'cascade' }),
  contact_id:  uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  created_at:  timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  unique().on(t.activity_id, t.contact_id),
])

// ----------------------------------------------------------------
// tasks（タスク / ToDo）
// ----------------------------------------------------------------
export const tasks = pgTable('tasks', {
  id:             uuid('id').primaryKey().defaultRandom(),
  title:          text('title').notNull(),
  due_date:       date('due_date'),
  done:           boolean('done').notNull().default(false),
  priority:       text('priority').notNull().default('medium'),
  account_id:     uuid('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
  contact_id:     uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  opportunity_id: uuid('opportunity_id').references(() => opportunities.id, { onDelete: 'set null' }),
  created_at:     timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:     timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// attachments（添付ファイルのメタデータ）
// ----------------------------------------------------------------
export const attachments = pgTable('attachments', {
  id:             uuid('id').primaryKey().defaultRandom(),
  file_name:      text('file_name').notNull(),
  storage_path:   text('storage_path').notNull(),
  file_size:      bigint('file_size', { mode: 'number' }),
  content_type:   text('content_type'),
  account_id:     uuid('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
  contact_id:     uuid('contact_id').references(() => contacts.id, { onDelete: 'cascade' }),
  opportunity_id: uuid('opportunity_id').references(() => opportunities.id, { onDelete: 'cascade' }),
  activity_id:    uuid('activity_id').references(() => activities.id, { onDelete: 'cascade' }),
  created_at:     timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// expenses（経費申請）
// ----------------------------------------------------------------
export const expenses = pgTable('expenses', {
  id:             uuid('id').primaryKey().defaultRandom(),
  title:          text('title').notNull(),
  amount:         numeric('amount').notNull(),
  category:       text('category').notNull().default('その他'),
  expense_date:   date('expense_date').notNull(),
  account_id:     uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  contact_id:     uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  opportunity_id: uuid('opportunity_id').references(() => opportunities.id, { onDelete: 'set null' }),
  notes:          text('notes'),
  created_at:     timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:     timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// properties（不動産物件）
// ----------------------------------------------------------------
export const properties = pgTable('properties', {
  id:               uuid('id').primaryKey().defaultRandom(),
  product_category: text('product_category').notNull().default('real_estate'), // 'real_estate' | 'other'
  name:             text('name').notNull(),
  property_type:    text('property_type').notNull().default('その他'),
  transaction_type: text('transaction_type').notNull().default('売買'),
  status:           text('status').notNull().default('募集中'),
  price:            numeric('price'),
  account_id:       uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  contact_id:       uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  // 不動産：売り方司法書士
  seller_scrivener_account_id: uuid('seller_scrivener_account_id').references(() => accounts.id, { onDelete: 'set null' }),
  seller_scrivener_contact_id: uuid('seller_scrivener_contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  // 不動産：買い方司法書士
  buyer_scrivener_account_id:  uuid('buyer_scrivener_account_id').references(() => accounts.id, { onDelete: 'set null' }),
  buyer_scrivener_contact_id:  uuid('buyer_scrivener_contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  // ─── 土地の登記 ─── 表題部
  land_fudosan_number: text('land_fudosan_number'),  // 不動産番号
  address:             text('address'),              // 所在
  land_chiban:         text('land_chiban'),          // 地番
  chimoku:             text('chimoku'),              // 地目
  area:                numeric('area'),              // 地積（㎡）
  land_cause:          text('land_cause'),           // 原因及びその日付
  // ─── 土地の登記 ─── 権利部（甲区）
  land_owner_name:           text('land_owner_name'),
  land_owner_address:        text('land_owner_address'),
  land_acquisition_reason:   text('land_acquisition_reason'),
  land_acquisition_date:     date('land_acquisition_date'),
  land_seizure:              boolean('land_seizure').default(false),
  land_seizure_release_date: date('land_seizure_release_date'),
  // ─── 建物の登記 ─── 表題部
  building_fudosan_number:        text('building_fudosan_number'), // 不動産番号
  building_location:              text('building_location'),       // 所在
  building_kaoku_number:          text('building_kaoku_number'),   // 家屋番号
  building_shurui:                text('building_shurui'),         // 種類
  structure:                      text('structure'),               // 構造
  building_floor_area_1f:         numeric('building_floor_area_1f'), // 床面積 1階
  building_floor_area_2f:         numeric('building_floor_area_2f'), // 床面積 2階
  building_floor_area_3f:         numeric('building_floor_area_3f'), // 床面積 3階
  building_new_construction_date: date('building_new_construction_date'), // 新築年月日
  // ─── 建物の登記 ─── 所有権・権利状態（甲区）
  building_owner_name:           text('building_owner_name'),
  building_owner_address:        text('building_owner_address'),
  building_acquisition_reason:   text('building_acquisition_reason'),
  building_acquisition_date:     date('building_acquisition_date'),
  building_seizure:              boolean('building_seizure').default(false),
  building_seizure_release_date: date('building_seizure_release_date'),
  // ─── 建物の登記 ─── 担保・権利制限（乙区）
  building_lien_type:               text('building_lien_type'),
  building_lien_holder:             text('building_lien_holder'),
  building_debt_amount:             bigint('building_debt_amount', { mode: 'number' }),
  building_damage_rate:             numeric('building_damage_rate'),
  building_joint_collateral_number: text('building_joint_collateral_number'),
  description:      text('description'),
  created_at:       timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:       timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

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
  id:           uuid('id').primaryKey().defaultRandom(),
  api_name:     text('api_name').notNull().unique(),   // URL・DB キー。変更不可想定
  label:        text('label').notNull(),               // 単数形表示名
  label_plural: text('label_plural').notNull(),        // 複数形表示名
  icon:         text('icon').notNull().default('📦'),
  is_builtin:   boolean('is_builtin').notNull().default(false), // 組み込みオブジェクトは削除不可
  nav_enabled:  boolean('nav_enabled').notNull().default(true),
  sort_order:   integer('sort_order').notNull().default(0),
  created_at:   timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:   timestamp('updated_at', { withTimezone: true }).defaultNow(),
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
  data:      text('data').notNull().default('{}'),   // JSON blob
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

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  // named 'accounts' to match Supabase's embedded select naming
  accounts:          one(accounts, { fields: [contacts.account_id], references: [accounts.id] }),
  activity_contacts: many(activity_contacts),
}))

export const opportunitiesRelations = relations(opportunities, ({ one, many }) => ({
  accounts:    one(accounts, { fields: [opportunities.account_id], references: [accounts.id] }),
  activities:  many(activities),
  tasks:       many(tasks),
  expenses:    many(expenses),
  attachments: many(attachments),
}))

export const activitiesRelations = relations(activities, ({ one, many }) => ({
  accounts:          one(accounts, { fields: [activities.account_id], references: [accounts.id] }),
  contacts:          one(contacts, { fields: [activities.contact_id], references: [contacts.id] }),
  opportunities:     one(opportunities, { fields: [activities.opportunity_id], references: [opportunities.id] }),
  activity_contacts: many(activity_contacts),
  attachments:       many(attachments),
}))

export const activityContactsRelations = relations(activity_contacts, ({ one }) => ({
  activities: one(activities, { fields: [activity_contacts.activity_id], references: [activities.id] }),
  contacts:   one(contacts, { fields: [activity_contacts.contact_id], references: [contacts.id] }),
}))

export const tasksRelations = relations(tasks, ({ one }) => ({
  accounts:      one(accounts, { fields: [tasks.account_id], references: [accounts.id] }),
  contacts:      one(contacts, { fields: [tasks.contact_id], references: [contacts.id] }),
  opportunities: one(opportunities, { fields: [tasks.opportunity_id], references: [opportunities.id] }),
}))

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  accounts:      one(accounts, { fields: [attachments.account_id], references: [accounts.id] }),
  contacts:      one(contacts, { fields: [attachments.contact_id], references: [contacts.id] }),
  opportunities: one(opportunities, { fields: [attachments.opportunity_id], references: [opportunities.id] }),
  activities:    one(activities, { fields: [attachments.activity_id], references: [activities.id] }),
}))

export const expensesRelations = relations(expenses, ({ one }) => ({
  accounts:      one(accounts, { fields: [expenses.account_id], references: [accounts.id] }),
  contacts:      one(contacts, { fields: [expenses.contact_id], references: [contacts.id] }),
  opportunities: one(opportunities, { fields: [expenses.opportunity_id], references: [opportunities.id] }),
}))

export const propertiesRelations = relations(properties, ({ one }) => ({
  accounts: one(accounts, { fields: [properties.account_id], references: [accounts.id] }),
  contacts: one(contacts, { fields: [properties.contact_id], references: [contacts.id] }),
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
  role:       text('role').notNull().default('viewer'), // 'admin' | 'editor' | 'viewer'
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// user_preferences（ユーザー個別設定）
// ----------------------------------------------------------------
export const user_preferences = pgTable('user_preferences', {
  id:           uuid('id').primaryKey().defaultRandom(),
  user_id:      text('user_id').notNull().unique(), // Supabase Auth UID
  nav_order:    text('nav_order'),                  // JSON: string[] of hrefs
  display_name: text('display_name'),               // サイドバー表示名
  created_at:   timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:   timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// system_settings（システム全体設定）
// ----------------------------------------------------------------
export const system_settings = pgTable('system_settings', {
  key:        text('key').primaryKey(),
  value:      text('value').notNull(), // JSON value
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})
