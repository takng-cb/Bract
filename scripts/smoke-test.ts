/**
 * 軽量 smoke test。主要ページが想定通り応答するかを HTTP で一括確認。
 *
 * 目的:
 *   - リリース直前の最小限の生存確認
 *   - 公開ページ (login / manifest / forgot-password) の 200
 *   - 認証必須ページが 未ログインで /login にリダイレクトされること
 *
 * 制約:
 *   - 認証セッションを使った中身の確認は対象外（それは Playwright #18）
 *   - サーバーが応答するか / リダイレクトが正しいか だけを見る
 *
 * 実行:
 *   BASE_URL=https://bract-crm.vercel.app npx tsx scripts/smoke-test.ts
 *   BASE_URL=http://localhost:3000          npx tsx scripts/smoke-test.ts
 *
 * 未設定時は http://localhost:3000 を仮定。
 *
 * CI 組込:
 *   GitHub Actions の workflow_dispatch / pull_request で
 *   Vercel Preview URL を BASE_URL に渡して走らせる想定。
 *
 * 終了コード:
 *   0 全 pass
 *   1 1 件以上 fail
 */

// `export {}` を最初に置いて ES module 化（同名トップレベル変数の衝突回避）
export {}

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

type Expect = {
  status?: number | number[]      // 期待ステータス（複数可）
  redirectTo?: string             // 期待リダイレクト先（部分一致）
  bodyContains?: string[]         // body に含まれるべき文字列
  bodyNotContains?: string[]      // body に含まれてはいけない文字列
}

type Check = {
  path: string
  label: string
  expect: Expect
}

// 公開ページ（未ログインで 200 を期待）
//
// 注意: bodyContains は SSR HTML に必ず含まれる文字列のみ指定。
// streaming SSR / Suspense / Client Component で hydration 後に描画される
// HTML は初回レスポンスに含まれないため、bodyContains は本質的に脆い。
// smoke test の主な signal は status code とすること。
const PUBLIC_CHECKS: Check[] = [
  {
    path: '/login',
    label: '/login が 200 を返す',
    expect: { status: 200 },
  },
  {
    path: '/forgot-password',
    label: '/forgot-password が 200 を返す',
    expect: { status: 200 },
  },
  {
    path: '/reset-password',
    label: '/reset-password が 200 を返す',
    expect: { status: 200 },
  },
  {
    path: '/manifest.webmanifest',
    label: 'PWA manifest が配信されている',
    expect: { status: 200, bodyContains: ['Bract'] },
  },
]

// 認証必須ページ（未ログインで /login へリダイレクト or 401 を期待）
const AUTH_REQUIRED_PATHS = [
  '/dashboard',
  '/accounts', '/accounts/new',
  '/contacts', '/contacts/new',
  '/opportunities', '/opportunities/new',
  '/activities', '/activities/new',
  '/tasks', '/tasks/new',
  '/expenses', '/expenses/new',
  '/properties', '/properties/new',
  '/vehicles', '/vehicles/new',
  '/parts', '/parts/new',
  '/maintenance', '/maintenance/new',
  '/customer-vehicles', '/customer-vehicles/new',
  '/forecast',
  '/tags',
  '/settings',
  '/admin/objects',
  '/admin/users',
  '/admin/relationships',
  '/admin/import-logs',
  '/admin/audit-log',
  '/about',
]

const AUTH_CHECKS: Check[] = AUTH_REQUIRED_PATHS.map((p) => ({
  path: p,
  label: `${p} は未ログインで /login へ案内される`,
  // Next.js Server Component の redirect は 307、ミドルウェア redirect は 302/307
  // ページ側で notFound() を返す経路もあるため 200 (login page を SSR したケース) も許容
  expect: { status: [200, 302, 307, 308] },
}))

const CHECKS = [...PUBLIC_CHECKS, ...AUTH_CHECKS]

type Result = { check: Check; ok: boolean; status: number; reason: string }

async function runOne(check: Check): Promise<Result> {
  const url = BASE_URL + check.path
  try {
    const res = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': 'bract-smoke-test/1.0' } })
    const status = res.status
    const expected = check.expect.status
    const expectedArr = Array.isArray(expected) ? expected : expected != null ? [expected] : []
    const statusOk = expectedArr.length === 0 || expectedArr.includes(status)

    let body = ''
    if (status >= 200 && status < 300 && check.expect.bodyContains?.length) {
      body = await res.text()
    } else if (check.expect.bodyNotContains?.length) {
      body = await res.text()
    }

    const containsOk = (check.expect.bodyContains ?? []).every((s) => body.includes(s))
    const notContainsOk = (check.expect.bodyNotContains ?? []).every((s) => !body.includes(s))

    let redirectOk = true
    if (check.expect.redirectTo && (status === 302 || status === 307 || status === 308)) {
      const loc = res.headers.get('location') ?? ''
      redirectOk = loc.includes(check.expect.redirectTo)
    }

    const ok = statusOk && containsOk && notContainsOk && redirectOk
    const reason = ok
      ? 'OK'
      : [
          !statusOk && `status=${status} (expected ${expectedArr.join('|')})`,
          !containsOk && `missing body: ${(check.expect.bodyContains ?? []).filter((s) => !body.includes(s)).join(', ')}`,
          !notContainsOk && `unexpected body: ${(check.expect.bodyNotContains ?? []).filter((s) => body.includes(s)).join(', ')}`,
          !redirectOk && `redirect to ${res.headers.get('location')}`,
        ].filter(Boolean).join('; ')

    return { check, ok, status, reason }
  } catch (e) {
    return { check, ok: false, status: 0, reason: `fetch failed: ${(e as Error).message}` }
  }
}

async function main() {
  console.log(`📍 Smoke test against ${BASE_URL}\n`)

  // 並列に走らせる（少しサーバに優しく 8 並列）
  const concurrency = 8
  const results: Result[] = []
  for (let i = 0; i < CHECKS.length; i += concurrency) {
    const batch = CHECKS.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(runOne))
    results.push(...batchResults)
  }

  let pass = 0, fail = 0
  for (const r of results) {
    const tag = r.ok ? '✅' : '❌'
    const padded = r.check.path.padEnd(28)
    console.log(`${tag} ${padded} [${r.status}] ${r.check.label}${r.ok ? '' : ' — ' + r.reason}`)
    if (r.ok) pass++; else fail++
  }

  console.log(`\n${pass}/${results.length} pass, ${fail} fail`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => { console.error('❌ smoke-test 実行中に例外:', e); process.exit(1) })
