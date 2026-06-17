/**
 * Playwright auth setup: ログイン state を storageState として保存。
 * `dependencies: ['setup']` を持つ project の前に 1 回だけ実行される。
 *
 * 必要 env:
 *   TEST_USER_PASSWORD   3 ユーザー共通パスワード（scripts/seed-test-users.ts で
 *                        投入したもの）。未指定だと skip。
 *
 * 対象ユーザー（scripts/seed-test-users.ts で投入される 3 種）:
 *   test-admin@bract-crm.local
 *   test-editor@bract-crm.local
 *   test-viewer@bract-crm.local
 */
import { test as setup } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const PASSWORD = process.env.TEST_USER_PASSWORD

const ROLES = [
  { name: 'admin',    email: 'test-admin@bract-crm.local',    file: 'tests/e2e/.auth/admin.json'    },
  { name: 'editor',   email: 'test-editor@bract-crm.local',   file: 'tests/e2e/.auth/editor.json'   },
  { name: 'viewer',   email: 'test-viewer@bract-crm.local',   file: 'tests/e2e/.auth/viewer.json'   },
  // 外部ユーザー（REQ-0084）。ログイン後は (crm) layout により /portal へリダイレクトされる。
  { name: 'external', email: 'test-external@bract-crm.local', file: 'tests/e2e/.auth/external.json' },
]

for (const role of ROLES) {
  setup(`auth state for ${role.name}`, async ({ page }) => {
    if (!PASSWORD) {
      console.warn(`⚠ TEST_USER_PASSWORD 未設定、${role.name} の auth state を生成しません`)
      setup.skip()
    }

    // /login へ移動 → email/password 入力 → 「メールでログイン」submit → /dashboard 等への遷移
    await page.goto('/login')
    await page.locator('input[type="email"], input[name="email"]').first().fill(role.email)
    await page.locator('input[type="password"], input[name="password"]').first().fill(PASSWORD!)
    // 注意: 「Google でログイン」ボタンも "ログイン" を含むため、メール送信ボタンを厳密に指定する。
    await page.getByRole('button', { name: 'メールでログイン' }).click()

    // ログイン後の遷移を待つ（社内は dashboard、外部ユーザーは /portal へ）
    await page.waitForURL(/\/dashboard|\/portal|\/$/, { timeout: 15_000 })

    // storageState 保存
    mkdirSync(dirname(role.file), { recursive: true })
    await page.context().storageState({ path: role.file })
  })
}
