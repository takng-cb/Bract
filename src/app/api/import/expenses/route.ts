import { db } from '@/lib/db'
import { expenses, accounts, opportunities } from '@/lib/schema'
import { NextRequest, NextResponse } from 'next/server'
import { parseCsv } from '@/lib/csvUtils'

const VALID_CATEGORIES = ['交通費', '接待費', '通信費', '消耗品費', '広告費', '外注費', 'その他']

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 })

  const text = await file.text()
  const rows = parseCsv(text)
  if (rows.length < 2) return NextResponse.json({ error: 'データがありません' }, { status: 400 })

  const [accountsData, oppsData] = await Promise.all([
    db.select({ id: accounts.id,      name: accounts.name      }).from(accounts),
    db.select({ id: opportunities.id, name: opportunities.name }).from(opportunities),
  ])
  const accountMap = new Map(accountsData.map((a) => [a.name, a.id]))
  const oppsMap    = new Map(oppsData.map((o) => [o.name, o.id]))

  // ヘッダ: 件名, 金額, カテゴリ, 日付, 取引先名, 商談名, 備考
  const dataRows = rows.slice(1)
  const records = dataRows.map((cols) => {
    const title  = cols[0]?.trim()
    const amount = cols[1]?.trim()
    const date   = cols[3]?.trim()
    if (!title || !amount || !date) return null
    const cat = cols[2]?.trim()
    return {
      title,
      amount:         String(Number(amount)),
      category:       VALID_CATEGORIES.includes(cat) ? cat : 'その他',
      expense_date:   date,
      account_id:     cols[4]?.trim() ? (accountMap.get(cols[4].trim()) ?? null) : null,
      opportunity_id: cols[5]?.trim() ? (oppsMap.get(cols[5].trim())    ?? null) : null,
      notes:          cols[6]?.trim() || null,
    }
  }).filter(Boolean) as NonNullable<ReturnType<typeof records[0]>>[]

  if (records.length === 0) {
    return NextResponse.json({ error: '有効なデータ行がありません（件名・金額・日付が必須）' }, { status: 400 })
  }

  try {
    await db.insert(expenses).values(records)
    return NextResponse.json({ imported: records.length })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
