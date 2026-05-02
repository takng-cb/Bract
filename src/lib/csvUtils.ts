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

/** CSV 行を文字列に変換（セルをダブルクォートでエスケープ） */
export function toCsvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')
}

/** BOM 付き CSV 文字列を構築 */
export function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  return '﻿' + [headers, ...rows].map(toCsvRow).join('\n')
}
