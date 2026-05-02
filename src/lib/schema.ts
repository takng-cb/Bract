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
  id:          uuid('id').primaryKey().defaultRandom(),
  account_id:  uuid('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
  full_name:   text('full_name').notNull(),
  email:       text('email'),
  phone:       text('phone'),
  title:       text('title'),
  department:  text('department'),
  birthday:    date('birthday'),
  description: text('description'),
  owner_id:    uuid('owner_id'),
  created_at:  timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:  timestamp('updated_at', { withTimezone: true }).defaultNow(),
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
  name:             text('name').notNull(),
  property_type:    text('property_type').notNull().default('その他'),
  transaction_type: text('transaction_type').notNull().default('売買'),
  status:           text('status').notNull().default('募集中'),
  address:          text('address'),
  area:             numeric('area'),
  price:            numeric('price'),
  floor:            integer('floor'),
  total_floors:     integer('total_floors'),
  built_year:       integer('built_year'),
  account_id:       uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  contact_id:       uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
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

// ----------------------------------------------------------------
// users（アプリユーザー・Supabase Auth と連携）
// ----------------------------------------------------------------
export const users = pgTable('users', {
  id:         uuid('id').primaryKey(),           // Supabase Auth UID
  email:      text('email').notNull(),
  role:       text('role').notNull().default('member'), // 'admin' | 'member'
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
