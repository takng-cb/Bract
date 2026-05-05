import { db } from '@/lib/db'
import { activities, accounts, contacts, opportunities } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { parseCsvWithHeaders } from '@/lib/csvUtils'

const TYPE_MAP: Record<string, string> = {
  '電話': 'call', 'call': 'call',
  'メール': 'email', 'email': 'email',
  '打合せ': 'meeting', '打ち合わせ': 'meeting', 'meeting': 'meeting',
  'メモ': 'note', 'note': 'note',
}

export async function POST(req: NextRequest) {
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

  const [accountsData, contactsData, oppsData] = await Promise.all([
    db.select({ id: accounts.id,      name: accounts.name      }).from(accounts),
    db.select({ id: contacts.id,      name: contacts.full_name }).from(contacts),
    db.select({ id: opportunities.id, name: opportunities.name }).from(opportunities),
  ])
  const accountMap = new Map(accountsData.map((a) => [a.name, a.id]))
  const contactMap = new Map(contactsData.map((c) => [c.name, c.id]))
  const oppsMap    = new Map(oppsData.map((o) => [o.name, o.id]))

  let inserted = 0
  let updated  = 0
  const errors: string[] = []

  for (const row of rows) {
    const id      = row['ID']?.trim()
    const subject = row['件名']?.trim()
    if (!id && !subject) continue

    const accountName = row['取引先名']?.trim()
    const contactName = row['担当者名']?.trim()
    const oppsName    = row['商談名']?.trim()
    const rawType     = row['種別']?.trim() ?? ''
    const occurred    = row['実施日時']?.trim()

    const record = {
      subject:        subject || undefined,
      type:           (TYPE_MAP[rawType] ?? rawType) || undefined,
      body:           row['内容'] || null,
      occurred_at:    occurred ? new Date(occurred) : undefined,
      account_id:     accountName ? (accountMap.get(accountName) ?? null) : (ctxAccountId ?? null),
      contact_id:     contactName ? (contactMap.get(contactName) ?? null) : null,
      opportunity_id: oppsName    ? (oppsMap.get(oppsName) ?? null) : (ctxOpportunityId ?? null),
    }

    try {
      if (id) {
        const { subject: _s, type: _t, occurred_at: _o, ...rest } = record
        await db.update(activities)
          .set({
            ...rest,
            ...(record.subject     ? { subject: record.subject }         : {}),
            ...(record.type        ? { type: record.type }               : {}),
            ...(record.occurred_at ? { occurred_at: record.occurred_at } : {}),
          })
          .where(eq(activities.id, id))
        updated++
      } else {
        if (!record.subject) { errors.push('件名が空の行をスキップしました'); continue }
        await db.insert(activities).values({
          ...record,
          subject:     record.subject,
          type:        record.type ?? 'note',
          occurred_at: record.occurred_at ?? new Date(),
        })
        inserted++
      }
    } catch (e) {
      errors.push((e as Error).message)
    }
  }

  return NextResponse.json({ imported: inserted, updated, errors })
}
