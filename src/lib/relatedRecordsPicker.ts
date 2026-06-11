/**
 * activities/tasks/expenses の新規・編集フォームで使う RelatedRecordsPicker に
 * 業種オーバーレイ専用オブジェクト（maintenance / customer-vehicle 等）を
 * 追加するためのヘルパ。
 *
 * 標準オブジェクト（account/contact/opportunity）と DB の book_definitions
 * からのカスタムオブジェクトに加え、業種専用テーブル（auto-body の
 * maintenance_records / customer_vehicles 等）を Picker の objectTypes と
 * recordsByObject に追加する。
 *
 * 業種専用オブジェクトは `book_definitions` に行を持たないため、別経路で
 * UI のオプションとして提供する必要がある。
 */
import { db } from '@/lib/db'
import { book_definitions } from '@/lib/schema'
import { asc, eq } from 'drizzle-orm'
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

  // レコード本体はオンデマンド検索（/api/search/records）に移行したため、
  // ここでは選択肢（オブジェクト種別）のみ返す。
  return {
    industryObjectTypes: [
      { api: 'maintenance',      label: '整備' },
      { api: 'customer-vehicle', label: '顧客車両' },
    ],
    industryRecordsByObject: {},
  }
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
  // レコード本体はオンデマンド検索（/api/search/records）に移行（REQ-0026/性能改善）。
  // ここでは「選べるブック一覧」だけを返す。recordsByObject は旧 API 互換の空オブジェクト。
  // 紐付け先としては全カスタムオブジェクトを選べる（enable_* はセクション表示用でありゲートではない）。
  const [customObjects, industryPicker] = await Promise.all([
    db.select({ id: book_definitions.id, api_name: book_definitions.api_name, label: book_definitions.label })
      .from(book_definitions)
      .where(eq(book_definitions.is_builtin, false))
      .orderBy(asc(book_definitions.sort_order), asc(book_definitions.label)),
    getIndustryPickerData(),
  ])

  const objectTypes: ObjectTypeOption[] = [
    { api: 'account',     label: '取引先' },
    { api: 'contact',     label: '人物' },
    { api: 'opportunity', label: '商談' },
    ...industryPicker.industryObjectTypes,
    ...customObjects.map((o) => ({ api: o.api_name, label: o.label })),
  ]

  return { objectTypes, recordsByObject: {} }
}
