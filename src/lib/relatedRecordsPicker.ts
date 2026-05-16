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
import { maintenance_records, customer_vehicles, accounts } from '@/lib/schema'
import { desc, asc, eq } from 'drizzle-orm'
import { activeIndustry } from '@/lib/industry'
import type { ObjectTypeOption, RecordOption } from '@/components/RelatedRecordsPicker'

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
      account_name:   accounts.name,
    })
      .from(maintenance_records)
      .leftJoin(accounts, eq(maintenance_records.account_id, accounts.id))
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
      maintenance: maintList.map((m) => ({
        id:    m.id,
        label: `${m.maintenance_no} [${m.status}] ${m.account_name ?? '—'}`,
      })),
      'customer-vehicle': cvList.map((v) => ({
        id:    v.id,
        label: [v.plate_number ?? '—', v.car_model, v.account_name].filter(Boolean).join(' / '),
      })),
    },
  }
}
