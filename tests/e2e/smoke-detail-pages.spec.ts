import { test, expect, type Page } from '@playwright/test'

/**
 * 詳細ページ巡回スモーク（Issue #149 再発防止 / admin）。
 *
 * 各ブックの一覧→先頭レコード詳細を開き、「HTTP 5xx / pageerror / 真っ白」が
 * 無いことを検証する。reports.ts の 'use server' string export のような
 * 「ビルドは緑なのに runtime で 500」クラスをデプロイ前に捕まえる。
 *
 * 業種で無効なルート（一覧が 404/redirect）や、レコード 0 件のブックは自動スキップ。
 */

const ROUTES = [
  'accounts', 'contacts', 'opportunities', 'activities', 'tasks', 'expenses',
  'projects', 'assignments', 'staff', 'properties', 'vehicles', 'parts',
  'products', 'warehouses', 'wiki',
]

/** 一覧ページから最初の「詳細」リンク（/<route>/<id>、/new は除外）を1件拾う */
async function firstDetailHref(page: Page, route: string): Promise<string | null> {
  return page.evaluate((r) => {
    const re = new RegExp('^/' + r + '/[^/]+$')
    for (const a of Array.from(document.querySelectorAll('a[href]'))) {
      const h = a.getAttribute('href') || ''
      if (re.test(h) && !h.endsWith('/new')) return h
    }
    return null
  }, route)
}

test('detail pages render without 500 / crash (admin)', async ({ page }) => {
  test.setTimeout(240_000)
  const failures: string[] = []
  const skipped: string[] = []

  for (const route of ROUTES) {
    const errs: string[] = []
    const onErr = (e: Error) => errs.push(`pageerror: ${e.message.split('\n')[0]}`)
    const onResp = (r: { status(): number; url(): string }) => {
      if (r.status() >= 500) errs.push(`http ${r.status()} ${r.url().replace(/https?:\/\/[^/]+/, '')}`)
    }
    page.on('pageerror', onErr)
    page.on('response', onResp)
    let detail: string | null = null
    try {
      const listResp = await page.goto(`/${route}`, { waitUntil: 'domcontentloaded' })
      const listStatus = listResp?.status() ?? 0
      if (listStatus >= 400) { skipped.push(`${route}(list ${listStatus})`); continue }
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
      detail = await firstDetailHref(page, route)
      if (!detail) { skipped.push(`${route}(no records)`); continue }

      const dResp = await page.goto(detail, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
      const status = dResp?.status() ?? 0
      const bodyLen = await page.locator('body').innerText().then((t) => t.length).catch(() => 0)
      if (status >= 500) errs.push(`detail http ${status}`)
      if (bodyLen < 200) errs.push(`blank detail (body=${bodyLen})`)
    } catch (e) {
      errs.push(`exception: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`)
    } finally {
      page.off('pageerror', onErr)
      page.off('response', onResp)
    }
    if (errs.length) failures.push(`[${route}] ${detail ?? ''} -> ${errs.join('; ')}`)
  }

  console.log('skipped:', skipped.join(', ') || '(none)')
  expect(failures, `詳細ページでエラー:\n${failures.join('\n')}`).toEqual([])
})
