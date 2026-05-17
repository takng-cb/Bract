'use server'

import { db } from '@/lib/db'
import { maintenance_records, activities, activity_related_records } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { requireEditor } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { generateMaintenanceNo } from '@/industries/auto-body/lib/maintenanceNo'

function pick(formData: FormData, key: string): string | null {
  const v = (formData.get(key) as string) || ''
  return v.trim() === '' ? null : v.trim()
}

function pickInt(formData: FormData, key: string): number | null {
  const v = pick(formData, key)
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

export async function createMaintenance(formData: FormData): Promise<string> {
  await requireEditor()

  const customer_vehicle_id = pick(formData, 'customer_vehicle_id')
  if (!customer_vehicle_id) throw new Error('顧客車両は必須です')
  const account_id = pick(formData, 'account_id')
  if (!account_id) throw new Error('顧客（取引先）は必須です')

  // UNIQUE 違反したら 5 回まで番号再採番（同時 INSERT 対策）
  let lastErr: unknown = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const no = await generateMaintenanceNo()
    try {
      const [row] = await db.insert(maintenance_records).values({
        maintenance_no:       no,
        customer_vehicle_id,
        account_id,
        contact_id:           pick(formData, 'contact_id'),
        billing_account_id:   pick(formData, 'billing_account_id'),
        intake_date:          pick(formData, 'intake_date'),
        intake_time:          pick(formData, 'intake_time'),
        delivery_date:        pick(formData, 'delivery_date'),
        delivery_time:        pick(formData, 'delivery_time'),
        pickup_location:      pick(formData, 'pickup_location'),
        delivery_location:    pick(formData, 'delivery_location'),
        sales_recording_date: pick(formData, 'sales_recording_date'),
        mileage:              pickInt(formData, 'mileage'),
        branch_id:            pick(formData, 'branch_id'),
        intake_category:      pick(formData, 'intake_category'),
        reception_owner_id:   pick(formData, 'reception_owner_id'),
        worker_owner_id:      pick(formData, 'worker_owner_id'),
        internal_memo:        pick(formData, 'internal_memo'),
        work_order_note:      pick(formData, 'work_order_note'),
        general_note:         pick(formData, 'general_note'),
        tax_mode:             pick(formData, 'tax_mode') ?? '税別10%',
        tax_rounding:         pick(formData, 'tax_rounding') ?? '切り捨て',
        lever_rate:           pick(formData, 'lever_rate'),
        status:               pick(formData, 'status') ?? '予約',
        owner_id:             pick(formData, 'owner_id'),
      }).returning({ id: maintenance_records.id })
      return row.id
    } catch (e) {
      lastErr = e
      // UNIQUE 違反のみリトライ
      const msg = e instanceof Error ? e.message : String(e)
      if (!/maintenance_no|unique|duplicate/i.test(msg)) throw e
    }
  }
  throw new Error('整備番号の採番に失敗しました（同時実行衝突）。再度お試しください。' + (lastErr ? ` (${(lastErr as Error).message})` : ''))
}

export async function updateMaintenance(id: string, formData: FormData) {
  await requireEditor()

  const customer_vehicle_id = pick(formData, 'customer_vehicle_id')
  if (!customer_vehicle_id) throw new Error('顧客車両は必須です')
  const account_id = pick(formData, 'account_id')
  if (!account_id) throw new Error('顧客（取引先）は必須です')

  await db.update(maintenance_records).set({
    customer_vehicle_id,
    account_id,
    contact_id:           pick(formData, 'contact_id'),
    billing_account_id:   pick(formData, 'billing_account_id'),
    intake_date:          pick(formData, 'intake_date'),
    intake_time:          pick(formData, 'intake_time'),
    delivery_date:        pick(formData, 'delivery_date'),
    delivery_time:        pick(formData, 'delivery_time'),
    pickup_location:      pick(formData, 'pickup_location'),
    delivery_location:    pick(formData, 'delivery_location'),
    sales_recording_date: pick(formData, 'sales_recording_date'),
    mileage:              pickInt(formData, 'mileage'),
    branch_id:            pick(formData, 'branch_id'),
    intake_category:      pick(formData, 'intake_category'),
    reception_owner_id:   pick(formData, 'reception_owner_id'),
    worker_owner_id:      pick(formData, 'worker_owner_id'),
    internal_memo:        pick(formData, 'internal_memo'),
    work_order_note:      pick(formData, 'work_order_note'),
    general_note:         pick(formData, 'general_note'),
    tax_mode:             pick(formData, 'tax_mode') ?? '税別10%',
    tax_rounding:         pick(formData, 'tax_rounding') ?? '切り捨て',
    lever_rate:           pick(formData, 'lever_rate'),
    status:               pick(formData, 'status') ?? '予約',
    owner_id:             pick(formData, 'owner_id'),
    updated_at:           new Date(),
  }).where(eq(maintenance_records.id, id))

  redirect(`/maintenance/${id}`)
}

export async function deleteMaintenance(id: string) {
  await requireEditor()
  await db.delete(maintenance_records).where(eq(maintenance_records.id, id))
  revalidatePath('/maintenance')
  redirect('/maintenance')
}

// ─── ステータス遷移ごとに自動で活動を作るマッピング ──────────
const AUTO_ACTIVITY_BY_STATUS: Record<string, { type: string; subject: string; body: string } | null> = {
  '予約':       null,  // 予約は手動入力時点で完結している想定（活動を作らない）
  '受付':       { type: 'meeting', subject: '入庫・受付',         body: '受付完了。整備内容を確認し作業を開始予定。' },
  '作業中':     { type: 'note',    subject: '作業開始',           body: '整備作業に着手。' },
  '納車待ち':   { type: 'note',    subject: '作業完了 → 納車準備', body: '全工程完了、お客様への納車連絡待ち。' },
  '完了':       { type: 'meeting', subject: '納車・整備完了',      body: 'お客様への納車完了。' },
  'キャンセル': { type: 'note',    subject: 'キャンセル受付',      body: 'お客様都合または店舗都合により整備をキャンセル。' },
}

export async function updateMaintenanceStatus(id: string, status: string) {
  await requireEditor()

  // 旧ステータスを取得して、変更があれば活動を自動生成
  const before = await db.select({
    status:     maintenance_records.status,
    account_id: maintenance_records.account_id,
    contact_id: maintenance_records.contact_id,
    owner_id:   maintenance_records.owner_id,
  })
    .from(maintenance_records).where(eq(maintenance_records.id, id))
    .then((r) => r[0] ?? null)

  await db.update(maintenance_records)
    .set({ status, updated_at: new Date() })
    .where(eq(maintenance_records.id, id))

  // 変更があれば対応する活動を自動 INSERT
  if (before && before.status !== status) {
    const tmpl = AUTO_ACTIVITY_BY_STATUS[status]
    if (tmpl) {
      const [a] = await db.insert(activities).values({
        type:     tmpl.type,
        subject:  tmpl.subject,
        body:     tmpl.body,
        owner_id: before.owner_id,
      }).returning({ id: activities.id })

      // junction: maintenance / account / contact に紐付け
      const relations: Array<{ activity_id: string; related_object_api: string; related_record_id: string }> = [
        { activity_id: a.id, related_object_api: 'maintenance', related_record_id: id },
      ]
      if (before.account_id) {
        relations.push({ activity_id: a.id, related_object_api: 'account', related_record_id: before.account_id })
      }
      if (before.contact_id) {
        relations.push({ activity_id: a.id, related_object_api: 'contact', related_record_id: before.contact_id })
      }
      await db.insert(activity_related_records).values(relations)
    }
  }

  revalidatePath(`/maintenance/${id}`)
}
