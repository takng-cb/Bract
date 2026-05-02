import { db } from '@/lib/db'
import { activities, accounts, contacts, opportunities } from '@/lib/schema'
import { NextRequest, NextResponse } from 'next/server'
import { parseCsv } from '@/lib/csvUtils'

const TYPE_MAP: Record<string, string> = {
  '電話': 'call', 'call': 'call',
  'メール': 'email', 'email': 'email',
  '打合せ': 'meeting', '打ち合わせ': 'meeting', 'meeting': 'meeting',
  'メモ': 'note', 'note': 'note',
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

  // ヘッダ: 実施日時, 種別, 件名, 内容, 取引先名, 担当者名, 商談名
  const dataRows = rows.slice(1)
  const records = dataRows.map((cols) => {
    const subject = cols[2]?.trim()
    if (!subject) return null
    const rawType  = cols[1]?.trim() ?? ''
    const occurred = cols[0]?.trim()
    return {
      occurred_at:    occurred ? new Date(occurred) : new Date(),
      type:           TYPE_MAP[rawType] ?? 'note',
      subject,
      body:           cols[3]?.trim() || null,
      account_id:     cols[4]?.trim() ? (accountMap.get(cols[4].trim()) ?? null) : null,
      contact_id:     cols[5]?.trim() ? (contactMap.get(cols[5].trim()) ?? null) : null,
      opportunity_id: cols[6]?.trim() ? (oppsMap.get(cols[6].trim())    ?? null) : null,
    }
  }).filter(Boolean) as NonNullable<ReturnType<typeof records[0]>>[]

  if (records.length === 0) {
    return NextResponse.json({ error: '有効なデータ行がありません（件名が必須）' }, { status: 400 })
  }

  try {
    await db.insert(activities).values(records)
    return NextResponse.json({ imported: records.length })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
