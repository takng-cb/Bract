import { db } from '@/lib/db'
import { tasks, accounts, contacts, opportunities } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { parseCsvWithHeaders } from '@/lib/csvUtils'
import { requireApiEditor } from '@/lib/apiAuth'

const PRIORITY_MAP: Record<string, string> = {
  '高': 'high', 'high': 'high',
  '中': 'medium', 'medium': 'medium',
  '低': 'low', 'low': 'low',
}

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
    const id    = row['ID']?.trim()
    const title = row['タイトル']?.trim()
    if (!id && !title) continue

    const accountName = row['取引先名']?.trim()
    const contactName = row['担当者名']?.trim()
    const oppsName    = row['商談名']?.trim()
    const rawDone     = row['完了']?.trim() ?? ''

    const record = {
      title:          title || undefined,
      due_date:       row['期日'] || null,
      priority:       PRIORITY_MAP[row['優先度']?.trim() ?? ''] ?? undefined,
      done:           rawDone === '完了' || rawDone.toLowerCase() === 'true' ? true : undefined,
      account_id:     accountName ? (accountMap.get(accountName) ?? null) : (ctxAccountId ?? null),
      contact_id:     contactName ? (contactMap.get(contactName) ?? null) : null,
      opportunity_id: oppsName    ? (oppsMap.get(oppsName) ?? null) : (ctxOpportunityId ?? null),
    }

    try {
      if (id) {
        const { title: _t, ...rest } = record
        await db.update(tasks)
          .set({ ...rest, ...(record.title ? { title: record.title } : {}) })
          .where(eq(tasks.id, id))
        updated++
      } else {
        if (!record.title) { errors.push('タイトルが空の行をスキップしました'); continue }
        await db.insert(tasks).values({
          ...record,
          title:    record.title,
          priority: record.priority ?? 'medium',
          done:     record.done ?? false,
        })
        inserted++
      }
    } catch (e) {
      errors.push((e as Error).message)
    }
  }

  return NextResponse.json({ imported: inserted, updated, errors })
}
