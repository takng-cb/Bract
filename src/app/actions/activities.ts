'use server'

import { recordHref } from '@/lib/relatedRecords'
import { trashRecord } from '@/lib/trash'

import { db } from '@/lib/db'
import {
  activities,
  activity_related_records,
  book_definitions,
  book_records,
} from '@/lib/schema'
import { eq, inArray, and } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { withSaveToast } from '@/lib/saveToast'
import { requirePermission, requireRecordScope, recordScope, type CrudOp } from '@/lib/permissions'
import { assertNotPendingApproval } from '@/app/actions/approvals'

/** レコードスコープ（REQ-0083）。'own' のロールは自分担当でない活動を更新/削除できない。 */
async function guardActivityScope(id: string, op: CrudOp) {
  if ((await recordScope('activities', op)) !== 'own') return
  const [row] = await db.select({ owner_id: activities.owner_id }).from(activities).where(eq(activities.id, id))
  await requireRecordScope('activities', op, row?.owner_id ?? null)
}

/** related_records[] hidden inputs（"<api>:<id>"）をパース */
function parseRelatedRecords(formData: FormData): { object_api: string; record_id: string }[] {
  const raw = formData.getAll('related_records') as string[]
  const out: { object_api: string; record_id: string }[] = []
  for (const r of raw) {
    const idx = r.indexOf(':')
    if (idx < 0) continue
    const api = r.slice(0, idx).trim()
    const id  = r.slice(idx + 1).trim()
    if (api && id) out.push({ object_api: api, record_id: id })
  }
  return out
}

/**
 * 関連レコード選択を junction テーブルに反映する。
 * 既存行を全削除 → 新規挿入の素朴な実装。activity 単位の件数は通常少ない
 * (~数十件) ので問題ない。
 *
 * Phase 2 で FK 列への dual-write は撤廃済み。junction が唯一の関連先情報。
 */
async function syncActivityRelatedRecords(
  activityId: string,
  selections: { object_api: string; record_id: string }[],
) {
  await db.delete(activity_related_records).where(eq(activity_related_records.activity_id, activityId))
  if (selections.length > 0) {
    const seen = new Set<string>()
    const rows = selections
      .filter((s) => {
        const k = `${s.object_api}::${s.record_id}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      .map((s) => ({
        activity_id:        activityId,
        related_object_api: s.object_api,
        related_record_id:  s.record_id,
      }))
    if (rows.length > 0) {
      await db.insert(activity_related_records).values(rows).onConflictDoNothing()
    }
  }
}

/** 内容・担当のインライン編集用・部分更新（件名/種別/実施日時/関連には触れない）。 */
export async function updateActivityBasic(id: string, formData: FormData) {
  await requirePermission('activities', 'update')
  await guardActivityScope(id, 'update')
  await assertNotPendingApproval('activities', id)  // 承認待ち中は編集ロック（REQ-0023 / #131）
  const set: Record<string, unknown> = {}
  if (formData.has('subject') && (formData.get('subject') as string)?.trim()) set.subject = (formData.get('subject') as string).trim()
  if (formData.has('type') && (formData.get('type') as string)?.trim())       set.type = (formData.get('type') as string).trim()
  if (formData.has('occurred_at')) set.occurred_at = (formData.get('occurred_at') as string) ? new Date(formData.get('occurred_at') as string) : null
  if (formData.has('body'))     set.body = (formData.get('body') as string) || null
  if (formData.has('owner_id')) set.owner_id = (formData.get('owner_id') as string)?.trim() || null
  await db.update(activities).set(set).where(eq(activities.id, id))
  redirect(withSaveToast(`/activities/${id}`, 'saved'))
}

export async function updateActivity(id: string, formData: FormData) {
  await requirePermission('activities', 'update')
  await guardActivityScope(id, 'update')
  await assertNotPendingApproval('activities', id)  // 承認待ち中は編集ロック（REQ-0023 / #131）
  const subject = formData.get('subject') as string
  if (!subject?.trim()) throw new Error('件名は必須です')

  const type = formData.get('type') as string
  if (!type) throw new Error('種別は必須です')

  const occurred_at = formData.get('occurred_at') as string
  const selections  = parseRelatedRecords(formData)

  const owner_id = (formData.get('owner_id') as string)?.trim() || null

  await db.update(activities).set({
    subject:        subject.trim(),
    type,
    body:           (formData.get('body') as string) || null,
    occurred_at:    occurred_at ? new Date(occurred_at) : new Date(),
    owner_id,
    // FK 列は syncActivityRelatedRecords の中でまとめて更新
  }).where(eq(activities.id, id))

  await syncActivityRelatedRecords(id, selections)

  redirect(withSaveToast(`/activities/${id}`, 'saved'))
}

/** 関連レコードのインライン編集用・junction 同期のみ。 */
export async function updateActivityRelatedRecords(id: string, formData: FormData) {
  await requirePermission('activities', 'update')
  await guardActivityScope(id, 'update')
  await assertNotPendingApproval('activities', id)  // 承認待ち中は編集ロック（REQ-0023 / #131）
  await syncActivityRelatedRecords(id, parseRelatedRecords(formData))
  redirect(withSaveToast(`/activities/${id}`, 'saved'))
}

export async function deleteActivity(id: string) {
  await requirePermission('activities', 'delete')
  await guardActivityScope(id, 'delete')
  await assertNotPendingApproval('activities', id)  // 承認待ち中は削除も不可（REQ-0023 / #131）
  await trashRecord('activities', id)  // 実削除の前にゴミ箱へ退避（REQ-0047）
  await db.delete(activities).where(eq(activities.id, id))
  redirect(withSaveToast('/activities', 'deleted'))
}

export async function createActivity(formData: FormData) {
  await requirePermission('activities', 'create')
  const subject = formData.get('subject') as string
  if (!subject?.trim()) throw new Error('件名は必須です')

  const type = formData.get('type') as string
  if (!type) throw new Error('種別は必須です')

  const occurred_at = formData.get('occurred_at') as string
  const return_to   = (formData.get('return_to') as string) || null
  const selections  = parseRelatedRecords(formData)

  const owner_id = (formData.get('owner_id') as string)?.trim() || null

  const [row] = await db.insert(activities).values({
    subject:     subject.trim(),
    type,
    body:        (formData.get('body') as string) || null,
    occurred_at: occurred_at ? new Date(occurred_at) : new Date(),
    owner_id,
    // FK 列は syncActivityRelatedRecords の中で書く
  }).returning({ id: activities.id })

  await syncActivityRelatedRecords(row.id, selections)

  if (return_to) redirect(withSaveToast(return_to, 'created'))
  // 最初に見つかった関連レコードに遷移（旧仕様の踏襲）
  const firstAccount = selections.find((s) => s.object_api === 'account')
  if (firstAccount) redirect(withSaveToast(`/accounts/${firstAccount.record_id}`, 'created'))
  const firstContact = selections.find((s) => s.object_api === 'contact')
  if (firstContact) redirect(withSaveToast(`/contacts/${firstContact.record_id}`, 'created'))
  const firstOpportunity = selections.find((s) => s.object_api === 'opportunity')
  if (firstOpportunity) redirect(withSaveToast(`/opportunities/${firstOpportunity.record_id}`, 'created'))
  // カスタムオブジェクトの場合: api_name + record_id で /books/<api>/<id> に遷移
  const firstCustom = selections.find((s) => !['account', 'contact', 'opportunity'].includes(s.object_api))
  if (firstCustom) redirect(withSaveToast(recordHref(firstCustom.object_api, firstCustom.record_id), 'created'))
  redirect(withSaveToast('/activities', 'created'))
}

/**
 * インラインコンポーザ用・その場で活動を作成（遷移せず revalidate のみ）。
 * related_records で紐づくレコードを受け取り、junction を同期する。
 */
export async function quickCreateActivity(formData: FormData) {
  await requirePermission('activities', 'create')
  const subject = (formData.get('subject') as string)?.trim()
  if (!subject) throw new Error('件名は必須です')
  const type = (formData.get('type') as string) || 'note'
  const occurred_at = formData.get('occurred_at') as string
  const owner_id = (formData.get('owner_id') as string)?.trim() || null
  const [row] = await db.insert(activities).values({
    subject, type,
    body: (formData.get('body') as string)?.trim() || null,
    occurred_at: occurred_at ? new Date(occurred_at) : new Date(),
    owner_id,
  }).returning({ id: activities.id })
  await syncActivityRelatedRecords(row.id, parseRelatedRecords(formData))
  const revalidate = formData.get('revalidate') as string
  if (revalidate) revalidatePath(revalidate)
}

/**
 * 指定された複数の活動 ID について、それぞれの関連レコード一覧を取得する。
 * 活動詳細ページ・編集ページで使用。
 *
 * 戻り値は activityId をキーに、object_api → { id, label } のグルーピング
 * された Map（軽量化のため string 配列ではなく Record）。
 *
 * 標準オブジェクトの label は accounts.name / contacts.full_name /
 * opportunities.name から取得。カスタムオブジェクトの label は
 * book_records.data の name/title フィールドから抽出（既存ロジック踏襲）。
 */
export async function getRelatedRecordsForActivities(activityIds: string[]) {
  if (activityIds.length === 0) return {} as Record<string, Record<string, { id: string; label: string }[]>>
  const rows = await db.select({
    activity_id:        activity_related_records.activity_id,
    related_object_api: activity_related_records.related_object_api,
    related_record_id:  activity_related_records.related_record_id,
  })
    .from(activity_related_records)
    .where(inArray(activity_related_records.activity_id, activityIds))

  // 標準オブジェクトのラベル取得（一回で SQL 投げる必要があるが、簡潔さ重視で別途実装）
  // ここでは API のみ返し、ラベル解決は呼び出し側で行う想定にしておく
  // 必要に応じてあとで JOIN ベースに最適化する
  void book_definitions; void book_records  // imports 抑制（後続実装でフル解決を行う際に使う）
  void and
  const grouped: Record<string, Record<string, { id: string; label: string }[]>> = {}
  for (const r of rows) {
    if (!grouped[r.activity_id]) grouped[r.activity_id] = {}
    if (!grouped[r.activity_id][r.related_object_api]) grouped[r.activity_id][r.related_object_api] = []
    grouped[r.activity_id][r.related_object_api].push({ id: r.related_record_id, label: '' })
  }
  return grouped
}
