/**
 * 関連レコード junction (activity_related_records / task_related_records /
 * expense_related_records) で参照される (object_api, record_id) ペアを
 * 「表示用ラベル + 遷移先 href + アイコン」に解決するヘルパ。
 *
 * 多態性のため、object_api ごとに参照先テーブルが異なる:
 *   - 'account'                    → accounts.name
 *   - 'contact'                    → contacts.full_name
 *   - 'opportunity'                → opportunities.name
 *   - <custom api_name>            → book_records.data の name/title など
 *
 * 標準オブジェクトはアイコンと href プレフィクスをハードコード。カスタムは
 * book_definitions テーブルから icon と api_name を引いて URL を組み立てる。
 *
 * 入力ペア数が多くなりがちなので、各テーブルへの問い合わせは IN リストで
 * 一括実行する（N+1 を避ける）。
 */
import { db } from '@/lib/db'
import {
  accounts, contacts, opportunities,
  book_records, book_definitions,
  activity_related_records, task_related_records, expense_related_records,
  maintenance_records, customer_vehicles,
} from '@/lib/schema'
import { inArray, eq, and } from 'drizzle-orm'
import { maintenanceDisplayName } from '@/industries/auto-body/lib/maintenanceDisplay'

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
 * 複数の活動・タスク・経費について、それぞれの関連レコード一覧を一括取得して
 * ラベル解決まで済ませる。詳細ページで「他に紐づいているレコード」を表示する
 * 用途で使う（N+1 を避けるためのバッチ版）。
 *
 * 戻り値: host_id → 解決済み関連レコード配列の Map。
 *
 * 使い方:
 *   const map = await batchResolveRelatedRecords('activity', activitiesList.map(a => a.id))
 *   const myRelations = map.get(activityId) ?? []
 *   // 自レコードを除外して表示
 *   const others = myRelations.filter(r => !(r.object_api === 'account' && r.record_id === currentAccountId))
 */
export async function batchResolveRelatedRecords(
  hostType: 'activity' | 'task' | 'expense',
  hostIds: string[],
): Promise<Map<string, ResolvedRecord[]>> {
  if (hostIds.length === 0) return new Map()

  // ホスト種別ごとのテーブル・列を決定
  const cfg = hostType === 'activity'
    ? { table: activity_related_records, idCol: activity_related_records.activity_id }
    : hostType === 'task'
      ? { table: task_related_records, idCol: task_related_records.task_id }
      : { table: expense_related_records, idCol: expense_related_records.expense_id }

  const rows = await db.select({
    host_id:    cfg.idCol,
    object_api: cfg.table.related_object_api,
    record_id:  cfg.table.related_record_id,
  })
    .from(cfg.table)
    .where(inArray(cfg.idCol, hostIds))

  if (rows.length === 0) return new Map()

  // 重複する (api, record_id) ペアを抑止してから解決
  const uniqMap = new Map<string, RelatedPair>()
  for (const r of rows) {
    uniqMap.set(`${r.object_api}::${r.record_id}`, { object_api: r.object_api, record_id: r.record_id })
  }
  const resolved = await resolveRelatedRecords([...uniqMap.values()])
  const resolvedByKey = new Map(resolved.map((r) => [`${r.object_api}::${r.record_id}`, r]))

  // host_id ごとに配列を組み立て
  const result = new Map<string, ResolvedRecord[]>()
  for (const r of rows) {
    const key = `${r.object_api}::${r.record_id}`
    const rec = resolvedByKey.get(key)
    if (!rec) continue
    if (!result.has(r.host_id)) result.set(r.host_id, [])
    result.get(r.host_id)!.push(rec)
  }
  return result
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
  account:            { icon: '🏢', hrefPrefix: '/accounts/' },
  contact:            { icon: '👤', hrefPrefix: '/contacts/' },
  opportunity:        { icon: '💼', hrefPrefix: '/opportunities/' },
  // 業種オーバーレイ (auto-body) の専用ルートを持つオブジェクト。
  // /books/<api>/<id> ではなく業種専用 URL に向ける。
  maintenance:        { icon: '🔧', hrefPrefix: '/maintenance/' },
  'customer-vehicle': { icon: '🚙', hrefPrefix: '/customer-vehicles/' },
}

/**
 * object_api + record_id を遷移先 href に解決する。
 * 標準/業種専用ルート（maintenance 等）を優先し、無ければ汎用 /books/<api>/<id>。
 * 例: maintenance は /books/maintenance/<id>（=404）ではなく /maintenance/<id> に向ける。
 */
export function recordHref(objectApi: string, recordId: string): string {
  const std = STANDARD_META[objectApi]
  return std ? `${std.hrefPrefix}${recordId}` : `/books/${objectApi}/${recordId}`
}

/** book_records.data から表示名を導出（既存ロジック踏襲） */
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

  // 業種オーバーレイ専用オブジェクトのラベル解決
  const maintenanceIds = idsByApi.get('maintenance')
  if (maintenanceIds && maintenanceIds.size > 0) {
    fetches.push(
      // 表示名 = {受付日YYYYMMDD}_{顧客}_{車種}
      db.select({
        id:             maintenance_records.id,
        maintenance_no: maintenance_records.maintenance_no,
        intake_date:    maintenance_records.intake_date,
        account:        { id: accounts.id, name: accounts.name },
        contact:        { id: contacts.id, full_name: contacts.full_name },
        vehicle:        {
          id:        customer_vehicles.id,
          car_name:  customer_vehicles.car_name,
          car_model: customer_vehicles.car_model,
        },
      })
        .from(maintenance_records)
        .leftJoin(accounts, eq(maintenance_records.account_id, accounts.id))
        .leftJoin(contacts, eq(maintenance_records.contact_id, contacts.id))
        .leftJoin(customer_vehicles, eq(maintenance_records.customer_vehicle_id, customer_vehicles.id))
        .where(inArray(maintenance_records.id, [...maintenanceIds]))
        .then((rows) => {
          for (const r of rows) {
            const acc = r.account?.id ? r.account : null
            const con = r.contact?.id ? r.contact : null
            const v   = r.vehicle?.id ? r.vehicle : null
            const label = maintenanceDisplayName({ intake_date: r.intake_date }, acc, con, v)
            setLabel('maintenance', r.id, label)
          }
        })
    )
  }
  const customerVehicleIds = idsByApi.get('customer-vehicle')
  if (customerVehicleIds && customerVehicleIds.size > 0) {
    fetches.push(
      db.select({
        id:           customer_vehicles.id,
        plate_number: customer_vehicles.plate_number,
        car_model:    customer_vehicles.car_model,
        car_name:     customer_vehicles.car_name,
      })
        .from(customer_vehicles).where(inArray(customer_vehicles.id, [...customerVehicleIds]))
        .then((rows) => {
          for (const r of rows) {
            const label = r.plate_number ?? r.car_model ?? r.car_name ?? '車両'
            setLabel('customer-vehicle', r.id, label)
          }
        })
    )
  }

  // カスタムオブジェクトの解決
  const customApis = [...idsByApi.keys()].filter((api) => !STANDARD_META[api])
  const customIconByApi = new Map<string, string>()
  const customLabelByApi = new Map<string, string>()
  if (customApis.length > 0) {
    // 各 api に対応する book_definitions を一括取得
    fetches.push(
      db.select({
        id:       book_definitions.id,
        api_name: book_definitions.api_name,
        icon:     book_definitions.icon,
        label:    book_definitions.label,
      })
        .from(book_definitions)
        .where(inArray(book_definitions.api_name, customApis))
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
          id:        book_records.id,
          object_id: book_records.object_id,
          data:      book_records.data,
          api_name:  book_definitions.api_name,
          obj_label: book_definitions.label,
        })
          .from(book_records)
          .innerJoin(book_definitions, eq(book_records.object_id, book_definitions.id))
          .where(inArray(book_records.id, allCustomIds))
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
      : `/books/${p.object_api}/${p.record_id}`
    return { object_api: p.object_api, record_id: p.record_id, label, icon, href }
  })
}
