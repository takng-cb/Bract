import { supabase } from '@/lib/supabase'
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
  const { data: accountsData } = await supabase.from('accounts').select('id, name')
  const accountMap = new Map((accountsData ?? []).map((a) => [a.name, a.id]))

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
  }).filter((r) => r.full_name)

  if (records.length === 0) {
    return NextResponse.json({ error: '有効なデータ行がありません（氏名が必須）' }, { status: 400 })
  }

  const { error, count } = await supabase.from('contacts').insert(records, { count: 'exact' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ imported: count ?? records.length })
}
