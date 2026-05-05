import { db } from '@/lib/db'
import { contacts, accounts } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { parseCsvWithHeaders } from '@/lib/csvUtils'

export async function POST(req: NextRequest) {
  const formData  = await req.formData()
  const file      = formData.get('file') as File | null
  const textInput = formData.get('text') as string | null
  // レコードページからのコンテキスト（自動設定される account_id）
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

  // 取引先名→IDのマップ
  const accountsData = await db.select({ id: accounts.id, name: accounts.name }).from(accounts)
  const accountMap   = new Map(accountsData.map((a) => [a.name, a.id]))

  let inserted = 0
  let updated  = 0
  const errors: string[] = []

  for (const row of rows) {
    const id       = row['ID']?.trim()
    const fullName = row['氏名']?.trim()
    if (!id && !fullName) continue

    const accountName = row['取引先名']?.trim()
    const accountId   = accountName
      ? (accountMap.get(accountName) ?? null)
      : (ctxAccountId ?? null)  // CSV に取引先名がなければコンテキストIDを使用

    const record = {
      full_name:   fullName || undefined,
      title:       row['役職']    || null,
      department:  row['部署']    || null,
      email:       row['メール']   || null,
      phone:       row['電話番号'] || null,
      birthday:    row['誕生日']   || null,
      account_id:  accountId,
      description: row['メモ']    || null,
    }

    try {
      if (id) {
        const { full_name: _n, ...updateData } = record
        await db.update(contacts)
          .set({ ...updateData, ...(record.full_name ? { full_name: record.full_name } : {}) })
          .where(eq(contacts.id, id))
        updated++
      } else {
        if (!record.full_name) { errors.push('氏名が空の行をスキップしました'); continue }
        await db.insert(contacts).values({ ...record, full_name: record.full_name })
        inserted++
      }
    } catch (e) {
      errors.push((e as Error).message)
    }
  }

  return NextResponse.json({ imported: inserted, updated, errors })
}
