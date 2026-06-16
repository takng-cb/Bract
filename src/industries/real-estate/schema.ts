/**
 * 不動産業向け industry overlay schema
 *
 * このファイルは INDUSTRY=real-estate のときのみロードされる前提。
 * 共通テーブル（accounts, contacts, opportunities 等）は @/lib/schema で定義。
 * このファイルでは不動産業固有のテーブルと、共通テーブルへの拡張リレーションを定義する。
 */
import {
  pgTable,
  uuid,
  text,
  numeric,
  bigint,
  boolean,
  date,
  timestamp,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { accounts, contacts } from '@/lib/schema'

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
// projects（不動産プロジェクト）— 用地取得〜開発〜販売/引渡を束ねる案件単位。
//   商談・物件などを横断して紐づける（関連先＝record_links）。UI は商談を参考。
// ----------------------------------------------------------------
export const projects = pgTable('projects', {
  id:               uuid('id').primaryKey().defaultRandom(),
  name:             text('name').notNull(),                                  // プロジェクト名
  status:           text('status').notNull().default('計画'),                // PROJECT_STAGES
  project_type:     text('project_type'),                                    // 分譲開発/賃貸開発/リノベ/仲介/管理受託/その他
  account_id:       uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }), // 施主・地主・関連取引先
  contact_id:       uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }), // 窓口担当
  location:         text('location'),                                        // 所在地
  start_date:       date('start_date'),                                      // 着手日
  end_date:         date('end_date'),                                        // 完了予定日
  budget:           numeric('budget'),                                       // 予算・総事業費（円）
  expected_revenue: numeric('expected_revenue'),                             // 想定売上（円）
  actual_cost:      numeric('actual_cost').notNull().default('0'),           // 実績原価（円）
  description:      text('description'),                                     // 概要・メモ
  owner_id:         uuid('owner_id'),                                        // 社内担当
  created_at:       timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:       timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ----------------------------------------------------------------
// Relations
// ----------------------------------------------------------------
export const propertiesRelations = relations(properties, ({ one }) => ({
  accounts: one(accounts, { fields: [properties.account_id], references: [accounts.id] }),
  contacts: one(contacts, { fields: [properties.contact_id], references: [contacts.id] }),
}))

export const projectsRelations = relations(projects, ({ one }) => ({
  account: one(accounts, { fields: [projects.account_id], references: [accounts.id] }),
  contact: one(contacts, { fields: [projects.contact_id], references: [contacts.id] }),
}))
