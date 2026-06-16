/**
 * PLAUD 共有データの純粋ロジック（トークン抽出・レスポンス整形）。
 * server-only を含まないのでユニットテスト可能。fetch は ./index.ts 側。
 */

const ALLOWED_LINK_HOSTS = new Set(['web.plaud.ai'])

export type PlaudContent = {
  title: string
  /** PLAUD の AI 要約/ノート（notes_list[].data_content を結合） */
  summary: string
  /** 文字起こし全文（話者つき。各 trans_result の content を結合） */
  transcript: string
  language?: string
}

export type PlaudErrorCode = 'invalid_url' | 'not_found' | 'fetch_failed' | 'empty'

export class PlaudError extends Error {
  constructor(public readonly code: PlaudErrorCode, message: string) {
    super(message)
    this.name = 'PlaudError'
  }
}

/** 共有リンク/生トークンから TOKEN（pub_<uuid>::<secret>）を取り出す。host は plaud.ai のみ許可（SSRF対策）。 */
export function extractPlaudToken(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  // 生トークン直貼りも許容
  if (/^pub_[0-9a-f-]+::[A-Za-z0-9_-]+$/.test(raw)) return raw
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || !ALLOWED_LINK_HOSTS.has(url.hostname)) return null
  // /s/<token> または /nshare/<token>
  const m = url.pathname.match(/^\/(?:s|nshare)\/(pub_[0-9a-f-]+::[A-Za-z0-9_-]+)$/)
  return m ? m[1] : null
}

export type ShareResponse = {
  status?: number
  data?: { domains?: { api?: string } }
  data_file?: {
    filename?: string
    file_language?: string
    trans_result?: Array<{ content?: string; speaker?: string }>
    notes_list?: Array<{ data_content?: string }>
  }
}

/** API レスポンスを PlaudContent に整形（テスト可能な純関数）。 */
export function parsePlaud(body: ShareResponse): PlaudContent {
  const df = body.data_file
  if (!df) throw new PlaudError('empty', '共有データに本文が含まれていません')

  const title = (df.filename || '').trim()
  const transcript = (df.trans_result ?? [])
    .map((s) => {
      const c = (s.content || '').trim()
      if (!c) return ''
      return s.speaker ? `${s.speaker}: ${c}` : c
    })
    .filter(Boolean)
    .join('\n')
  const summary = (df.notes_list ?? [])
    .map((n) => (n.data_content || '').trim())
    .filter(Boolean)
    .join('\n\n')

  if (!transcript && !summary) throw new PlaudError('empty', '文字起こし・要約が空でした')
  return { title, summary, transcript, language: df.file_language }
}
