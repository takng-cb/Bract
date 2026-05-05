import { db } from '@/lib/db'
import { opportunities, accounts } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { parseCsvWithHeaders } from '@/lib/csvUtils'

const STAGE_REVERSE: Record<string, string> = {
  '見込み': 'prospecting', '要件確認': 'qualification', '提案': 'proposal',
  '交渉': 'negotiation', '受注': 'closed_won', '失注': 'closed_lost',
}

export async function POST(req: NextRequest) {
  const formData  = await req.formData()
  const file      = formData.get('file') as File | null
  const textInput = formData.get('text') as string | null
  const ctxAccountId = formData.get('account_id') as string | null

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

  const accountsData = await db.select({ id: accounts.id, name: accounts.name }).from(accounts)
  const accountMap   = new Map(accountsData.map((a) => [a.name, a.id]))

  let inserted = 0
  let updated  = 0
  const errors: string[] = []

  for (const row of rows) {
    const id   = row['ID']?.trim()
    const name = row['商談名']?.trim()
    if (!id && !name) continue

    const stageRaw   = row['ステージ']?.trim() ?? ''
    const accountName = row['取引先名']?.trim()
    const accountId   = accountName
      ? (accountMap.get(accountName) ?? null)
      : (ctxAccountId ?? null)

    const record = {
      name:        name || undefined,
      stage:       (STAGE_REVERSE[stageRaw] ?? stageRaw) || undefined,
      amount:      row['金額'] ? String(Number(row['金額'])) : null,
      close_date:  row['完了予定日'] || null,
      probability: row['確度(%)'] ? Number(row['確度(%)']) : null,
      account_id:  accountId,
      description: row['説明'] || null,
    }

    try {
      if (id) {
        const { name: _n, stage: _s, ...rest } = record
        await db.update(opportunities)
          .set({
            ...rest,
            ...(record.name  ? { name: record.name }   : {}),
            ...(record.stage ? { stage: record.stage } : {}),
          })
          .where(eq(opportunities.id, id))
        updated++
      } else {
        if (!record.name) { errors.push('商談名が空の行をスキップしました'); continue }
        await db.insert(opportunities).values({
          ...record,
          name:  record.name,
          stage: record.stage ?? 'prospecting',
        })
        inserted++
      }
    } catch (e) {
      errors.push((e as Error).message)
    }
  }

  return NextResponse.json({ imported: inserted, updated, errors })
}
