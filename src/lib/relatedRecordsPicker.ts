/**
 * activities/tasks/expenses の新規・編集フォームで使う RelatedRecordsPicker に
 * 業種オーバーレイ専用オブジェクト（maintenance / customer-vehicle 等）を
 * 追加するためのヘルパ。
 *
 * 標準オブジェクト（account/contact/opportunity）と DB の object_definitions
 * からのカスタムオブジェクトに加え、業種専用テーブル（auto-body の
 * maintenance_records / customer_vehicles 等）を Picker の objectTypes と
 * recordsByObject に追加する。
 *
 * 業種専用オブジェクトは `object_definitions` に行を持たないため、別経路で
 * UI のオプションとして提供する必要がある。
 */
import { db } from '@/lib/db'
import { maintenance_records, customer_vehicles, accounts, contacts, opportunities, custom_records, object_definitions } from '@/lib/schema'
import { desc, asc, eq } from 'drizzle-orm'
import { activeIndustry } from '@/lib/industry'
import type { ObjectTypeOption, RecordOption } from '@/components/RelatedRecordsPicker'
import { maintenanceDisplayName } from '@/industries/auto-body/lib/maintenanceDisplay'

export type IndustryPickerData = {
  /** objectTypes に追加する選択肢 */
  industryObjectTypes: ObjectTypeOption[]
  /** recordsByObject に merge する業種別レコード */
  industryRecordsByObject: Record<string, RecordOption[]>
}

/**
 * 現在の業種に応じて Picker 用の業種固有オプションを取得する。
 * auto-body のとき: maintenance / customer-vehicle を追加。
 */
export async function getIndustryPickerData(): Promise<IndustryPickerData> {
  if (activeIndustry !== 'auto-body') {
    return { industryObjectTypes: [], industryRecordsByObject: {} }
  }

  const [maintList, cvList] = await Promise.all([
    db.select({
      id:             maintenance_records.id,
      maintenance_no: maintenance_records.maintenance_no,
      status:         maintenance_records.status,
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
      .orderBy(desc(maintenance_records.created_at)),
    db.select({
      id:           customer_vehicles.id,
      plate_number: customer_vehicles.plate_number,
      car_name:     customer_vehicles.car_name,
      car_model:    customer_vehicles.car_model,
      account_name: accounts.name,
    })
      .from(customer_vehicles)
      .leftJoin(accounts, eq(customer_vehicles.account_id, accounts.id))
      .orderBy(asc(customer_vehicles.plate_number)),
  ])

  return {
    industryObjectTypes: [
      { api: 'maintenance',      label: '整備',     icon: '🔧' },
      { api: 'customer-vehicle', label: '顧客車両', icon: '🚙' },
    ],
    industryRecordsByObject: {
      maintenance: maintList.map((m) => {
        const acc  = m.account?.id ? m.account : null
        const con  = m.contact?.id ? m.contact : null
        const v    = m.vehicle?.id ? m.vehicle : null
        const name = maintenanceDisplayName({ intake_date: m.intake_date }, acc, con, v)
        return {
          id:    m.id,
          label: `${name} [${m.status}]`,
        }
      }),
      'customer-vehicle': cvList.map((v) => ({
        id:    v.id,
        label: [v.plate_number ?? '—', v.car_model, v.account_name].filter(Boolean).join(' / '),
      })),
    },
  }
}

/** カスタムレコードの表示名: data.name → data.title → "<ラベル> #<short id>" */
function customRecordTitle(
  data: Record<string, unknown> | null | undefined,
  objectLabel: string | null | undefined,
  recordId: string,
): string {
  const d = (data ?? {}) as Record<string, unknown>
  const name = typeof d.name === 'string' ? d.name : null
  const title = typeof d.title === 'string' ? d.title : null
  return name ?? title ?? `${objectLabel ?? 'カスタム'} #${recordId.slice(0, 8)}`
}

export type PickerKind = 'activities' | 'tasks' | 'expenses'

/**
 * 関連レコード Picker（活動/ToDo/経費の詳細インライン編集・新規/編集フォーム共通）
 * の objectTypes / recordsByObject を組み立てて返す。標準（取引先/人物/商談）＋
 * 当該機能を有効化したカスタムオブジェクト＋業種固有オブジェクトを含む。
 */
export async function getRelatedRecordsPickerData(_kind: PickerKind): Promise<{
  objectTypes: ObjectTypeOption[]
  recordsByObject: Record<string, RecordOption[]>
}> {
  // 関連レコードの「紐付け先」としては全カスタムオブジェクトを選べるようにする
  // （enable_activities/tasks/expenses は詳細ページのセクション表示用であり、
  //   ここで紐付け候補を絞る用途ではない）。
  const [accountsList, contactsList, opportunitiesList, enabledCustomObjects, allCustomRecords, industryPicker] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    db.select({ id: contacts.id, full_name: contacts.full_name })
      .from(contacts).orderBy(asc(contacts.full_name)),
    db.select({ id: opportunities.id, name: opportunities.name })
      .from(opportunities).orderBy(asc(opportunities.name)),
    db.select({ id: object_definitions.id, api_name: object_definitions.api_name, label: object_definitions.label, icon: object_definitions.icon })
      .from(object_definitions)
      .where(eq(object_definitions.is_builtin, false))
      .orderBy(asc(object_definitions.sort_order), asc(object_definitions.label)),
    db.select({ id: custom_records.id, object_id: custom_records.object_id, data: custom_records.data }).from(custom_records),
    getIndustryPickerData(),
  ])

  const objectTypes: ObjectTypeOption[] = [
    { api: 'account',     label: '取引先', icon: '🏢' },
    { api: 'contact',     label: '人物',   icon: '👤' },
    { api: 'opportunity', label: '商談',   icon: '💼' },
    ...industryPicker.industryObjectTypes,
    ...enabledCustomObjects.map((o) => ({ api: o.api_name, label: o.label, icon: o.icon ?? undefined })),
  ]

  const recordsByObject: Record<string, RecordOption[]> = {
    account:     accountsList.map((a) => ({ id: a.id, label: a.name })),
    contact:     contactsList.map((c) => ({ id: c.id, label: c.full_name })),
    opportunity: opportunitiesList.map((o) => ({ id: o.id, label: o.name })),
    ...industryPicker.industryRecordsByObject,
  }

  const objectIdToApiName = new Map(enabledCustomObjects.map((o) => [o.id, o.api_name]))
  const objectIdToLabel   = new Map(enabledCustomObjects.map((o) => [o.id, o.label]))
  for (const r of allCustomRecords) {
    const api = objectIdToApiName.get(r.object_id)
    if (!api) continue
    if (!recordsByObject[api]) recordsByObject[api] = []
    recordsByObject[api].push({ id: r.id, label: customRecordTitle(r.data as Record<string, unknown>, objectIdToLabel.get(r.object_id), r.id) })
  }

  return { objectTypes, recordsByObject }
}
