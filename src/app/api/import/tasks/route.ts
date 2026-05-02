import { db } from '@/lib/db'
import { tasks, accounts, contacts, opportunities } from '@/lib/schema'
import { NextRequest, NextResponse } from 'next/server'
import { parseCsv } from '@/lib/csvUtils'

const PRIORITY_MAP: Record<string, string> = {
  '高': 'high', 'high': 'high',
  '中': 'medium', 'medium': 'medium',
  '低': 'low', 'low': 'low',
}

type TaskRecord = {
  title:          string
  due_date:       string | null
  priority:       string
  done:           boolean
  account_id:     string | null
  contact_id:     string | null
  opportunity_id: string | null
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 })

  const text = await file.text()
  const rows = parseCsv(text)
  if (rows.length < 2) return NextResponse.json({ error: 'データがありません' }, { status: 400 })

  const [accountsData, contactsData, oppsData] = await Promise.all([
    db.select({ id: accounts.id,      name: accounts.name      }).from(accounts),
    db.select({ id: contacts.id,      name: contacts.full_name }).from(contacts),
    db.select({ id: opportunities.id, name: opportunities.name }).from(opportunities),
  ])
  const accountMap = new Map(accountsData.map((a) => [a.name, a.id]))
  const contactMap = new Map(contactsData.map((c) => [c.name, c.id]))
  const oppsMap    = new Map(oppsData.map((o) => [o.name, o.id]))

  // ヘッダ: タイトル, 期日, 優先度, 完了, 取引先名, 担当者名, 商談名
  const dataRows = rows.slice(1)
  const records: TaskRecord[] = dataRows.flatMap((cols) => {
    const title = cols[0]?.trim()
    if (!title) return []
    const rawPriority = cols[2]?.trim() ?? ''
    const rawDone     = cols[3]?.trim() ?? ''
    return [{
      title,
      due_date:       cols[1]?.trim() || null,
      priority:       PRIORITY_MAP[rawPriority] ?? 'medium',
      done:           rawDone === '完了' || rawDone.toLowerCase() === 'true',
      account_id:     cols[4]?.trim() ? (accountMap.get(cols[4].trim()) ?? null) : null,
      contact_id:     cols[5]?.trim() ? (contactMap.get(cols[5].trim()) ?? null) : null,
      opportunity_id: cols[6]?.trim() ? (oppsMap.get(cols[6].trim())    ?? null) : null,
    }]
  })

  if (records.length === 0) {
    return NextResponse.json({ error: '有効なデータ行がありません（タイトルが必須）' }, { status: 400 })
  }

  try {
    await db.insert(tasks).values(records)
    return NextResponse.json({ imported: records.length })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
