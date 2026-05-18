/**
 * 「個人」プレースホルダ取引先を削除し、参照していたレコードを ToC 表現
 * （contact だけで顧客を表現する）に移行するスクリプト。
 *
 * 実行前にレポートだけ出して確認したい場合は --dry-run を渡す:
 *   tsx scripts/cleanup-personal-account.ts --dry-run
 *
 * 実行例（auto-body Neon 向け）:
 *   DATABASE_URL=<auto-body URL> tsx scripts/cleanup-personal-account.ts
 *
 * 処理内容:
 *   1. accounts.name = '個人' の取引先を特定
 *   2. その取引先を参照するレコードを表示
 *   3. 各レコードを ToC 表現に変換:
 *      - maintenance_records.account_id = NULL（contact_id は維持）
 *      - maintenance_records.billing_account_id = NULL
 *      - customer_vehicles.account_id = NULL、contact_id は整備履歴の最頻 contact_id から導出
 *      - contacts.account_id = NULL（個人客の人物は親なしに）
 *      - activity/task/expense_related_records の related_object_api='account' & 個人 を削除
 *   4. 個人 account を DELETE
 */
import { config as loadEnv } from 'dotenv'
import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import { and, eq, isNotNull, inArray } from 'drizzle-orm'
import * as schema from '@/lib/schema'

loadEnv({ path: '.env.local' })
loadEnv()

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const dryRun = process.argv.includes('--dry-run')
const sql = neon(url)
const db = drizzle(sql, { schema })

const PERSONAL_NAME = '個人'

async function main() {
  console.log(`=== cleanup-personal-account ===`)
  console.log(`DB host: ${url!.match(/@([^./]*)/)?.[1] ?? '?'}`)
  console.log(`dry-run: ${dryRun ? 'YES (will only report, no writes)' : 'NO (will WRITE)'}\n`)

  // 1. 個人 account を取得
  const personals = await db
    .select({ id: schema.accounts.id, name: schema.accounts.name })
    .from(schema.accounts)
    .where(eq(schema.accounts.name, PERSONAL_NAME))

  if (personals.length === 0) {
    console.log(`No "${PERSONAL_NAME}" account found. Nothing to do.`)
    return
  }

  const ids = personals.map((p) => p.id)
  console.log(`Found ${personals.length} "${PERSONAL_NAME}" account(s):`)
  for (const p of personals) console.log(`  - ${p.id}`)
  console.log()

  // 2. 参照を集計
  const [maints, billings, vehicles, persons, oppos, partsRef, vstk1, vstk2, attRef] = await Promise.all([
    db.select({ id: schema.maintenance_records.id, contact_id: schema.maintenance_records.contact_id })
      .from(schema.maintenance_records).where(inArray(schema.maintenance_records.account_id, ids)),
    db.select({ id: schema.maintenance_records.id })
      .from(schema.maintenance_records).where(inArray(schema.maintenance_records.billing_account_id, ids)),
    db.select({ id: schema.customer_vehicles.id })
      .from(schema.customer_vehicles).where(inArray(schema.customer_vehicles.account_id, ids)),
    db.select({ id: schema.contacts.id, full_name: schema.contacts.full_name })
      .from(schema.contacts).where(inArray(schema.contacts.account_id, ids)),
    db.select({ id: schema.opportunities.id })
      .from(schema.opportunities).where(inArray(schema.opportunities.account_id, ids)),
    db.select({ id: schema.parts.id })
      .from(schema.parts).where(inArray(schema.parts.supplier_account_id, ids)),
    db.select({ id: schema.vehicles.id })
      .from(schema.vehicles).where(inArray(schema.vehicles.supplier_account_id, ids)),
    db.select({ id: schema.vehicles.id })
      .from(schema.vehicles).where(inArray(schema.vehicles.buyer_account_id, ids)),
    db.select({ id: schema.attachments.id })
      .from(schema.attachments).where(inArray(schema.attachments.account_id, ids)),
  ])

  console.log('References to migrate / clean:')
  console.log(`  maintenance_records.account_id        : ${maints.length}`)
  console.log(`  maintenance_records.billing_account_id: ${billings.length}`)
  console.log(`  customer_vehicles.account_id          : ${vehicles.length}`)
  console.log(`  contacts.account_id (ToC 個人客)      : ${persons.length}`)
  console.log(`  opportunities.account_id              : ${oppos.length}  ← cascade delete on account delete`)
  console.log(`  parts.supplier_account_id             : ${partsRef.length}`)
  console.log(`  vehicles.supplier_account_id (在庫)   : ${vstk1.length}`)
  console.log(`  vehicles.buyer_account_id (在庫)      : ${vstk2.length}`)
  console.log(`  attachments.account_id                : ${attRef.length}  ← cascade delete on account delete`)
  console.log()

  // 多態 junction（compound PK のため count 用に activity_id / task_id / expense_id を select）
  const [actRel, taskRel, expRel] = await Promise.all([
    db.select({ k: schema.activity_related_records.activity_id })
      .from(schema.activity_related_records).where(and(
        eq(schema.activity_related_records.related_object_api, 'account'),
        inArray(schema.activity_related_records.related_record_id, ids),
      )),
    db.select({ k: schema.task_related_records.task_id })
      .from(schema.task_related_records).where(and(
        eq(schema.task_related_records.related_object_api, 'account'),
        inArray(schema.task_related_records.related_record_id, ids),
      )),
    db.select({ k: schema.expense_related_records.expense_id })
      .from(schema.expense_related_records).where(and(
        eq(schema.expense_related_records.related_object_api, 'account'),
        inArray(schema.expense_related_records.related_record_id, ids),
      )),
  ])
  console.log('Polymorphic junction (will be deleted):')
  console.log(`  activity_related_records → 個人 account : ${actRel.length}`)
  console.log(`  task_related_records     → 個人 account : ${taskRel.length}`)
  console.log(`  expense_related_records  → 個人 account : ${expRel.length}`)
  console.log()

  if (dryRun) {
    console.log('--dry-run mode: stopping before writes.')
    return
  }

  // 3. customer_vehicles の contact_id 推定（整備履歴の最頻 contact_id）
  console.log('--- WRITING ---')
  for (const v of vehicles) {
    const rows = await db.select({ contact_id: schema.maintenance_records.contact_id })
      .from(schema.maintenance_records)
      .where(and(
        eq(schema.maintenance_records.customer_vehicle_id, v.id),
        isNotNull(schema.maintenance_records.contact_id),
      ))
    const counts = new Map<string, number>()
    for (const r of rows) {
      if (r.contact_id) counts.set(r.contact_id, (counts.get(r.contact_id) ?? 0) + 1)
    }
    let best: string | null = null
    let max = 0
    for (const [cid, c] of counts) if (c > max) { best = cid; max = c }
    await db.update(schema.customer_vehicles)
      .set({ account_id: null, contact_id: best, updated_at: new Date() })
      .where(eq(schema.customer_vehicles.id, v.id))
    console.log(`  customer_vehicle ${v.id}: account_id=NULL, contact_id=${best ?? 'NULL'} (votes=${max})`)
  }

  // 4. maintenance_records: account_id NULL（contact_id は既にあるはず）
  if (maints.length > 0) {
    await db.update(schema.maintenance_records)
      .set({ account_id: null, updated_at: new Date() })
      .where(inArray(schema.maintenance_records.account_id, ids))
    console.log(`  maintenance_records.account_id        → NULL × ${maints.length}`)
  }

  // 5. maintenance_records.billing_account_id NULL
  if (billings.length > 0) {
    await db.update(schema.maintenance_records)
      .set({ billing_account_id: null, updated_at: new Date() })
      .where(inArray(schema.maintenance_records.billing_account_id, ids))
    console.log(`  maintenance_records.billing_account_id→ NULL × ${billings.length}`)
  }

  // 6. contacts.account_id NULL（個人客の人物は親なしに）
  if (persons.length > 0) {
    await db.update(schema.contacts)
      .set({ account_id: null, updated_at: new Date() })
      .where(inArray(schema.contacts.account_id, ids))
    console.log(`  contacts.account_id                   → NULL × ${persons.length}`)
  }

  // 7. parts.supplier_account_id NULL
  if (partsRef.length > 0) {
    await db.update(schema.parts)
      .set({ supplier_account_id: null, updated_at: new Date() })
      .where(inArray(schema.parts.supplier_account_id, ids))
    console.log(`  parts.supplier_account_id             → NULL × ${partsRef.length}`)
  }

  // 8. vehicles (在庫) のサプライヤ / バイヤ参照 NULL
  if (vstk1.length > 0) {
    await db.update(schema.vehicles)
      .set({ supplier_account_id: null, updated_at: new Date() })
      .where(inArray(schema.vehicles.supplier_account_id, ids))
    console.log(`  vehicles.supplier_account_id          → NULL × ${vstk1.length}`)
  }
  if (vstk2.length > 0) {
    await db.update(schema.vehicles)
      .set({ buyer_account_id: null, updated_at: new Date() })
      .where(inArray(schema.vehicles.buyer_account_id, ids))
    console.log(`  vehicles.buyer_account_id             → NULL × ${vstk2.length}`)
  }

  // 9. polymorphic junction: 削除
  if (actRel.length > 0) {
    await db.delete(schema.activity_related_records).where(and(
      eq(schema.activity_related_records.related_object_api, 'account'),
      inArray(schema.activity_related_records.related_record_id, ids),
    ))
    console.log(`  activity_related_records              → delete × ${actRel.length}`)
  }
  if (taskRel.length > 0) {
    await db.delete(schema.task_related_records).where(and(
      eq(schema.task_related_records.related_object_api, 'account'),
      inArray(schema.task_related_records.related_record_id, ids),
    ))
    console.log(`  task_related_records                  → delete × ${taskRel.length}`)
  }
  if (expRel.length > 0) {
    await db.delete(schema.expense_related_records).where(and(
      eq(schema.expense_related_records.related_object_api, 'account'),
      inArray(schema.expense_related_records.related_record_id, ids),
    ))
    console.log(`  expense_related_records               → delete × ${expRel.length}`)
  }

  // 10. opportunities は ON DELETE CASCADE なので account 削除時に消える
  //     （test data なので問題なしと仮定）

  // 11. 最後に 個人 account を削除
  await db.delete(schema.accounts).where(inArray(schema.accounts.id, ids))
  console.log(`  accounts                              → delete × ${ids.length}`)

  console.log('\nDone.')
}

main().catch((e) => {
  console.error('Cleanup failed:', e instanceof Error ? e.message : e)
  process.exit(1)
})
