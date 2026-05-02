import { db } from '@/lib/db'
import { properties, accounts, contacts } from '@/lib/schema'
import { NextRequest, NextResponse } from 'next/server'
import { parseCsv } from '@/lib/csvUtils'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 })

  const text = await file.text()
  const rows = parseCsv(text)
  if (rows.length < 2) return NextResponse.json({ error: 'データがありません' }, { status: 400 })

  const [accountsData, contactsData] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name      }).from(accounts),
    db.select({ id: contacts.id, name: contacts.full_name }).from(contacts),
  ])
  const accountMap = new Map(accountsData.map((a) => [a.name, a.id]))
  const contactMap = new Map(contactsData.map((c) => [c.name, c.id]))

  // ヘッダ: カテゴリ, 件名, 物件種別, 取引種別, ステータス,
  //         所在地, 面積, 価格, 所在階, 総階数, 築年, 取引先名, 担当者名, 備考
  const dataRows = rows.slice(1)
  const records = dataRows.map((cols) => {
    const name = cols[1]?.trim()
    if (!name) return null
    const rawCat = cols[0]?.trim() ?? ''
    const isRE   = rawCat !== 'その他商品' && rawCat !== 'other'
    return {
      product_category: isRE ? 'real_estate' : 'other',
      name,
      property_type:    cols[2]?.trim() || 'その他',
      transaction_type: cols[3]?.trim() || (isRE ? '売買' : 'その他'),
      status:           cols[4]?.trim() || (isRE ? '募集中' : '提案中'),
      address:          isRE ? (cols[5]?.trim() || null) : null,
      area:             isRE && cols[6]?.trim() ? String(Number(cols[6])) : null,
      price:            cols[7]?.trim() ? String(Number(cols[7])) : null,
      floor:            isRE && cols[8]?.trim() ? Number(cols[8]) : null,
      total_floors:     isRE && cols[9]?.trim() ? Number(cols[9]) : null,
      built_year:       isRE && cols[10]?.trim() ? Number(cols[10]) : null,
      account_id:       cols[11]?.trim() ? (accountMap.get(cols[11].trim()) ?? null) : null,
      contact_id:       cols[12]?.trim() ? (contactMap.get(cols[12].trim()) ?? null) : null,
      description:      cols[13]?.trim() || null,
    }
  }).filter(Boolean) as NonNullable<ReturnType<typeof records[0]>>[]

  if (records.length === 0) {
    return NextResponse.json({ error: '有効なデータ行がありません（件名が必須）' }, { status: 400 })
  }

  try {
    await db.insert(properties).values(records)
    return NextResponse.json({ imported: records.length })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
