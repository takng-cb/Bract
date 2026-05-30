/**
 * ライセンス制御 — メインヘルパー (Issue #67)
 *
 * Server Component / Server Action から呼び出してテナントのライセンス状態と
 * 機能フラグを確認する。
 *
 * 設計方針:
 *   - DB の licenses テーブルを真実とする
 *   - env 変数 (AI_FEATURE_ENABLED など) は「最終 kill switch」として残す
 *     → DB で有効でも env で false なら無効化
 *   - キャッシュ: Server Component のリクエスト単位で React.cache でメモ化
 *   - 単一テナント運用想定なので tenant_key='default' を読む
 *
 * 使い方:
 *   ```ts
 *   import { hasFeature, ensureFeature } from '@/lib/license'
 *
 *   // 1. UI でフィーチャー有無を確認 (返り値で分岐)
 *   if (await hasFeature('ai_summary')) {
 *     return <AISummaryButton />
 *   }
 *
 *   // 2. Server Action 冒頭でゲート (無効なら throw)
 *   await ensureFeature('ai_summary')
 *   ```
 */
import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/db'
import { licenses } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import type {
  License, LicenseFeatures, FeatureFlag, LicensePlan, LicenseStatus,
} from './types'
import { FeatureNotLicensedError, LicenseInactiveError } from './types'
import { parseEnvBool } from './envParsing'

// re-export
export {
  FeatureNotLicensedError,
  LicenseInactiveError,
}
export type { License, LicenseFeatures, FeatureFlag, LicensePlan, LicenseStatus }

/** 単一テナント運用なので固定キー */
const TENANT_KEY = 'default'

/**
 * env 変数による override（テナント全体の kill switch）。
 * DB で feature ON でも env で false なら無効化する保険機構。
 *
 * 既存の AI_FEATURE_ENABLED もここでチェックされる。
 */
function envOverride(flag: FeatureFlag): boolean | null {
  switch (flag) {
    case 'ai_summary':
      // 既存の AI_FEATURE_ENABLED と互換性を保つ
      return parseEnvBool(process.env.AI_FEATURE_ENABLED)
    case 'line_integration':
      return parseEnvBool(process.env.LINE_FEATURE_ENABLED)
    default:
      return null  // env override なし → DB の値をそのまま使う
  }
}

/**
 * 現在のテナントのライセンスを取得。
 * React.cache でリクエスト単位にメモ化（同一リクエスト内で重複クエリしない）。
 *
 * ライセンスが DB に無い場合は null を返す（= 機能はすべて無効扱い）。
 */
export const getLicense = cache(async (): Promise<License | null> => {
  try {
    const rows = await db.select()
      .from(licenses)
      .where(eq(licenses.tenant_key, TENANT_KEY))
      .limit(1)
    const row = rows[0]
    if (!row) return null
    return {
      id:                     row.id,
      tenant_key:             row.tenant_key,
      plan:                   row.plan as LicensePlan,
      features:               (row.features as LicenseFeatures) ?? {},
      industry_main:          row.industry_main,
      status:                 row.status as LicenseStatus,
      starts_at:              row.starts_at,
      expires_at:             row.expires_at,
      stripe_subscription_id: row.stripe_subscription_id,
      notes:                  row.notes,
      created_at:             row.created_at as Date,
      updated_at:             row.updated_at as Date,
    }
  } catch {
    // DB エラー時は null（機能停止扱い）。原因はサーバーログで追跡
    return null
  }
})

/**
 * ライセンスが現時点で有効か（status='active' かつ期限内）。
 *
 * 状態:
 *   - active かつ 期限内    → true
 *   - trial かつ 期限内     → true
 *   - active だが期限切れ   → false (status を 'expired' に変えるのは別バッチ)
 *   - 'expired'/'suspended' → false
 *   - ライセンス無し        → false
 */
export async function isLicenseActive(): Promise<boolean> {
  const lic = await getLicense()
  if (!lic) return false
  if (lic.status !== 'active' && lic.status !== 'trial') return false
  if (lic.expires_at && lic.expires_at.getTime() < Date.now()) return false
  return true
}

/**
 * 指定 feature が利用可能かを判定。
 *
 * 評価順:
 *   1. env override が true → true (DB 状態に関わらず有効化)
 *   2. env override が false → false (kill switch)
 *   3. ライセンスが inactive → false
 *   4. license.features[flag] を返す
 */
export async function hasFeature(flag: FeatureFlag): Promise<boolean> {
  const override = envOverride(flag)
  if (override === true)  return true
  if (override === false) return false

  if (!(await isLicenseActive())) return false
  const lic = await getLicense()
  return Boolean(lic?.features?.[flag])
}

/**
 * 機能が無効なら例外を投げる（Server Action のガード用）。
 *
 * - ライセンス自体が inactive なら LicenseInactiveError
 * - 機能が無効なら FeatureNotLicensedError
 */
export async function ensureFeature(flag: FeatureFlag): Promise<void> {
  // env override が true なら無条件で通す（既存 AI flag との互換）
  const override = envOverride(flag)
  if (override === true) return

  const lic = await getLicense()
  if (!lic || (lic.status !== 'active' && lic.status !== 'trial')) {
    throw new LicenseInactiveError(lic?.status ?? 'suspended')
  }
  if (lic.expires_at && lic.expires_at.getTime() < Date.now()) {
    throw new LicenseInactiveError('expired')
  }

  if (override === false) {
    // env で false → kill switch
    throw new FeatureNotLicensedError(flag, `機能 "${flag}" は環境設定で無効化されています。`)
  }

  if (!lic.features?.[flag]) {
    throw new FeatureNotLicensedError(flag)
  }
}

/**
 * 追加業種（extra_industries）の利用可否。
 * @param industry_api - 'real-estate' / 'auto-body' / 'staffing' 等
 */
export async function hasExtraIndustry(industry_api: string): Promise<boolean> {
  if (!(await isLicenseActive())) return false
  const lic = await getLicense()
  const extras = lic?.features?.extra_industries ?? []
  return extras.includes(industry_api)
}

/**
 * ユーザー数の上限が設定されている場合、現在のユーザー数が上限を超えていないかチェック。
 *
 * @param currentUserCount 現在登録されているユーザー数
 * @returns 上限内なら true、超えていれば false
 */
export async function canAddUser(currentUserCount: number): Promise<boolean> {
  const lic = await getLicense()
  const max = lic?.features?.max_users ?? null
  if (max === null || max === undefined) return true   // 無制限
  return currentUserCount < max
}
