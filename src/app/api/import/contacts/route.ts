import { db } from '@/lib/db'
import { contacts, accounts } from '@/lib/schema'
import { NextRequest, NextResponse } from 'next/server'

function parseCsv(text: string): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  return lines.filter((l) => l.trim()).map((line) => {
    const cols: string[] = []
    let inQuote = false
    let cur = ''
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
        else { inQuote = !inQuote }
      } else if (ch === ',' && !inQuote) {
        cols.push(cur); cur = ''
      } else {
        cur += ch
      }
    }
    cols.push(cur)
    return cols
  })
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 })

  const text = await file.text()
  const rows = parseCsv(text)
  if (rows.length < 2) return NextResponse.json({ error: 'データがありません' }, { status: 400 })

  const dataRows = rows.slice(1)

  // 取引先名→IDのマップを取得
  const accountsData = await db.select({ id: accounts.id, name: accounts.name }).from(accounts)
  const accountMap = new Map(accountsData.map((a) => [a.name, a.id]))

  const records = dataRows.map((cols) => {
    const accountName = cols[6]?.trim()
    return {
      full_name:   cols[0]?.trim() || null,
      title:       cols[1]?.trim() || null,
      department:  cols[2]?.trim() || null,
      email:       cols[3]?.trim() || null,
      phone:       cols[4]?.trim() || null,
      birthday:    cols[5]?.trim() || null,
      account_id:  accountName ? (accountMap.get(accountName) ?? null) : null,
      description: cols[7]?.trim() || null,
    }
  }).filter((r): r is typeof r & { full_name: string } => !!r.full_name)

  if (records.length === 0) {
    return NextResponse.json({ error: '有効なデータ行がありません（氏名が必須）' }, { status: 400 })
  }

  try {
    await db.insert(contacts).values(records)
    return NextResponse.json({ imported: records.length })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
