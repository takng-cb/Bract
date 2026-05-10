/**
 * buildTagWhere の生成 SQL を簡易検証する smoke test。
 * 実 DB で LIMIT 1 を流し、SQL 構文エラー無しで結果が返ることを確認する。
 *
 * 実行: npx tsx scripts/test-tag-where.ts
 */
import { config } from 'dotenv'

async function main() {
  config({ path: '.env.local' })

  const { db } = await import('../src/lib/db')
  const { opportunities, accounts, contacts } = await import('../src/lib/schema')
  const { eq } = await import('drizzle-orm')
  const { buildTagWhere } = await import('../src/lib/filterUtils')

  type FilterCondition = import('../src/lib/filterUtils').FilterCondition

  // ダミー UUID（DB に存在しない可能性あり、ただ SQL 構文確認用）
  const fakeTagId1 = '00000000-0000-0000-0000-000000000001'
  const fakeTagId2 = '00000000-0000-0000-0000-000000000002'

  type Case = {
    name: string
    tagConds: FilterCondition[]
    objectType: 'opportunity' | 'account' | 'contact'
    table: 'opportunities' | 'accounts' | 'contacts'
  }

  const cases: Case[] = [
    { name: 'no tag', tagConds: [], objectType: 'opportunity', table: 'opportunities' },
    { name: 'tag eq (opportunities)',
      tagConds: [{ field: 'tag', op: 'eq', value: fakeTagId1 }],
      objectType: 'opportunity', table: 'opportunities' },
    { name: 'tag neq (opportunities)',
      tagConds: [{ field: 'tag', op: 'neq', value: fakeTagId1 }],
      objectType: 'opportunity', table: 'opportunities' },
    { name: 'multi tag eq + eq (AND, opportunities)',
      tagConds: [
        { field: 'tag', op: 'eq', value: fakeTagId1 },
        { field: 'tag', op: 'eq', value: fakeTagId2 },
      ],
      objectType: 'opportunity', table: 'opportunities' },
    { name: 'tag eq (accounts)',
      tagConds: [{ field: 'tag', op: 'eq', value: fakeTagId1 }],
      objectType: 'account', table: 'accounts' },
    { name: 'tag eq (contacts)',
      tagConds: [{ field: 'tag', op: 'eq', value: fakeTagId1 }],
      objectType: 'contact', table: 'contacts' },
    { name: 'empty value (should be skipped)',
      tagConds: [{ field: 'tag', op: 'eq', value: '' }],
      objectType: 'opportunity', table: 'opportunities' },
  ]

  console.log('Running smoke tests for buildTagWhere...\n')
  let pass = 0, fail = 0

  for (const c of cases) {
    try {
      let where, recordIdCol
      if (c.table === 'opportunities') {
        recordIdCol = opportunities.id
        where = buildTagWhere(c.tagConds, c.objectType, recordIdCol)
        await db.select({ id: opportunities.id }).from(opportunities).where(where).limit(1)
      } else if (c.table === 'accounts') {
        recordIdCol = accounts.id
        where = buildTagWhere(c.tagConds, c.objectType, recordIdCol)
        await db.select({ id: accounts.id }).from(accounts).where(where).limit(1)
      } else {
        recordIdCol = contacts.id
        where = buildTagWhere(c.tagConds, c.objectType, recordIdCol)
        await db.select({ id: contacts.id }).from(contacts).where(where).limit(1)
      }
      // 空ケース確認
      if (c.tagConds.every((t) => !t.value)) {
        if (where !== undefined) {
          console.log(`  ✗ ${c.name}  → expected undefined, got SQL`)
          fail++
          continue
        }
      }
      console.log(`  ✓ ${c.name}  ${where === undefined ? '(no clause)' : '(clause built)'}`)
      pass++
    } catch (e) {
      console.log(`  ✗ ${c.name}  → ${(e as Error).message}`)
      fail++
    }
  }

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
