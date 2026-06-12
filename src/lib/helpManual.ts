/**
 * アプリ内マニュアル /help（REQ-0056）。
 *
 * public/manual/*.html（スタンドアロン版と同じファイル＝唯一のソース）から
 * <main> 部分を抽出し、リンクをアプリ内ルートに書き換えて返す。
 * マニュアル更新は従来どおり「scripts/manual-capture.ts で再撮影 → HTML 修正」だけでよい。
 */
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

/** 表示できるページ（ホワイトリスト。URL パラメータの検証を兼ねる） */
export const HELP_PAGES = {
  'index':       '目次',
  'common':      '共通編',
  'admin':       '管理者編',
  'auto-body':   '板金・整備編',
  'real-estate': '不動産編',
  'staffing':    '人材手配編',
} as const

export type HelpPage = keyof typeof HELP_PAGES

export function isHelpPage(p: string): p is HelpPage {
  return p in HELP_PAGES
}

/** マニュアル HTML の <main> を抽出し、アプリ内リンクへ書き換えて返す（無ければ null） */
export async function loadHelpContent(page: HelpPage): Promise<string | null> {
  let html: string
  try {
    html = await readFile(resolve(process.cwd(), `public/manual/${page}.html`), 'utf8')
  } catch {
    return null
  }
  const m = html.match(/<main>([\s\S]*?)<\/main>/)
  if (!m) return null

  return m[1]
    // ページ間リンク: common.html#anchor → /help/common#anchor
    .replace(/href="([a-z-]+)\.html(#[^"]*)?"/g, (_s, p: string, hash: string | undefined) =>
      `href="/help/${p}${hash ?? ''}"`)
    // 画像: img/... → /manual/img/...（静的アセットはそのまま配信）
    .replace(/src="img\//g, 'src="/manual/img/')
}
