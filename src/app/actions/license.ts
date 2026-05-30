'use server'

/**
 * ライセンス管理のサーバーアクション (Issue #67 Phase 2)
 *
 * 管理者のみが呼び出せる。features や status を編集する。
 */
import { requireAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { licenses } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import type { LicenseFeatures, LicensePlan, LicenseStatus } from '@/lib/license/types'

const TENANT_KEY = 'default'

const VALID_PLANS: LicensePlan[]   = ['starter', 'standard', 'pro', 'early_adopter', 'enterprise']
const VALID_STATUS: LicenseStatus[] = ['active', 'trial', 'expired', 'suspended']

export type UpdateLicensePayload = {
  plan?:           LicensePlan
  status?:         LicenseStatus
  industry_main?:  string | null
  features?:       LicenseFeatures
  starts_at?:      string | null  // ISO date
  expires_at?:     string | null
  notes?:          string | null
}

/**
 * デフォルトテナントのライセンスを更新する。
 * 部分更新可能。空の payload なら何もしない。
 */
export async function updateLicense(payload: UpdateLicensePayload): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin()

  // バリデーション
  if (payload.plan && !VALID_PLANS.includes(payload.plan)) {
    return { ok: false, error: `不正なプラン値: ${payload.plan}` }
  }
  if (payload.status && !VALID_STATUS.includes(payload.status)) {
    return { ok: false, error: `不正なステータス値: ${payload.status}` }
  }

  const update: Record<string, unknown> = { updated_at: new Date() }
  if (payload.plan !== undefined)          update.plan = payload.plan
  if (payload.status !== undefined)        update.status = payload.status
  if (payload.industry_main !== undefined) update.industry_main = payload.industry_main || null
  if (payload.features !== undefined)      update.features = payload.features
  if (payload.starts_at !== undefined)     update.starts_at = payload.starts_at ? new Date(payload.starts_at) : null
  if (payload.expires_at !== undefined)    update.expires_at = payload.expires_at ? new Date(payload.expires_at) : null
  if (payload.notes !== undefined)         update.notes = payload.notes || null

  try {
    // 既存ライセンス行を upsert
    const existing = await db.select({ id: licenses.id })
      .from(licenses)
      .where(eq(licenses.tenant_key, TENANT_KEY))
      .limit(1)
      .then((r) => r[0] ?? null)

    if (existing) {
      await db.update(licenses).set(update).where(eq(licenses.tenant_key, TENANT_KEY))
    } else {
      await db.insert(licenses).values({
        tenant_key: TENANT_KEY,
        plan:       (payload.plan ?? 'starter'),
        status:     (payload.status ?? 'active'),
        features:   (payload.features ?? {}),
        industry_main:  payload.industry_main || null,
        starts_at:  payload.starts_at  ? new Date(payload.starts_at)  : null,
        expires_at: payload.expires_at ? new Date(payload.expires_at) : null,
        notes:      payload.notes || null,
      })
    }

    revalidatePath('/admin/license')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
