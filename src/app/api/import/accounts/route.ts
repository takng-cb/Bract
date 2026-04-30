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

  // ヘッダー行をスキップ
  const dataRows = rows.slice(1)

  const records = dataRows.map((cols) => ({
    name:           cols[0]?.trim() || null,
    type:           cols[1]?.trim() || null,
    industry:       cols[2]?.trim() || null,
    phone:          cols[3]?.trim() || null,
    website:        cols[4]?.trim() || null,
    address:        cols[5]?.trim() || null,
    annual_revenue: cols[6]?.trim() ? Number(cols[6]) : null,
    employee_count: cols[7]?.trim() ? Number(cols[7]) : null,
    status:         cols[8]?.trim() || 'active',
    description:    cols[9]?.trim() || null,
  })).filter((r) => r.name)

  if (records.length === 0) {
    return NextResponse.json({ error: '有効なデータ行がありません（会社名が必須）' }, { status: 400 })
  }

  const { error, count } = await supabase.from('accounts').insert(records, { count: 'exact' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ imported: count ?? records.length })
}
