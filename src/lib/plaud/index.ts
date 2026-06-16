/**
 * PLAUD Note 共有リンクから文字起こし・AI要約を取得する（#143 / REQ-0077）。
 *
 * 共有リンク `https://web.plaud.ai/s/<TOKEN>`（または `/nshare/<TOKEN>`）の
 * `<TOKEN>`（`pub_<uuid>::<secret>`）を使い、公開エンドポイント
 * `GET https://<region-api>/share/access/<TOKEN>` を叩く（**認証不要**）。
 *
 * API ドメインはリージョン別（既定=東京 api-apne1）。別リージョンの共有は
 * `status:-302` ＋ `data.domains.api` で正しいドメインを返すため 1 回だけ追従する。
 * PLAUD は WAF で素の Node UA を 403 にするため、ブラウザ風ヘッダを付ける。
 *
 * 純粋ロジック（トークン抽出・整形）は ./parse.ts（テスト可能）。本ファイルは fetch のみ。
 * 非公式 API のため PLAUD 側変更で要追従（B 案の既知トレードオフ・Issue #143）。
 */
import 'server-only'
import { extractPlaudToken, parsePlaud, PlaudError, type ShareResponse, type PlaudContent } from './parse'

export { extractPlaudToken, parsePlaud, PlaudError }
export type { PlaudContent }

// 既定リージョン（東京）。必要なら env で上書き可。
const DEFAULT_API_HOST = process.env.PLAUD_API_HOST?.trim() || 'api-apne1.plaud.ai'
const FETCH_TIMEOUT_MS = 15_000

async function getJson(host: string, token: string): Promise<ShareResponse> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(`https://${host}/share/access/${token}`, {
      // PLAUD は WAF で素の Node UA を 403 にするため、ブラウザ風ヘッダを付ける（公開 share・認証は不要）
      headers: {
        accept: 'application/json, text/plain, */*',
        'accept-language': 'ja,en-US;q=0.9,en;q=0.8',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        origin: 'https://web.plaud.ai',
        referer: 'https://web.plaud.ai/',
        'app-platform': 'web',
        'app-language': 'ja',
      },
      signal: ctrl.signal,
      cache: 'no-store',
    })
    if (res.status === 404) throw new PlaudError('not_found', '共有リンクが見つかりません（削除/非公開の可能性）')
    if (!res.ok) throw new PlaudError('fetch_failed', `PLAUD API がエラーを返しました (HTTP ${res.status})`)
    return (await res.json()) as ShareResponse
  } finally {
    clearTimeout(t)
  }
}

/** 共有リンク（or トークン）から本文を取得して整形する。 */
export async function fetchPlaudContent(input: string): Promise<PlaudContent> {
  const token = extractPlaudToken(input)
  if (!token) throw new PlaudError('invalid_url', 'PLAUD の共有リンクではありません（https://web.plaud.ai/s/... を貼ってください）')

  let body = await getJson(DEFAULT_API_HOST, token)
  // リージョン違いは -302 で正しいドメインに 1 回だけ追従。
  // ドメインは応答由来なので *.plaud.ai のみ許可（SSRF対策）。
  const altHost = body.data?.domains?.api
  if (body.status === -302 && altHost && altHost !== DEFAULT_API_HOST && /^[a-z0-9.-]+\.plaud\.ai$/i.test(altHost)) {
    body = await getJson(altHost, token)
  }
  return parsePlaud(body)
}
