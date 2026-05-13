/**
 * `next build` 後の `.next/static/chunks/` 配下の JS chunk サイズを集計し、
 * Markdown レポートを stdout に出力する。
 *
 * 用途:
 *   - PR ごとに baseline と比較して急増を検知（手動 or GitHub Actions の
 *     comment 経由）
 *   - リリース前に「現状の bundle サイズ」を客観値として記録
 *
 * 出力:
 *   - 全 chunk のサイズ合計
 *   - サイズ降順 top 10 chunk
 *   - 主要 chunk タイプ別 (vendor / framework / app) のサマリー
 *
 * 実行:
 *   npm run build         # 先に next build を済ませる
 *   npx tsx scripts/bundle-size-report.ts
 *
 *   # JSON 出力（CI で baseline 比較用）:
 *   FORMAT=json npx tsx scripts/bundle-size-report.ts
 */
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const CHUNKS_DIR = '.next/static/chunks'
const FORMAT = process.env.FORMAT === 'json' ? 'json' : 'markdown'

type ChunkInfo = { path: string; bytes: number; type: 'app' | 'framework' | 'vendor' | 'pages' | 'other' }

function classify(rel: string): ChunkInfo['type'] {
  if (rel.startsWith('app/')) return 'app'
  if (rel.startsWith('pages/')) return 'pages'
  if (rel.startsWith('framework-') || rel.startsWith('main-app-') || rel.startsWith('webpack-')) return 'framework'
  if (/^[a-f0-9]+-[a-f0-9]+\.js$/.test(rel) || /^\d+-[a-f0-9]+\.js$/.test(rel)) return 'vendor'
  return 'other'
}

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...walk(full))
    else if (name.endsWith('.js') || name.endsWith('.css')) out.push(full)
  }
  return out
}

function human(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function main() {
  try {
    statSync(CHUNKS_DIR)
  } catch {
    console.error(`❌ ${CHUNKS_DIR} が見つかりません。先に \`npm run build\` を実行してください。`)
    process.exit(1)
  }

  const files = walk(CHUNKS_DIR)
  const chunks: ChunkInfo[] = files.map((f) => {
    const rel = relative(CHUNKS_DIR, f).replace(/\\/g, '/')
    return { path: rel, bytes: statSync(f).size, type: classify(rel) }
  })
  chunks.sort((a, b) => b.bytes - a.bytes)

  const total = chunks.reduce((s, c) => s + c.bytes, 0)
  const byType: Record<string, { count: number; bytes: number }> = {}
  for (const c of chunks) {
    if (!byType[c.type]) byType[c.type] = { count: 0, bytes: 0 }
    byType[c.type].count++
    byType[c.type].bytes += c.bytes
  }

  if (FORMAT === 'json') {
    console.log(JSON.stringify({
      total_bytes: total,
      total_human: human(total),
      chunk_count: chunks.length,
      by_type: byType,
      top10: chunks.slice(0, 10).map((c) => ({ path: c.path, bytes: c.bytes, human: human(c.bytes) })),
    }, null, 2))
    return
  }

  // Markdown report
  console.log('# Bundle size report\n')
  console.log(`- **合計**: ${human(total)} (${chunks.length} files)`)
  console.log()
  console.log('## 種別別サマリー\n')
  console.log('| 種別 | ファイル数 | 合計サイズ |')
  console.log('|---|---:|---:|')
  for (const [t, v] of Object.entries(byType).sort((a, b) => b[1].bytes - a[1].bytes)) {
    console.log(`| ${t} | ${v.count} | ${human(v.bytes)} |`)
  }
  console.log()
  console.log('## サイズ Top 10\n')
  console.log('| chunk | type | size |')
  console.log('|---|---|---:|')
  for (const c of chunks.slice(0, 10)) {
    console.log(`| \`${c.path}\` | ${c.type} | ${human(c.bytes)} |`)
  }
}

main()
