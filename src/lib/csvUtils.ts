/** RFC 4180 準拠の CSV パーサー（ダブルクォート対応） */
export function parseCsv(text: string): string[][] {
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

/**
 * CSV インジェクション（数式インジェクション）対策。
 * Excel/Sheets は = + - @ や タブ/CR で始まるセルを数式として解釈しうるため、
 * 「数値ではないのに危険文字で始まるセル」は先頭にタブを付けて無害化（テキスト扱いさせる）。
 * 取り込み時は parseCsvWithHeaders が trim するためタブは除去され、ラウンドトリップは保たれる。
 */
function sanitizeCsvCell(value: string): string {
  if (value === '') return value
  if (/^[=+\-@\t\r]/.test(value) && Number.isNaN(Number(value))) return '\t' + value
  return value
}

/** CSV 行を文字列に変換（数式インジェクション無害化＋ダブルクォートでエスケープ） */
export function toCsvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map((c) => `"${sanitizeCsvCell(String(c ?? '')).replace(/"/g, '""')}"`).join(',')
}

/** BOM 付き CSV 文字列を構築 */
export function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  return '﻿' + [headers, ...rows].map(toCsvRow).join('\n')
}

/**
 * ヘッダー行付き CSV をパースして Record 配列を返す。
 * BOM を自動除去。各セルの前後スペースをトリムする。
 */
export function parseCsvWithHeaders(text: string): Record<string, string>[] {
  // BOM 除去
  const cleaned = text.replace(/^﻿/, '')
  const rows = parseCsv(cleaned)
  if (rows.length < 1) return []
  const headers = rows[0].map((h) => h.trim())
  return rows.slice(1).map((cols) => {
    const record: Record<string, string> = {}
    headers.forEach((h, i) => { record[h] = cols[i]?.trim() ?? '' })
    return record
  }).filter((r) => Object.values(r).some((v) => v !== ''))
}
