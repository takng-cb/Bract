/**
 * Google Drive 共有URL → iframe 埋め込み可能な /preview URL へ変換（純関数）。
 *
 * 対応:
 *   - ファイル: https://drive.google.com/file/d/<ID>/view... → /file/d/<ID>/preview
 *   - open?id=<ID>                                          → /file/d/<ID>/preview（ファイル想定）
 *   - フォルダ: https://drive.google.com/drive/folders/<ID> → embeddedfolderview?id=<ID>#list
 *   - Docs/Sheets/Slides: docs.google.com/<kind>/d/<ID>/... → /<kind>/d/<ID>/preview
 *   - 既に /preview や embeddedfolderview のものはそのまま
 * 認識できない URL は null（呼び出し側で「埋め込み不可・リンクで開く」表示）。
 *
 * 注意: 対象がリンク共有 or 閲覧者が権限を持つアカウントでログインしている必要がある。
 */

export type DriveLink = { label?: string; url: string }

const DOCS_KINDS = ['document', 'spreadsheets', 'presentation'] as const

export function toDrivePreviewUrl(rawUrl: string | null | undefined): string | null {
  const url = (rawUrl ?? '').trim()
  if (!url) return null

  let u: URL
  try { u = new URL(url) } catch { return null }
  const host = u.hostname
  if (!/(^|\.)google\.com$/.test(host)) return null

  // 既に埋め込み形式
  if (/\/preview\/?$/.test(u.pathname) || u.pathname.includes('embeddedfolderview')) return url

  // Docs / Sheets / Slides
  if (host.startsWith('docs.google.com')) {
    const m = u.pathname.match(/\/(document|spreadsheets|presentation)\/d\/([\w-]+)/)
    if (m && (DOCS_KINDS as readonly string[]).includes(m[1])) {
      return `https://docs.google.com/${m[1]}/d/${m[2]}/preview`
    }
  }

  // Drive フォルダ
  const folder = u.pathname.match(/\/drive\/folders\/([\w-]+)/)
  if (folder) return `https://drive.google.com/embeddedfolderview?id=${folder[1]}#list`

  // Drive ファイル (/file/d/<ID>/...)
  const file = u.pathname.match(/\/file\/d\/([\w-]+)/)
  if (file) return `https://drive.google.com/file/d/${file[1]}/preview`

  // open?id=<ID>（ファイル想定）
  const id = u.searchParams.get('id')
  if (id && /^[\w-]+$/.test(id)) return `https://drive.google.com/file/d/${id}/preview`

  return null
}

/** URL が Google Drive 系か（フォーム検証の参考に） */
export function isDriveUrl(url: string | null | undefined): boolean {
  try {
    const h = new URL((url ?? '').trim()).hostname
    return /(^|\.)google\.com$/.test(h)
  } catch { return false }
}
