/**
 * Playwright 設定 (Issue #18 / #40 Sprint 2)。
 *
 * 動作:
 *   - tests/e2e/ 配下の *.spec.ts を実行
 *   - auth state を tests/e2e/.auth/<industry>.json に保存して各 test で共有
 *   - ローカル: BASE_URL 未指定なら http://localhost:3000 を使い `npm run dev` を自動起動
 *   - CI / Vercel Preview: BASE_URL を渡せばその URL に対して走る
 *
 * 環境変数:
 *   BASE_URL                 (任意): テスト対象オリジン
 *   TEST_USER_PASSWORD       (必須): seed-test-users で投入した共通パスワード
 *   NEXT_PUBLIC_INDUSTRY     (任意): 業種別シナリオ skip 判定用 (default real-estate)
 */
import { defineConfig, devices } from '@playwright/test'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'
const IS_REMOTE = !BASE_URL.startsWith('http://localhost')

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,                 // auth state 共有のため直列実行
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 800 },
  },

  // ローカル起動時のみ dev server を自動起動
  webServer: IS_REMOTE ? undefined : {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },

  projects: [
    // ── 1) Auth setup — 各ロールでログインして storageState 保存 ─────
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    // ── 2) 認証必須テスト（admin として実行）───────────────────────
    {
      name: 'chromium-admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
      testIgnore: [/auth\.setup\.ts/, /.*\.viewer\.spec\.ts/, /.*\.editor\.spec\.ts/],
    },
    // 将来 editor / viewer ロールでのシナリオが増えたら個別 project 追加
    // {
    //   name: 'chromium-editor',
    //   use: { ...devices['Desktop Chrome'], storageState: 'tests/e2e/.auth/editor.json' },
    //   dependencies: ['setup'],
    //   testMatch: /.*\.editor\.spec\.ts/,
    // },
    // {
    //   name: 'chromium-viewer',
    //   use: { ...devices['Desktop Chrome'], storageState: 'tests/e2e/.auth/viewer.json' },
    //   dependencies: ['setup'],
    //   testMatch: /.*\.viewer\.spec\.ts/,
    // },
  ],
})
