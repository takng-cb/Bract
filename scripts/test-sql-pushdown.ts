/**
 * buildWhere / buildOrderBy の生成 SQL を簡易検証する smoke test。
 * 実際の DB 接続を使って LIMIT 1 でクエリを流し、エラーなく結果が返るかを確認する。
 *
 * 実行: npx tsx scripts/test-sql-pushdown.ts
 */
import { config } from 'dotenv'

async function main() {
  config({ path: '.env.local' })

  // db は process.env.DATABASE_URL を初期化時に読むため、config 後に動的 import
  const { db } = await import('../src/lib/db')
  const { opportunities, accounts } = await import('../src/lib/schema')
  const { eq } = await import('drizzle-orm')
  const {
    buildWhere,
    unresolvedConditions,
  } = await import('../src/lib/filterUtils')
  const { buildOrderBy } = await import('../src/lib/sortUtils')

  type FilterCondition = import('../src/lib/filterUtils').FilterCondition
  type FilterColumnResolver = import('../src/lib/filterUtils').FilterColumnResolver
  type SortDef = import('../src/lib/sortUtils').SortDef

  const resolver: FilterColumnResolver = {
    name:             { col: opportunities.name,    type: 'text' },
    stage:            { col: opportunities.stage,   type: 'select' },
    amount:           { col: opportunities.amount,  type: 'number' },
    close_date:       { col: opportunities.close_date, type: 'date' },
    'accounts.name':  { col: accounts.name,         type: 'text' },
  }

  type Case = { name: string; conds: FilterCondition[]; sorts?: SortDef[] }
  const cases: Case[] = [
    { name: 'no filter', conds: [] },
    { name: 'name contains', conds: [{ field: 'name', op: 'contains', value: 'クラ' }] },
    { name: 'name starts_with + escape', conds: [{ field: 'name', op: 'starts_with', value: '5%' }] },
    { name: 'stage eq case-insensitive (select)', conds: [{ field: 'stage', op: 'eq', value: 'Prospecting' }] },
    { name: 'amount gte', conds: [{ field: 'amount', op: 'gte', value: '1000000' }] },
    { name: 'close_date lte', conds: [{ field: 'close_date', op: 'lte', value: '2026-12-31' }] },
    { name: 'AND multiple', conds: [
      { field: 'stage', op: 'eq', value: 'proposal' },
      { field: 'amount', op: 'gte', value: '500000' },
    ]},
    { name: 'unknown field (should be skipped)', conds: [
      { field: 'totally_unknown', op: 'eq', value: 'x' },
      { field: 'name', op: 'contains', value: 'a' },
    ]},
    { name: 'nested accounts.name', conds: [{ field: 'accounts.name', op: 'contains', value: '株式' }] },
  ]

  console.log('Running smoke tests for buildWhere/buildOrderBy...\n')
  let pass = 0
  let fail = 0

  for (const c of cases) {
    try {
      const where = buildWhere(c.conds, resolver)
      const sorts: SortDef[] = c.sorts ?? [{ field: 'name', dir: 'asc' }]
      const orderBy = buildOrderBy(sorts, resolver)
      const rows = await db.select({ id: opportunities.id })
        .from(opportunities)
        .leftJoin(accounts, eq(opportunities.account_id, accounts.id))
        .where(where)
        .orderBy(...orderBy)
        .limit(1)
      console.log(`  ✓ ${c.name}  (${rows.length} row${rows.length === 1 ? '' : 's'})`)
      pass++
    } catch (e) {
      console.log(`  ✗ ${c.name}  → ${(e as Error).message}`)
      fail++
    }
  }

  // unresolvedConditions の確認
  const mixed: FilterCondition[] = [
    { field: 'name', op: 'contains', value: 'a' },
    { field: 'tag', op: 'eq', value: 'tag-id-1' },
    { field: 'cf_priority', op: 'eq', value: 'high' },
  ]
  const unresolved = unresolvedConditions(mixed, resolver)
  const expectFields = ['tag', 'cf_priority']
  const ok = unresolved.length === 2 && unresolved.every((c) => expectFields.includes(c.field))
  console.log(ok
    ? `  ✓ unresolvedConditions: ${unresolved.map((c) => c.field).join(', ')}`
    : `  ✗ unresolvedConditions: got ${JSON.stringify(unresolved)}`)
  if (ok) pass++; else fail++

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
