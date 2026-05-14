/**
 * 関連レコード junction (activity_related_records / task_related_records /
 * expense_related_records) で参照される (object_api, record_id) ペアを
 * 「表示用ラベル + 遷移先 href + アイコン」に解決するヘルパ。
 *
 * 多態性のため、object_api ごとに参照先テーブルが異なる:
 *   - 'account'                    → accounts.name
 *   - 'contact'                    → contacts.full_name
 *   - 'opportunity'                → opportunities.name
 *   - <custom api_name>            → custom_records.data の name/title など
 *
 * 標準オブジェクトはアイコンと href プレフィクスをハードコード。カスタムは
 * object_definitions テーブルから icon と api_name を引いて URL を組み立てる。
 *
 * 入力ペア数が多くなりがちなので、各テーブルへの問い合わせは IN リストで
 * 一括実行する（N+1 を避ける）。
 */
import { db } from '@/lib/db'
import {
  accounts, contacts, opportunities,
  custom_records, object_definitions,
  activity_related_records, task_related_records, expense_related_records,
} from '@/lib/schema'
import { inArray, eq, and } from 'drizzle-orm'

/**
 * 逆引きサブクエリ: 指定オブジェクト・レコードに関連付けられた activity ID 一覧。
 * 親レコード詳細ページの「関連活動」表示で使う:
 *   db.select().from(activities)
 *     .where(inArray(activities.id, activityIdsRelatedTo('account', accountId)))
 */
export function activityIdsRelatedTo(objectApi: string, recordId: string) {
  return db.select({ id: activity_related_records.activity_id })
    .from(activity_related_records)
    .where(and(
      eq(activity_related_records.related_object_api, objectApi),
      eq(activity_related_records.related_record_id, recordId),
    ))
}

/** タスク逆引き（task 用 junction が populated されたら使える） */
export function taskIdsRelatedTo(objectApi: string, recordId: string) {
  return db.select({ id: task_related_records.task_id })
    .from(task_related_records)
    .where(and(
      eq(task_related_records.related_object_api, objectApi),
      eq(task_related_records.related_record_id, recordId),
    ))
}

/** 経費逆引き（expense 用 junction が populated されたら使える） */
export function expenseIdsRelatedTo(objectApi: string, recordId: string) {
  return db.select({ id: expense_related_records.expense_id })
    .from(expense_related_records)
    .where(and(
      eq(expense_related_records.related_object_api, objectApi),
      eq(expense_related_records.related_record_id, recordId),
    ))
}

/**
 * 親レコード削除時に呼ぶ junction クリーンアップ。
 *
 * Phase 2 で FK 列を削除すると DB レベルの ON DELETE CASCADE が消えるため、
 * アプリ層で「親レコードを参照していた junction 行」を削除する必要がある。
 *
 * 使い方:
 *   await cleanupRelatedRecordsForParent('account', accountId)
 *   await db.delete(accounts).where(eq(accounts.id, accountId))
 *
 * 業務挙動の変化:
 *   旧: 取引先削除 → ON DELETE CASCADE で関連活動・ToDo・経費も削除
 *   新: 取引先削除 → junction 行のみ削除、活動・ToDo・経費は他の関連先が
 *       残っていれば残存（ユーザー承認済みの新仕様）
 */
export async function cleanupRelatedRecordsForParent(objectApi: string, recordId: string) {
  await Promise.all([
    db.delete(activity_related_records)
      .where(and(
        eq(activity_related_records.related_object_api, objectApi),
        eq(activity_related_records.related_record_id, recordId),
      )),
    db.delete(task_related_records)
      .where(and(
        eq(task_related_records.related_object_api, objectApi),
        eq(task_related_records.related_record_id, recordId),
      )),
    db.delete(expense_related_records)
      .where(and(
        eq(expense_related_records.related_object_api, objectApi),
        eq(expense_related_records.related_record_id, recordId),
      )),
  ])
}

export type RelatedPair = {
  object_api: string
  record_id:  string
}

export type ResolvedRecord = {
  object_api: string
  record_id:  string
  label:      string
  icon:       string
  href:       string
}

const STANDARD_META: Record<string, { icon: string; hrefPrefix: string }> = {
  account:     { icon: '🏢', hrefPrefix: '/accounts/' },
  contact:     { icon: '👤', hrefPrefix: '/contacts/' },
  opportunity: { icon: '💼', hrefPrefix: '/opportunities/' },
}

/** custom_records.data から表示名を導出（既存ロジック踏襲） */
function customRecordLabel(
  data: unknown,
  objectLabel: string | null,
  recordId: string,
): string {
  const d = (data ?? {}) as Record<string, unknown>
  const name = typeof d.name === 'string' ? d.name : null
  const title = typeof d.title === 'string' ? d.title : null
  return name ?? title ?? `${objectLabel ?? 'カスタム'} #${recordId.slice(0, 8)}`
}

/**
 * (object_api, record_id) のリストを表示用に解決する。
 * 入力順序は保持される。解決できなかったペアは「— (削除済み)」として返す
 * （UI 側で薄く表示する想定）。
 */
export async function resolveRelatedRecords(pairs: RelatedPair[]): Promise<ResolvedRecord[]> {
  if (pairs.length === 0) return []

  // api ごとに record_id を集約
  const idsByApi = new Map<string, Set<string>>()
  for (const p of pairs) {
    if (!idsByApi.has(p.object_api)) idsByApi.set(p.object_api, new Set())
    idsByApi.get(p.object_api)!.add(p.record_id)
  }

  // 標準オブジェクトをまとめて取得
  const labelByKey = new Map<string, string>()  // key = "<api>::<id>"
  const setLabel = (api: string, id: string, label: string) => labelByKey.set(`${api}::${id}`, label)

  const fetches: Promise<unknown>[] = []

  const accountIds = idsByApi.get('account')
  if (accountIds && accountIds.size > 0) {
    fetches.push(
      db.select({ id: accounts.id, name: accounts.name })
        .from(accounts).where(inArray(accounts.id, [...accountIds]))
        .then((rows) => { for (const r of rows) setLabel('account', r.id, r.name) })
    )
  }

  const contactIds = idsByApi.get('contact')
  if (contactIds && contactIds.size > 0) {
    fetches.push(
      db.select({ id: contacts.id, full_name: contacts.full_name })
        .from(contacts).where(inArray(contacts.id, [...contactIds]))
        .then((rows) => { for (const r of rows) setLabel('contact', r.id, r.full_name) })
    )
  }

  const opportunityIds = idsByApi.get('opportunity')
  if (opportunityIds && opportunityIds.size > 0) {
    fetches.push(
      db.select({ id: opportunities.id, name: opportunities.name })
        .from(opportunities).where(inArray(opportunities.id, [...opportunityIds]))
        .then((rows) => { for (const r of rows) setLabel('opportunity', r.id, r.name) })
    )
  }

  // カスタムオブジェクトの解決
  const customApis = [...idsByApi.keys()].filter((api) => !STANDARD_META[api])
  const customIconByApi = new Map<string, string>()
  const customLabelByApi = new Map<string, string>()
  if (customApis.length > 0) {
    // 各 api に対応する object_definitions を一括取得
    fetches.push(
      db.select({
        id:       object_definitions.id,
        api_name: object_definitions.api_name,
        icon:     object_definitions.icon,
        label:    object_definitions.label,
      })
        .from(object_definitions)
        .where(inArray(object_definitions.api_name, customApis))
        .then((rows) => {
          for (const r of rows) {
            customIconByApi.set(r.api_name, r.icon || '🗂️')
            customLabelByApi.set(r.api_name, r.label)
          }
        })
    )

    // カスタム record の data を取得（全 api 横断で id IN リスト）
    const allCustomIds = customApis.flatMap((api) => [...(idsByApi.get(api) ?? new Set<string>())])
    if (allCustomIds.length > 0) {
      fetches.push(
        db.select({
          id:        custom_records.id,
          object_id: custom_records.object_id,
          data:      custom_records.data,
          api_name:  object_definitions.api_name,
          obj_label: object_definitions.label,
        })
          .from(custom_records)
          .innerJoin(object_definitions, eq(custom_records.object_id, object_definitions.id))
          .where(inArray(custom_records.id, allCustomIds))
          .then((rows) => {
            for (const r of rows) {
              setLabel(r.api_name, r.id, customRecordLabel(r.data, r.obj_label, r.id))
            }
          })
      )
    }
  }

  await Promise.all(fetches)

  // 入力順を保ったまま組み立て
  return pairs.map((p) => {
    const std = STANDARD_META[p.object_api]
    const label = labelByKey.get(`${p.object_api}::${p.record_id}`) ?? '— (削除済み)'
    const icon  = std ? std.icon : (customIconByApi.get(p.object_api) ?? '🗂️')
    const href  = std
      ? `${std.hrefPrefix}${p.record_id}`
      : `/objects/${p.object_api}/${p.record_id}`
    return { object_api: p.object_api, record_id: p.record_id, label, icon, href }
  })
}
