/**
 * パフォーマンス改善インデックスを適用するスクリプト
 * 実行: npx tsx scripts/apply-indexes.ts
 */
import { neon } from '@neondatabase/serverless'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const INDEXES = [
  // contacts
  'CREATE INDEX IF NOT EXISTS idx_contacts_account_id ON contacts(account_id)',
  // opportunities
  'CREATE INDEX IF NOT EXISTS idx_opportunities_account_id ON opportunities(account_id)',
  'CREATE INDEX IF NOT EXISTS idx_opportunities_contact_id ON opportunities(contact_id)',
  'CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage)',
  'CREATE INDEX IF NOT EXISTS idx_opportunities_close_date ON opportunities(close_date)',
  // activities
  'CREATE INDEX IF NOT EXISTS idx_activities_account_id ON activities(account_id)',
  'CREATE INDEX IF NOT EXISTS idx_activities_contact_id ON activities(contact_id)',
  'CREATE INDEX IF NOT EXISTS idx_activities_opportunity_id ON activities(opportunity_id)',
  'CREATE INDEX IF NOT EXISTS idx_activities_custom_record_id ON activities(custom_record_id)',
  'CREATE INDEX IF NOT EXISTS idx_activities_occurred_at ON activities(occurred_at DESC)',
  // activity_related_records (Phase 1: activity_contacts を統合)
  'CREATE INDEX IF NOT EXISTS idx_activity_related_activity_id ON activity_related_records(activity_id)',
  // tasks
  'CREATE INDEX IF NOT EXISTS idx_tasks_account_id ON tasks(account_id)',
  'CREATE INDEX IF NOT EXISTS idx_tasks_contact_id ON tasks(contact_id)',
  'CREATE INDEX IF NOT EXISTS idx_tasks_opportunity_id ON tasks(opportunity_id)',
  'CREATE INDEX IF NOT EXISTS idx_tasks_custom_record_id ON tasks(custom_record_id)',
  'CREATE INDEX IF NOT EXISTS idx_tasks_done ON tasks(done)',
  'CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)',
  // attachments
  'CREATE INDEX IF NOT EXISTS idx_attachments_account_id ON attachments(account_id)',
  'CREATE INDEX IF NOT EXISTS idx_attachments_contact_id ON attachments(contact_id)',
  'CREATE INDEX IF NOT EXISTS idx_attachments_opportunity_id ON attachments(opportunity_id)',
  'CREATE INDEX IF NOT EXISTS idx_attachments_activity_id ON attachments(activity_id)',
  // expenses
  'CREATE INDEX IF NOT EXISTS idx_expenses_account_id ON expenses(account_id)',
  'CREATE INDEX IF NOT EXISTS idx_expenses_contact_id ON expenses(contact_id)',
  'CREATE INDEX IF NOT EXISTS idx_expenses_opportunity_id ON expenses(opportunity_id)',
  'CREATE INDEX IF NOT EXISTS idx_expenses_custom_record_id ON expenses(custom_record_id)',
  'CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date DESC)',
  // properties
  'CREATE INDEX IF NOT EXISTS idx_properties_account_id ON properties(account_id)',
  'CREATE INDEX IF NOT EXISTS idx_properties_contact_id ON properties(contact_id)',
  'CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status)',
  // taggables
  'CREATE INDEX IF NOT EXISTS idx_taggables_tag_id ON taggables(tag_id)',
  // field_definitions
  'CREATE INDEX IF NOT EXISTS idx_field_definitions_object_id ON field_definitions(object_id)',
  // custom_field_values
  'CREATE INDEX IF NOT EXISTS idx_custom_field_values_field_id ON custom_field_values(field_id)',
]

async function main() {
  const sql = neon(process.env.DATABASE_URL!)
  console.log(`🔄 ${INDEXES.length} 件のインデックスを適用中...\n`)

  let ok = 0, fail = 0
  for (const stmt of INDEXES) {
    const name = stmt.match(/idx_\w+/)?.[0] ?? stmt
    try {
      await sql.query(stmt)
      console.log(`  ✅ ${name}`)
      ok++
    } catch (e: unknown) {
      console.log(`  ⚠️  ${name}: ${(e as Error).message}`)
      fail++
    }
  }

  console.log(`\n完了 — ✅ ${ok} 成功, ⚠️  ${fail} スキップ/失敗`)
}

main().catch((e) => { console.error('❌', e); process.exit(1) })
