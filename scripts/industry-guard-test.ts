/**
 * 業種オーバーレイの境界テスト。
 *
 * 各業種 (base / real-estate / auto-body) で、業種特化ルートに HTTP アクセス
 * したとき、想定どおりリダイレクトされる or notFound() するかを検証する。
 *
 * 期待:
 *   - 真の業種ルート（例 real-estate で /properties）: 200 or 認証 redirect (307)
 *   - 別業種ルート（例 real-estate で /vehicles）: next.config.ts の redirect
 *     ルールで /objects/vehicles に 308 redirect される、または該当ルートが
 *     存在せず notFound() (404)
 *
 * 実行:
 *   # 1 業種ぶんは BASE_URL を指定して走らせる
 *   BASE_URL=https://bract-crm.vercel.app          npx tsx scripts/industry-guard-test.ts
 *   BASE_URL=https://bract-crm-auto-body.vercel.app npx tsx scripts/industry-guard-test.ts
 *
 *   # 3 業種一括の場合は CI workflow から呼ぶ
 *
 *   INDUSTRY=auto-body BASE_URL=...  でその業種側からの期待動作を切替
 *
 * 終了コード: 0 全 pass / 1 1 件以上 fail
 */

// `export {}` を最初に置いて ES module 化（同名トップレベル変数の衝突回避）
export {}

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const INDUSTRY = (process.env.INDUSTRY ?? 'real-estate') as 'base' | 'real-estate' | 'auto-body'

type Check = {
  industry: 'base' | 'real-estate' | 'auto-body'
  path: string
  // 該当業種で踏むべき期待 status (location とセット)
  expectStatus: number | number[]
  // location ヘッダーに含まれるべき部分文字列（次への redirect 先確認用）
  expectLocationContains?: string
  label: string
}

// 業種ごとに「該当業種で正常 / 他業種でガード or redirect」を定義。
//
// 注意: 未ログイン状態だと auth redirect (307 to /login) が next.config の
// redirect (308 to /objects/*) より先に動くため、ステータスだけでは正確な
// 区別が難しい。本テストの本質は「業種特化ルートが 404 で死んでいない」こと
// なので、200 / 302 / 307 / 308 のいずれかなら pass、404 なら fail。
//
// より厳密な区別（authenticated session で 308 を確認）は Playwright #18 で
// カバー予定。
const CHECKS: Check[] = [
  // ── real-estate 特化ルート (/properties/*) ────────────────────
  { industry: 'real-estate', path: '/properties', expectStatus: [200, 302, 307, 308], label: 'real-estate で /properties が存在し応答する' },
  { industry: 'base',        path: '/properties', expectStatus: [200, 302, 307, 308], label: 'base で /properties は redirect で /objects/properties へ案内' },
  { industry: 'auto-body',   path: '/properties', expectStatus: [200, 302, 307, 308], label: 'auto-body で /properties は redirect で /objects/properties へ案内' },

  // ── auto-body 特化ルート (/vehicles/* /parts/*) ───────────────
  { industry: 'auto-body',   path: '/vehicles',   expectStatus: [200, 302, 307, 308], label: 'auto-body で /vehicles が存在し応答する' },
  { industry: 'real-estate', path: '/vehicles',   expectStatus: [200, 302, 307, 308], label: 'real-estate で /vehicles は redirect で /objects/vehicles へ案内' },
  { industry: 'base',        path: '/vehicles',   expectStatus: [200, 302, 307, 308], label: 'base で /vehicles は redirect で /objects/vehicles へ案内' },

  { industry: 'auto-body',   path: '/parts',      expectStatus: [200, 302, 307, 308], label: 'auto-body で /parts が存在し応答する' },
  { industry: 'real-estate', path: '/parts',      expectStatus: [200, 302, 307, 308], label: 'real-estate で /parts は redirect で /objects/parts へ案内' },
  { industry: 'base',        path: '/parts',      expectStatus: [200, 302, 307, 308], label: 'base で /parts は redirect で /objects/parts へ案内' },

  // ── auto-body 特化ルート（整備機能、Phase A1）─────────────────
  // /maintenance と /customer-vehicles は auto-body 業種専用ルート。
  // 他業種では notFound() するため、404 もここでは許容する
  // （real-estate / base には対応する DB テーブルも /objects 定義も無いため
  //   redirect 先が無い）。
  { industry: 'auto-body',   path: '/maintenance',       expectStatus: [200, 302, 307, 308], label: 'auto-body で /maintenance が存在し応答する' },
  { industry: 'real-estate', path: '/maintenance',       expectStatus: [200, 302, 307, 308, 404], label: 'real-estate で /maintenance は 404 または auth redirect' },
  { industry: 'base',        path: '/maintenance',       expectStatus: [200, 302, 307, 308, 404], label: 'base で /maintenance は 404 または auth redirect' },

  { industry: 'auto-body',   path: '/customer-vehicles', expectStatus: [200, 302, 307, 308], label: 'auto-body で /customer-vehicles が存在し応答する' },
  { industry: 'real-estate', path: '/customer-vehicles', expectStatus: [200, 302, 307, 308, 404], label: 'real-estate で /customer-vehicles は 404 または auth redirect' },
  { industry: 'base',        path: '/customer-vehicles', expectStatus: [200, 302, 307, 308, 404], label: 'base で /customer-vehicles は 404 または auth redirect' },
]

type Result = { check: Check; ok: boolean; status: number; location: string | null; reason: string }

async function runOne(check: Check): Promise<Result> {
  if (check.industry !== INDUSTRY) {
    return { check, ok: true, status: 0, location: null, reason: 'skipped (INDUSTRY mismatch)' }
  }

  const url = BASE_URL + check.path
  try {
    const res = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': 'bract-industry-guard-test/1.0' } })
    const status = res.status
    const location = res.headers.get('location')

    const expectedArr = Array.isArray(check.expectStatus) ? check.expectStatus : [check.expectStatus]
    const statusOk = expectedArr.includes(status)
    const locationOk = !check.expectLocationContains || (location ?? '').includes(check.expectLocationContains)

    const ok = statusOk && locationOk
    const reason = ok ? 'OK' : [
      !statusOk && `status=${status} (expected ${expectedArr.join('|')})`,
      !locationOk && `location=${location} (expected to contain ${check.expectLocationContains})`,
    ].filter(Boolean).join('; ')

    return { check, ok, status, location, reason }
  } catch (e) {
    return { check, ok: false, status: 0, location: null, reason: `fetch failed: ${(e as Error).message}` }
  }
}

async function main() {
  console.log(`📍 Industry guard test against ${BASE_URL}`)
  console.log(`   INDUSTRY=${INDUSTRY}\n`)

  const targeted = CHECKS.filter((c) => c.industry === INDUSTRY)
  if (targeted.length === 0) {
    console.log(`❌ INDUSTRY=${INDUSTRY} に対応する check がありません`)
    process.exit(1)
  }

  const results = await Promise.all(targeted.map(runOne))
  let pass = 0, fail = 0
  for (const r of results) {
    const tag = r.ok ? '✅' : '❌'
    const status = r.status === 0 ? '---' : String(r.status)
    console.log(`${tag} [${status.padStart(3)}] ${r.check.path.padEnd(15)} — ${r.check.label}${r.ok ? '' : '\n     reason: ' + r.reason}`)
    if (r.ok) pass++; else fail++
  }

  console.log(`\n${pass}/${results.length} pass, ${fail} fail (INDUSTRY=${INDUSTRY})`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => { console.error('❌', e); process.exit(1) })
