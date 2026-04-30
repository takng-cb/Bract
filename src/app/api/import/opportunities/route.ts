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

const STAGE_REVERSE: Record<string, string> = {
  '見込み': 'prospecting', '要件確認': 'qualification', '提案': 'proposal',
  '交渉': 'negotiation', '受注': 'closed_won', '失注': 'closed_lost',
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 })

  const text = await file.text()
  const rows = parseCsv(text)
  if (rows.length < 2) return NextResponse.json({ error: 'データがありません' }, { status: 400 })

  const dataRows = rows.slice(1)

  const { data: accountsData } = await supabase.from('accounts').select('id, name')
  const accountMap = new Map((accountsData ?? []).map((a) => [a.name, a.id]))

  const records = dataRows.map((cols) => {
    const stageLabelOrKey = cols[1]?.trim()
    const stage = STAGE_REVERSE[stageLabelOrKey] ?? stageLabelOrKey ?? 'prospecting'
    const accountName = cols[5]?.trim()
    return {
      name:        cols[0]?.trim() || null,
      stage,
      amount:      cols[2]?.trim() ? Number(cols[2]) : null,
      close_date:  cols[3]?.trim() || null,
      probability: cols[4]?.trim() ? Number(cols[4]) : null,
      account_id:  accountName ? (accountMap.get(accountName) ?? null) : null,
      description: cols[6]?.trim() || null,
    }
  }).filter((r) => r.name)

  if (records.length === 0) {
    return NextResponse.json({ error: '有効なデータ行がありません（商談名が必須）' }, { status: 400 })
  }

  const { error, count } = await supabase.from('opportunities').insert(records, { count: 'exact' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ imported: count ?? records.length })
}
