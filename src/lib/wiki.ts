/**
 * Wiki（社内ナレッジ / Issue #78）の純粋ヘルパ。
 * DB を import しない（呼び出し側でデータを取得して渡す）。
 */

/**
 * 内部リンク記法 `[[ページタイトル]]` を Markdown リンクへ解決する。
 *
 * - タイトルが既存（titleToId に存在）→ `[Title](/wiki/<id>)`
 * - 未存在 → `[Title](/wiki/new?title=<encoded>)`（その場で作成導線へ）
 *
 * `[[ ]]` を含まないテキストは変更しない。タイトル前後の空白はトリムして照合する。
 */
export function resolveWikiLinks(
  body: string,
  titleToId: Map<string, string>,
): string {
  if (!body) return body
  return body.replace(/\[\[([^\[\]]+)\]\]/g, (_match, rawTitle: string) => {
    const title = rawTitle.trim()
    if (title === '') return _match
    const id = titleToId.get(title)
    if (id) return `[${title}](/wiki/${id})`
    return `[${title}](/wiki/new?title=${encodeURIComponent(title)})`
  })
}
