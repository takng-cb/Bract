import { db } from '@/lib/db'
import { expenses, accounts, opportunities } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { parseCsvWithHeaders } from '@/lib/csvUtils'
import { requireApiEditor } from '@/lib/apiAuth'

const VALID_CATEGORIES = ['交通費', '接待費', '通信費', '消耗品費', '広告費', '外注費', 'その他']

export async function POST(req: NextRequest) {
  // 編集権限確認（viewer の書き込みを拒否）
  const denied = await requireApiEditor()
  if (denied) return denied

  const formData  = await req.formData()
  const file      = formData.get('file') as File | null
  const textInput = formData.get('text') as string | null
  const ctxAccountId     = formData.get('account_id')     as string | null
  const ctxOpportunityId = formData.get('opportunity_id') as string | null

  let text: string
  if (file) {
    text = await file.text()
  } else if (textInput) {
    text = textInput
  } else {
    return NextResponse.json({ error: 'ファイルまたはテキストが必要です' }, { status: 400 })
  }

  const rows = parseCsvWithHeaders(text)
  if (rows.length === 0) return NextResponse.json({ error: 'データがありません' }, { status: 400 })

  const [accountsData, oppsData] = await Promise.all([
    db.select({ id: accounts.id,      name: accounts.name      }).from(accounts),
    db.select({ id: opportunities.id, name: opportunities.name }).from(opportunities),
  ])
  const accountMap = new Map(accountsData.map((a) => [a.name, a.id]))
  const oppsMap    = new Map(oppsData.map((o) => [o.name, o.id]))

  let inserted = 0
  let updated  = 0
  const errors: string[] = []

  for (const row of rows) {
    const id    = row['ID']?.trim()
    const title = row['件名']?.trim()
    if (!id && !title) continue

    const accountName = row['取引先名']?.trim()
    const oppsName    = row['商談名']?.trim()
    const cat         = row['カテゴリ']?.trim() ?? ''

    const record = {
      title:          title || undefined,
      amount:         row['金額'] ? String(Number(row['金額'])) : undefined,
      category:       VALID_CATEGORIES.includes(cat) ? cat : undefined,
      expense_date:   row['日付'] || undefined,
      account_id:     accountName ? (accountMap.get(accountName) ?? null) : (ctxAccountId ?? null),
      opportunity_id: oppsName    ? (oppsMap.get(oppsName) ?? null) : (ctxOpportunityId ?? null),
      notes:          row['備考'] || null,
    }

    try {
      if (id) {
        const { title: _t, amount: _a, category: _c, expense_date: _d, ...rest } = record
        await db.update(expenses)
          .set({
            ...rest,
            ...(record.title        ? { title: record.title }               : {}),
            ...(record.amount       ? { amount: record.amount }             : {}),
            ...(record.category     ? { category: record.category }         : {}),
            ...(record.expense_date ? { expense_date: record.expense_date } : {}),
          })
          .where(eq(expenses.id, id))
        updated++
      } else {
        if (!record.title || !record.amount || !record.expense_date) {
          errors.push('件名・金額・日付のいずれかが空の行をスキップしました')
          continue
        }
        await db.insert(expenses).values({
          ...record,
          title:        record.title,
          amount:       record.amount,
          category:     record.category ?? 'その他',
          expense_date: record.expense_date,
        })
        inserted++
      }
    } catch (e) {
      errors.push((e as Error).message)
    }
  }

  return NextResponse.json({ imported: inserted, updated, errors })
}
