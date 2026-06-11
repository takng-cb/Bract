'use server'

import { db } from '@/lib/db'
import { trashRecord } from '@/lib/trash'
import { maintenance_records, vehicles, activities, activity_related_records } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { generateMaintenanceNo } from '@/industries/auto-body/lib/maintenanceNo'
import { requirePermission } from '@/lib/permissions'
import { inlineCreateAccount, inlineCreateCustomerVehicle } from '@/industries/auto-body/actions/maintenanceInline'

// 代車運用 (Issue #45):
//   vehicles.status は '在庫' / '販売済' / '整備中' などを取り得るが、
//   代車として貸出中は '代車中' を表す。専用テーブルは作らない方針。
const VEHICLE_STATUS_LOANER = '代車中'
const VEHICLE_STATUS_STOCK  = '在庫'

/**
 * 代車として割り当てた車両の vehicles.status を同期する。
 *   - 旧 loaner_vehicle_id があり、新と異なる/解除される → 旧を '在庫' に戻す
 *   - 新 loaner_vehicle_id があり、旧と異なる → 新を '代車中' に
 *   - 安全のため、旧車両が現在 '代車中' でなかった場合は触らない（手動で別状態にされていた可能性）
 */
async function syncLoanerVehicleStatus(
  previousLoanerVehicleId: string | null,
  nextLoanerVehicleId: string | null,
) {
  if (previousLoanerVehicleId === nextLoanerVehicleId) return

  if (previousLoanerVehicleId) {
    await db.update(vehicles)
      .set({ status: VEHICLE_STATUS_STOCK, updated_at: new Date() })
      .where(eq(vehicles.id, previousLoanerVehicleId))
  }
  if (nextLoanerVehicleId) {
    await db.update(vehicles)
      .set({ status: VEHICLE_STATUS_LOANER, updated_at: new Date() })
      .where(eq(vehicles.id, nextLoanerVehicleId))
  }
}

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
  await requirePermission('maintenance_records', 'create')

  // 「検索→なければ新規」（REQ-0042）：未選択のままテキスト入力されたものは保存時に作成して紐付ける
  let account_id = pick(formData, 'account_id')
  const contact_id_check = pick(formData, 'contact_id')
  const newAccountName = pick(formData, 'new_account_name')
  if (!account_id && newAccountName) {
    account_id = (await inlineCreateAccount({ name: newAccountName })).id
  }
  // BtoB は取引先（会社）、BtoC は contact（人物）のみで成立。いずれか必須。
  if (!account_id && !contact_id_check) {
    throw new Error('顧客（取引先または人物）は必須です')
  }

  let customer_vehicle_id = pick(formData, 'customer_vehicle_id')
  const newVehiclePlate = pick(formData, 'new_vehicle_plate')
  if (!customer_vehicle_id && newVehiclePlate) {
    customer_vehicle_id = (await inlineCreateCustomerVehicle({
      plate_number: newVehiclePlate,
      car_name:     pick(formData, 'new_vehicle_car_name') ?? undefined,
      account_id:   account_id ?? undefined,
      contact_id:   contact_id_check ?? undefined,
    })).id
  }
  if (!customer_vehicle_id) throw new Error('顧客車両は必須です')

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
  await requirePermission('maintenance_records', 'update')

  const customer_vehicle_id = pick(formData, 'customer_vehicle_id')
  if (!customer_vehicle_id) throw new Error('顧客車両は必須です')
  const account_id = pick(formData, 'account_id')
  const contact_id_check = pick(formData, 'contact_id')
  if (!account_id && !contact_id_check) {
    throw new Error('顧客（取引先または人物）は必須です')
  }

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
  await requirePermission('maintenance_records', 'delete')
  await trashRecord('maintenance_records', id)  // 実削除の前にゴミ箱へ退避（REQ-0047）

  // 代車が割り当てられたままなら、削除前に '在庫' に戻す
  const before = await db.select({
    loaner_vehicle_id: maintenance_records.loaner_vehicle_id,
  })
    .from(maintenance_records).where(eq(maintenance_records.id, id))
    .then((r) => r[0] ?? null)
  if (before?.loaner_vehicle_id) {
    await syncLoanerVehicleStatus(before.loaner_vehicle_id, null)
  }

  await db.delete(maintenance_records).where(eq(maintenance_records.id, id))
  revalidatePath('/maintenance')
  redirect('/maintenance')
}

/**
 * 代車セクション専用の部分更新アクション。
 * loaner_vehicle_id が変更された場合、vehicles.status を自動で同期する。
 */
export async function updateMaintenanceLoaner(
  id: string,
  data: {
    loaner_vehicle_id:   string | null
    loaner_handover_at:  string | null  // ISO8601 (datetime-local) or null
    loaner_return_at:    string | null
    loaner_mileage_out:  number | null
    loaner_mileage_in:   number | null
    loaner_fuel_out:     string | null
    loaner_fuel_in:      string | null
    loaner_notes:        string | null
  },
) {
  await requirePermission('maintenance_records', 'update')

  // 旧 loaner_vehicle_id を取得
  const before = await db.select({
    loaner_vehicle_id: maintenance_records.loaner_vehicle_id,
  })
    .from(maintenance_records).where(eq(maintenance_records.id, id))
    .then((r) => r[0] ?? null)
  if (!before) throw new Error('整備レコードが見つかりません')

  // ISO8601 文字列を Date に変換（空なら null）
  const toDate = (s: string | null) => (s && s.trim() ? new Date(s) : null)

  await db.update(maintenance_records).set({
    loaner_vehicle_id:  data.loaner_vehicle_id,
    loaner_handover_at: toDate(data.loaner_handover_at),
    loaner_return_at:   toDate(data.loaner_return_at),
    loaner_mileage_out: data.loaner_mileage_out,
    loaner_mileage_in:  data.loaner_mileage_in,
    loaner_fuel_out:    data.loaner_fuel_out,
    loaner_fuel_in:     data.loaner_fuel_in,
    loaner_notes:       data.loaner_notes,
    updated_at:         new Date(),
  }).where(eq(maintenance_records.id, id))

  // vehicles.status を同期
  await syncLoanerVehicleStatus(before.loaner_vehicle_id, data.loaner_vehicle_id)

  revalidatePath(`/maintenance/${id}`)
  revalidatePath('/vehicles')
}

// ─── 部分更新アクション（全体ビューのポップアップ編集用） ───
// updateMaintenance はリダイレクトする上に全項目必須の FormData を要求するため、
// インラインで部分更新するには扱いが重い。そこで「顧客・車両」と「整備基本情報+メモ」を
// 独立に更新できる軽量アクションを用意する。

/** 顧客・車両 セクション（左 sticky パネル）専用の更新アクション */
export async function updateMaintenanceCustomerVehicle(
  id: string,
  data: {
    customer_vehicle_id: string
    account_id:          string | null
    contact_id:          string | null
    billing_account_id:  string | null
  },
) {
  await requirePermission('maintenance_records', 'update')
  if (!data.customer_vehicle_id) throw new Error('顧客車両は必須です')
  // BtoB は取引先（会社）、BtoC は contact（人物）のみで成立。いずれか必須。
  if (!data.account_id && !data.contact_id) {
    throw new Error('顧客（取引先または人物）は必須です')
  }

  await db.update(maintenance_records).set({
    customer_vehicle_id: data.customer_vehicle_id,
    account_id:          data.account_id,
    contact_id:          data.contact_id,
    billing_account_id:  data.billing_account_id,
    updated_at:          new Date(),
  }).where(eq(maintenance_records.id, id))

  revalidatePath(`/maintenance/${id}`)
}

/** 整備本体（基本情報 + メモ）専用の更新アクション。
 *  ステータス・顧客・車両・請求先は別アクションのため触らない。
 */
export async function updateMaintenanceBasicAndMemo(
  id: string,
  data: {
    intake_date:          string | null
    intake_time:          string | null
    delivery_date:        string | null
    delivery_time:        string | null
    pickup_location:      string | null
    delivery_location:    string | null
    sales_recording_date: string | null
    mileage:              number | null
    branch_id:            string | null
    intake_category:      string | null
    reception_owner_id:   string | null
    worker_owner_id:      string | null
    internal_memo:        string | null
    work_order_note:      string | null
    general_note:         string | null
    tax_mode:             string | null
    tax_rounding:         string | null
    lever_rate:           string | null
  },
) {
  await requirePermission('maintenance_records', 'update')

  await db.update(maintenance_records).set({
    intake_date:          data.intake_date,
    intake_time:          data.intake_time,
    delivery_date:        data.delivery_date,
    delivery_time:        data.delivery_time,
    pickup_location:      data.pickup_location,
    delivery_location:    data.delivery_location,
    sales_recording_date: data.sales_recording_date,
    mileage:              data.mileage,
    branch_id:            data.branch_id,
    intake_category:      data.intake_category,
    reception_owner_id:   data.reception_owner_id,
    worker_owner_id:      data.worker_owner_id,
    internal_memo:        data.internal_memo,
    work_order_note:      data.work_order_note,
    general_note:         data.general_note,
    tax_mode:             data.tax_mode ?? '税別10%',
    tax_rounding:         data.tax_rounding ?? '切り捨て',
    lever_rate:           data.lever_rate,
    updated_at:           new Date(),
  }).where(eq(maintenance_records.id, id))

  revalidatePath(`/maintenance/${id}`)
}

// ─── ステータス遷移ごとに自動で活動を作るマッピング ──────────
const AUTO_ACTIVITY_BY_STATUS: Record<string, { type: string; subject: string; body: string } | null> = {
  '予約':       null,  // 予約は手動入力時点で完結している想定（活動を作らない）
  '受付':       { type: 'meeting', subject: '入庫・受付',         body: '受付完了。整備内容を確認し作業を開始予定。' },
  '作業中':     { type: 'note',    subject: '作業開始',           body: '整備作業に着手。' },
  '部品待ち':   { type: 'note',    subject: '部品入荷待ち',         body: '必要部品の入荷待ち。作業中断中。' },
  '納車待ち':   { type: 'note',    subject: '作業完了 → 納車準備', body: '全工程完了、お客様への納車連絡待ち。' },
  '完了':       { type: 'meeting', subject: '納車・整備完了',      body: 'お客様への納車完了。' },
  'キャンセル': { type: 'note',    subject: 'キャンセル受付',      body: 'お客様都合または店舗都合により整備をキャンセル。' },
}

export async function updateMaintenanceStatus(id: string, status: string) {
  await requirePermission('maintenance_records', 'update')

  // 旧ステータスを取得して、変更があれば活動を自動生成
  const before = await db.select({
    status:            maintenance_records.status,
    account_id:        maintenance_records.account_id,
    contact_id:        maintenance_records.contact_id,
    owner_id:          maintenance_records.owner_id,
    loaner_vehicle_id: maintenance_records.loaner_vehicle_id,
    loaner_return_at:  maintenance_records.loaner_return_at,
  })
    .from(maintenance_records).where(eq(maintenance_records.id, id))
    .then((r) => r[0] ?? null)

  // 完了/キャンセル遷移時、代車が割り当てられていれば自動返却
  //   - vehicles.status を '在庫' に戻す
  //   - 整備側の loaner_return_at が未記録なら現在時刻で埋める（手動修正可能）
  const isClosing = status === '完了' || status === 'キャンセル'
  const wasClosed = before?.status === '完了' || before?.status === 'キャンセル'
  const shouldAutoReturn = isClosing && !wasClosed && !!before?.loaner_vehicle_id

  if (shouldAutoReturn && before) {
    await syncLoanerVehicleStatus(before.loaner_vehicle_id, null)
  }

  await db.update(maintenance_records)
    .set({
      status,
      ...(shouldAutoReturn && !before?.loaner_return_at ? { loaner_return_at: new Date() } : {}),
      updated_at: new Date(),
    })
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

/**
 * 請求・支払セクション専用の部分更新アクション (Issue #48 Phase 2)。
 *
 * billing_target / invoice_no / invoice_issued_at / payment_due_date /
 * payment_status / payment_terms を編集する。既存の整備本体や行アイテムは触らない。
 */
export async function updateMaintenanceBilling(
  id: string,
  data: {
    billing_target:    string | null
    invoice_no:        string | null
    invoice_issued_at: string | null   // ISO date 'YYYY-MM-DD'
    payment_due_date:  string | null
    payment_status:    string | null
    payment_terms:     string | null
  },
) {
  await requirePermission('maintenance_records', 'update')

  await db.update(maintenance_records).set({
    billing_target:    data.billing_target,
    invoice_no:        data.invoice_no,
    invoice_issued_at: data.invoice_issued_at,
    payment_due_date:  data.payment_due_date,
    payment_status:    data.payment_status,
    payment_terms:     data.payment_terms,
    updated_at:        new Date(),
  }).where(eq(maintenance_records.id, id))

  revalidatePath(`/maintenance/${id}`)
  revalidatePath('/receivables')
}
