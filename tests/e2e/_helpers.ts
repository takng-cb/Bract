/**
 * E2E テスト用の共通ヘルパー。
 *
 * - getFirstRecordId(page, listPath): 一覧ページの最初のレコード ID を取得。
 *   レコードが 0 件なら null。
 * - expectRedirectedTo(page, expectedPath): 一定時間以内に該当 URL に
 *   redirect されたことを確認。
 */
import { type Page, expect } from '@playwright/test'

/**
 * 一覧ページから最初のレコード UUID を返す。
 * 一覧 page に navigate して a[href*="/<resource>/<uuid>"] パターンの link を探す。
 *
 * @example
 *   const id = await getFirstRecordId(page, '/accounts', 'accounts')
 */
export async function getFirstRecordId(
  page: Page,
  listPath: string,
  resourcePath: string,
): Promise<string | null> {
  await page.goto(listPath)
  // /accounts/<uuid> 形式の href を持つ最初の anchor
  const ids = await page.evaluate(({ resource }) => {
    const all = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[]
    const re = new RegExp(`/${resource}/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$`)
    const found: string[] = []
    for (const a of all) {
      const m = a.pathname.match(re) ?? a.href.match(re)
      if (m && !found.includes(m[1])) found.push(m[1])
    }
    return found
  }, { resource: resourcePath })

  return ids[0] ?? null
}

/**
 * 一定時間以内に該当 URL に redirect されたことを確認。
 * Server Action の redirect('/dashboard') 等の検証で使う。
 */
export async function expectRedirectedTo(page: Page, expectedPath: string, timeoutMs = 10_000): Promise<void> {
  await page.waitForURL((url) => url.pathname === expectedPath || url.pathname.startsWith(expectedPath), { timeout: timeoutMs })
  expect(page.url()).toContain(expectedPath)
}
