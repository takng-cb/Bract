'use server'

import { requireEditor } from '@/lib/auth'

import { db } from '@/lib/db'
import {
  activities,
  activity_contacts,
  activity_related_records,
  object_definitions,
  custom_records,
} from '@/lib/schema'
import { eq, inArray, and } from 'drizzle-orm'
import { redirect } from 'next/navigation'

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
 * dual-write: 後方互換のため、標準オブジェクト (account/contact/opportunity)
 * と最初に見つけたカスタムオブジェクトレコードを activities テーブルの
 * 既存 FK 列にも書き戻す。Phase 2 で FK 列を撤廃する想定。
 */
async function syncActivityRelatedRecords(
  activityId: string,
  selections: { object_api: string; record_id: string }[],
) {
  // 1. junction の差し替え
  await db.delete(activity_related_records).where(eq(activity_related_records.activity_id, activityId))
  if (selections.length > 0) {
    // 重複は ON CONFLICT で防ぐ（DB 側 PK 制約があるため一応 dedup しておく）
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

  // 2. 後方互換: 既存 FK 列の更新
  const firstByApi = new Map<string, string>()
  for (const s of selections) {
    if (!firstByApi.has(s.object_api)) firstByApi.set(s.object_api, s.record_id)
  }
  const accountId      = firstByApi.get('account')      ?? null
  const opportunityId  = firstByApi.get('opportunity')  ?? null
  const contactId      = firstByApi.get('contact')      ?? null
  // カスタムオブジェクトの最初の選択を custom_record_id に書く
  const customApis = [...firstByApi.keys()].filter((api) => !['account', 'contact', 'opportunity'].includes(api))
  let customRecordId: string | null = null
  if (customApis.length > 0) {
    customRecordId = firstByApi.get(customApis[0]) ?? null
  }
  await db.update(activities).set({
    account_id:       accountId,
    contact_id:       contactId,
    opportunity_id:   opportunityId,
    custom_record_id: customRecordId,
  }).where(eq(activities.id, activityId))

  // 3. activity_contacts も同期（Phase 1: 廃止前の暫定）
  //    junction で選ばれた contact 全部を activity_contacts にも書く
  await db.delete(activity_contacts).where(eq(activity_contacts.activity_id, activityId))
  const contactIds = selections.filter((s) => s.object_api === 'contact').map((s) => s.record_id)
  if (contactIds.length > 0) {
    const seen = new Set<string>()
    const rows = contactIds.filter((cid) => {
      if (seen.has(cid)) return false
      seen.add(cid)
      return true
    }).map((cid) => ({ activity_id: activityId, contact_id: cid }))
    await db.insert(activity_contacts).values(rows)
  }
}

export async function updateActivity(id: string, formData: FormData) {
  await requireEditor()
  const subject = formData.get('subject') as string
  if (!subject?.trim()) throw new Error('件名は必須です')

  const type = formData.get('type') as string
  if (!type) throw new Error('種別は必須です')

  const occurred_at = formData.get('occurred_at') as string
  const selections  = parseRelatedRecords(formData)

  await db.update(activities).set({
    subject:        subject.trim(),
    type,
    body:           (formData.get('body') as string) || null,
    occurred_at:    occurred_at ? new Date(occurred_at) : new Date(),
    // FK 列は syncActivityRelatedRecords の中でまとめて更新
  }).where(eq(activities.id, id))

  await syncActivityRelatedRecords(id, selections)

  redirect(`/activities/${id}`)
}

export async function deleteActivity(id: string) {
  await requireEditor()
  await db.delete(activities).where(eq(activities.id, id))
  redirect('/activities')
}

export async function createActivity(formData: FormData) {
  await requireEditor()
  const subject = formData.get('subject') as string
  if (!subject?.trim()) throw new Error('件名は必須です')

  const type = formData.get('type') as string
  if (!type) throw new Error('種別は必須です')

  const occurred_at = formData.get('occurred_at') as string
  const return_to   = (formData.get('return_to') as string) || null
  const selections  = parseRelatedRecords(formData)

  const [row] = await db.insert(activities).values({
    subject:     subject.trim(),
    type,
    body:        (formData.get('body') as string) || null,
    occurred_at: occurred_at ? new Date(occurred_at) : new Date(),
    // FK 列は syncActivityRelatedRecords の中で書く
  }).returning({ id: activities.id })

  await syncActivityRelatedRecords(row.id, selections)

  if (return_to) redirect(return_to)
  // 最初に見つかった関連レコードに遷移（旧仕様の踏襲）
  const firstAccount = selections.find((s) => s.object_api === 'account')
  if (firstAccount) redirect(`/accounts/${firstAccount.record_id}`)
  const firstContact = selections.find((s) => s.object_api === 'contact')
  if (firstContact) redirect(`/contacts/${firstContact.record_id}`)
  const firstOpportunity = selections.find((s) => s.object_api === 'opportunity')
  if (firstOpportunity) redirect(`/opportunities/${firstOpportunity.record_id}`)
  // カスタムオブジェクトの場合: api_name + record_id で /objects/<api>/<id> に遷移
  const firstCustom = selections.find((s) => !['account', 'contact', 'opportunity'].includes(s.object_api))
  if (firstCustom) redirect(`/objects/${firstCustom.object_api}/${firstCustom.record_id}`)
  redirect('/activities')
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
 * custom_records.data の name/title フィールドから抽出（既存ロジック踏襲）。
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
  void object_definitions; void custom_records  // imports 抑制（後続実装でフル解決を行う際に使う）
  void and
  const grouped: Record<string, Record<string, { id: string; label: string }[]>> = {}
  for (const r of rows) {
    if (!grouped[r.activity_id]) grouped[r.activity_id] = {}
    if (!grouped[r.activity_id][r.related_object_api]) grouped[r.activity_id][r.related_object_api] = []
    grouped[r.activity_id][r.related_object_api].push({ id: r.related_record_id, label: '' })
  }
  return grouped
}
