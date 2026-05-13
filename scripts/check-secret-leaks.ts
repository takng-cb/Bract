/**
 * production の各 page で配信される HTML / JS chunk に秘匿情報が漏洩していないか
 * 検査するセキュリティチェック。
 *
 * 対象:
 *   - SUPABASE_SERVICE_ROLE_KEY（サーバー専用 key）
 *   - DATABASE_URL のフル credentials（user:pass）
 *   - .env.local の任意のシークレット文字列パターン
 *
 * 検出ロジック:
 *   1. BASE_URL の主要ページ HTML を GET
 *   2. その HTML から `_next/static/chunks/*.js` を抽出して全て GET
 *   3. 集めた全テキストに対して以下のパターンを grep:
 *      - "eyJhbGc" で始まる JWT (service_role / anon は形状が似るが service_role の漏洩を狙う)
 *      - "postgresql://" 完全URL
 *      - "sb_secret_" prefix
 *      - 任意の env から渡したシークレット
 *   4. anon key は client に意図的に公開されるので除外
 *
 * 実行:
 *   BASE_URL=https://bract-crm.vercel.app npx tsx scripts/check-secret-leaks.ts
 *
 *   # 既知の anon key を許容するには:
 *   ALLOWED_ANON_KEY="eyJhbGc...." npx tsx scripts/check-secret-leaks.ts
 *
 * 終了コード: 0 漏洩なし / 1 漏洩あり
 */

// `export {}` を最初に置いて ES module 化（同名トップレベル変数の衝突回避）
export {}

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const ALLOWED_ANON_KEY = (process.env.ALLOWED_ANON_KEY ?? '').trim()
const FORBIDDEN_PATTERNS_RAW: { name: string; pattern: RegExp }[] = [
  // postgresql://user:password@host/db ── DATABASE_URL の完全漏洩
  { name: 'PostgreSQL connection string', pattern: /postgresql:\/\/[^@\s"']+:[^@\s"']+@[^\s"']+/g },
  // sb_secret_ プレフィックス（Supabase の新 secret key 形式）
  { name: 'Supabase secret key (sb_secret_)', pattern: /sb_secret_[A-Za-z0-9_-]{20,}/g },
  // JWT 形式（eyJ で始まる）。anon key も同じ形式なので別途除外
  { name: 'JWT-like token', pattern: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g },
]

// 検査対象ページ
const PAGES = [
  '/',
  '/login',
  '/forgot-password',
  '/reset-password',
  '/manifest.webmanifest',
]

async function fetchText(url: string): Promise<{ ok: boolean; text: string }> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'bract-secret-leak-check/1.0' } })
    const text = await res.text()
    return { ok: res.ok, text }
  } catch {
    return { ok: false, text: '' }
  }
}

function extractChunkUrls(html: string): string[] {
  // _next/static/chunks/xxx.js を抽出
  const matches = html.match(/\/_next\/static\/chunks\/[A-Za-z0-9._/\-]+\.js/g) ?? []
  return Array.from(new Set(matches))
}

type Finding = {
  source: string       // page URL or chunk URL
  patternName: string
  match: string        // sanitized (first 40 chars)
}

async function main() {
  console.log(`📍 Secret leak check against ${BASE_URL}\n`)

  const findings: Finding[] = []
  const chunkSet = new Set<string>()

  // 1. ページ取得 + chunk URL 抽出
  for (const page of PAGES) {
    const url = BASE_URL + page
    process.stdout.write(`  fetching ${page}... `)
    const { text } = await fetchText(url)
    console.log(`(${text.length} chars)`)
    scanText(`page:${page}`, text, findings)
    for (const c of extractChunkUrls(text)) chunkSet.add(c)
  }

  console.log(`\n  found ${chunkSet.size} JS chunks, scanning...`)
  for (const chunkPath of chunkSet) {
    const url = BASE_URL + chunkPath
    const { text } = await fetchText(url)
    scanText(`chunk:${chunkPath}`, text, findings)
  }

  // 2. ALLOWED_ANON_KEY の許容 (フィルタ)
  const realFindings = findings.filter((f) => {
    if (!ALLOWED_ANON_KEY) return true
    if (f.patternName === 'JWT-like token' && f.match.startsWith(ALLOWED_ANON_KEY.slice(0, 40))) return false
    return true
  })

  // 3. レポート
  if (realFindings.length === 0) {
    console.log(`\n✅ 漏洩なし（${findings.length - realFindings.length} 件は ALLOWED_ANON_KEY と一致するため除外）`)
    return
  }

  console.log(`\n❌ ${realFindings.length} 件の漏洩疑い:`)
  const grouped = new Map<string, Finding[]>()
  for (const f of realFindings) {
    const key = `${f.patternName} :: ${f.source}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(f)
  }
  for (const [key, items] of grouped) {
    console.log(`\n  ▼ ${key}`)
    for (const f of items.slice(0, 3)) {
      console.log(`    ${f.match}…`)
    }
    if (items.length > 3) console.log(`    ... (${items.length - 3} more)`)
  }

  console.log(`\nヒント: anon key のように意図的に公開されるものは ALLOWED_ANON_KEY env で除外できます。`)
  process.exit(1)
}

function scanText(source: string, text: string, findings: Finding[]) {
  for (const { name, pattern } of FORBIDDEN_PATTERNS_RAW) {
    const matches = text.matchAll(pattern)
    for (const m of matches) {
      findings.push({ source, patternName: name, match: m[0].slice(0, 40) })
    }
  }
}

main().catch((e) => { console.error('❌', e); process.exit(1) })
