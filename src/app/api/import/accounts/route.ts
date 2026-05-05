import { db } from '@/lib/db'
import { accounts } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { parseCsvWithHeaders } from '@/lib/csvUtils'

export async function POST(req: NextRequest) {
  const formData  = await req.formData()
  const file      = formData.get('file') as File | null
  const textInput = formData.get('text') as string | null

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

  let inserted = 0
  let updated  = 0
  const errors: string[] = []

  for (const row of rows) {
    const id   = row['ID']?.trim()
    const name = row['会社名']?.trim()
    if (!id && !name) continue  // どちらもなければスキップ

    const record = {
      name:           name || undefined,
      type:           row['種別']    || null,
      industry:       row['業種']    || null,
      phone:          row['電話番号'] || null,
      website:        row['Webサイト'] || null,
      address:        row['住所']    || null,
      annual_revenue: row['年間売上'] ? String(Number(row['年間売上'])) : null,
      employee_count: row['従業員数'] ? Number(row['従業員数']) : null,
      status:         row['ステータス'] || undefined,
      description:    row['メモ']    || null,
    }

    try {
      if (id) {
        // ID あり → 更新
        const { name: _n, ...updateData } = record
        await db.update(accounts)
          .set({ ...updateData, ...(record.name ? { name: record.name } : {}) })
          .where(eq(accounts.id, id))
        updated++
      } else {
        // ID なし → 新規追加（会社名必須）
        if (!record.name) { errors.push('会社名が空の行をスキップしました'); continue }
        await db.insert(accounts).values({ ...record, name: record.name })
        inserted++
      }
    } catch (e) {
      errors.push((e as Error).message)
    }
  }

  return NextResponse.json({ imported: inserted, updated, errors })
}
