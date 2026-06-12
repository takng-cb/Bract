/**
 * Markdown 本文から目次（TOC）を生成するユーティリティ（#129）。
 *
 * - 見出し（# 〜 ####）をコードフェンス外から抽出
 * - slug は MarkdownView の見出し id と同じ規則（headingSlug）で生成し、
 *   アンカーリンク（#slug）でジャンプできるようにする
 */

export type TocEntry = { level: 1 | 2 | 3 | 4; text: string; slug: string }

/** 見出しテキスト → アンカー id（日本語はそのまま保持、空白をハイフンに） */
export function headingSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    // Markdown 装飾と記号を除去（日本語・英数字・空白・ハイフンは残す）
    .replace(/[*_`~[\]()!#>]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
}

/** インライン装飾を落とした見出しの表示テキスト */
function headingText(raw: string): string {
  return raw
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .trim()
}

/** Markdown 本文から見出し一覧を抽出（コードフェンス内は無視） */
export function extractHeadings(body: string): TocEntry[] {
  const entries: TocEntry[] = []
  let inFence = false
  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue }
    if (inFence) continue
    const m = line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/)
    if (!m) continue
    const text = headingText(m[2])
    if (!text) continue
    entries.push({ level: m[1].length as TocEntry['level'], text, slug: headingSlug(text) })
  }
  return entries
}
