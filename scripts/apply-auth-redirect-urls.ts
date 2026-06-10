/**
 * #44 Google ログイン localhost リダイレクト不具合の修正を「クラウドへ適用」するスクリプト。
 *
 * Supabase Management API で プロジェクトの auth 設定（uri_allow_list）に
 * 本番/Vercel/localhost のリダイレクト URL を **追記**（既存はマージして保持）する。
 * 失敗の原因＝許可リストに本番ドメインが無く、Supabase が site_url(localhost) に
 * フォールバックしていたこと。許可リストに入れれば直る。
 *
 * 使い方（トークンは手元のまま・このスクリプトに渡すだけ）:
 *   1) アクセストークンを発行: https://supabase.com/dashboard/account/tokens
 *        → "Generate new token"（生成された sbp_... をコピー）
 *   2) 実行:
 *        # PowerShell
 *        $env:SUPABASE_ACCESS_TOKEN="sbp_xxx"; npx tsx scripts/apply-auth-redirect-urls.ts
 *        # bash
 *        SUPABASE_ACCESS_TOKEN=sbp_xxx npx tsx scripts/apply-auth-redirect-urls.ts
 *
 *   - project ref を変えたい場合: SUPABASE_PROJECT_REF=xxxx を併せて指定。
 *   - 追加したい本番ドメインがあれば EXTRA_REDIRECT_URLS="https://example.com/**" をカンマ区切りで。
 *   - DRY_RUN=1 で適用せず差分のみ表示。
 *
 * 適用後の確認: 本番で「Google でログイン」→ localhost に飛ばず /dashboard に到達。
 */

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const REF = process.env.SUPABASE_PROJECT_REF || 'eknwcgfcvpgehlfipdib'
const DRY = process.env.DRY_RUN === '1'

// config.toml の additional_redirect_urls と揃える
const DESIRED = [
  'http://localhost:3000',
  'http://localhost:3000/**',
  'http://127.0.0.1:3000',
  'https://*.vercel.app',
  'https://*.vercel.app/**',
  'https://app.bract-crm.com',
  'https://app.bract-crm.com/**',
  ...(process.env.EXTRA_REDIRECT_URLS ? process.env.EXTRA_REDIRECT_URLS.split(',') : []),
].map((s) => s.trim()).filter(Boolean)

const API = `https://api.supabase.com/v1/projects/${REF}/config/auth`

async function main() {
  if (!TOKEN) {
    console.error('✗ SUPABASE_ACCESS_TOKEN が未設定です。')
    console.error('  発行: https://supabase.com/dashboard/account/tokens → Generate new token')
    console.error('  例(PowerShell): $env:SUPABASE_ACCESS_TOKEN="sbp_xxx"; npx tsx scripts/apply-auth-redirect-urls.ts')
    process.exit(1)
  }
  const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }

  // 1) 現在の設定を取得
  const getRes = await fetch(API, { headers })
  if (!getRes.ok) {
    console.error(`✗ 設定取得に失敗 (${getRes.status}): ${await getRes.text()}`)
    console.error('  トークンが正しいか / project ref が正しいか確認してください。')
    process.exit(1)
  }
  const cfg = await getRes.json() as { site_url?: string; uri_allow_list?: string }
  const current = (cfg.uri_allow_list ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  console.log('現在の site_url        :', cfg.site_url ?? '(未設定)')
  console.log('現在の uri_allow_list  :', current.length ? current.join(', ') : '(空)')

  // 2) マージ（既存を保持しつつ追記）
  const merged = Array.from(new Set([...current, ...DESIRED]))
  const added = DESIRED.filter((u) => !current.includes(u))
  if (added.length === 0) {
    console.log('\n✓ 追加が必要な URL はありません（すでに許可済み）。')
    return
  }
  console.log('\n追加する URL           :', added.join(', '))
  console.log('適用後 uri_allow_list  :', merged.join(', '))

  if (DRY) { console.log('\n(DRY_RUN=1 のため適用しません)'); return }

  // 3) PATCH（uri_allow_list のみ更新。site_url 等の他設定は変更しない）
  const patchRes = await fetch(API, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ uri_allow_list: merged.join(',') }),
  })
  if (!patchRes.ok) {
    console.error(`\n✗ 適用に失敗 (${patchRes.status}): ${await patchRes.text()}`)
    process.exit(1)
  }
  console.log('\n✓ 適用しました。本番で Google ログイン →（localhost に飛ばず）/dashboard 到達を確認してください。')
}

main().catch((e) => { console.error(e); process.exit(1) })
