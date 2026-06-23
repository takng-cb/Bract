/**
 * 'use server' ファイルの「非async export」を弾く静的チェック（Issue #149 再発防止）。
 *
 * 背景: `'use server'` ファイルは **async 関数しか export できない**。文字列定数や
 * オブジェクトを export すると `next build --webpack` は通るが、**リクエスト時に
 * "A use server file can only export async functions" で 500**（ページが真っ白）。
 * ビルドで気づけないクラスのため、ビルド前にこのチェックを走らせて早期に落とす。
 *
 * 検出する違法 export（モジュール先頭が 'use server' のファイルのみ対象）:
 *   - export const/let/var NAME = <非async値>   （= async ... なら OK）
 *   - export function NAME                       （sync 関数。async は OK）
 *   - export class / export enum
 *   - export default <非async>
 * 許可: export async function / export const x = async (...) => / export type / interface /
 *       export { ... }（async 関数の再エクスポート想定）
 *
 * 実行: npx tsx scripts/check-use-server-exports.ts
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOT = 'src'
const EXTS = new Set(['.ts', '.tsx'])

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.next') continue
      walk(p, out)
    } else if (EXTS.has(extname(name))) {
      out.push(p)
    }
  }
  return out
}

/** ファイル先頭（コメント/空行を読み飛ばした最初の実コード行）が 'use server' か */
function isUseServerModule(src: string): boolean {
  let i = 0
  const n = src.length
  while (i < n) {
    // 空白
    while (i < n && /\s/.test(src[i])) i++
    if (i >= n) break
    // 行コメント
    if (src[i] === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++
      continue
    }
    // ブロックコメント
    if (src[i] === '/' && src[i + 1] === '*') {
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      continue
    }
    // 最初の実トークン: ディレクティブ判定
    const rest = src.slice(i, i + 16)
    return /^['"]use server['"]/.test(rest)
  }
  return false
}

type Violation = { file: string; line: number; text: string }

function scanFile(file: string): Violation[] {
  const src = readFileSync(file, 'utf8')
  if (!isUseServerModule(src)) return []
  const out: Violation[] = []
  const lines = src.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const t = line.trim()
    if (!t.startsWith('export')) continue
    // 許可されるもの
    if (/^export\s+(async\s+function|type\b|interface\b|\{)/.test(t)) continue
    if (/^export\s+default\s+async\s+function\b/.test(t)) continue
    // const/let/var: = async ... 形式のみ許可
    const cv = t.match(/^export\s+(const|let|var)\s+\w+/)
    if (cv) {
      if (/=\s*async\b/.test(t)) continue           // export const x = async () => OK
      out.push({ file, line: i + 1, text: t.slice(0, 100) })
      continue
    }
    // sync function / class / enum / default(非async) は違法
    if (/^export\s+(function|class|enum)\b/.test(t)) { out.push({ file, line: i + 1, text: t.slice(0, 100) }); continue }
    if (/^export\s+default\b/.test(t) && !/^export\s+default\s+async\b/.test(t)) { out.push({ file, line: i + 1, text: t.slice(0, 100) }); continue }
  }
  return out
}

function main() {
  const files = walk(ROOT)
  const violations = files.flatMap(scanFile)
  if (violations.length === 0) {
    console.log(`✅ 'use server' の非async export なし（${files.length} ファイル走査）`)
    return
  }
  console.error(`\n❌ 'use server' ファイルに非async export が ${violations.length} 件あります。`)
  console.error(`   'use server' は async 関数しか export できません（runtime で 500 になります）。`)
  console.error(`   定数/型/オブジェクトは 'use server' でない別モジュールへ移してください。\n`)
  for (const v of violations) console.error(`  ${v.file}:${v.line}  ${v.text}`)
  process.exit(1)
}

main()
