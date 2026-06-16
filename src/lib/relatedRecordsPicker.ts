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
import { getEnabledModules } from '@/lib/modules/registry'
import type { ObjectTypeOption, RecordOption } from '@/components/RelatedRecordsPicker'

/**
 * モジュール専用の型付きオブジェクト（dedicated route を持ち book_records ではない）。
 * 当該モジュールが有効なときだけ関連先の選択肢に出す。api は resolveRelatedRecords /
 * /api/search/records / recordHref の語彙と一致させる（REQ-0078）。
 */
const TYPED_LINK_TYPES: { api: string; label: string; icon: string; module: string }[] = [
  { api: 'maintenance',      label: '整備',     icon: '🔧',  module: 'auto-body' },
  { api: 'customer-vehicle', label: '顧客車両', icon: '🚙',  module: 'auto-body' },
  { api: 'vehicle',          label: '車両',     icon: '🚗',  module: 'auto-body' },
  { api: 'part',             label: '部品',     icon: '🪛',  module: 'auto-body' },
  { api: 'product',          label: '商品',     icon: '📦',  module: 'inventory' },
  { api: 'warehouse',        label: '倉庫',     icon: '🏬',  module: 'inventory' },
  { api: 'staff',            label: 'スタッフ', icon: '🧑‍💼', module: 'staffing' },
  { api: 'assignment',       label: '案件',     icon: '📋',  module: 'staffing' },
  { api: 'wiki',             label: 'Wiki',     icon: '📖',  module: 'workspace' },
  { api: 'project',          label: 'プロジェクト', icon: '🏗️', module: 'real-estate' },
]

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
  // 有効モジュールに属する型付きオブジェクトだけを選択肢に出す（REQ-0078）。
  // レコード本体はオンデマンド検索（/api/search/records）に委譲し、ここでは種別のみ。
  const modules = await getEnabledModules()
  const enabled = new Set(modules.map((m) => m.id))
  const industryObjectTypes: ObjectTypeOption[] = TYPED_LINK_TYPES
    .filter((t) => enabled.has(t.module))
    .map((t) => ({ api: t.api, label: t.label, icon: t.icon }))
  return { industryObjectTypes, industryRecordsByObject: {} }
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
  const [customBooks, industryPicker] = await Promise.all([
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
    ...customBooks.map((o) => ({ api: o.api_name, label: o.label })),
  ]

  return { objectTypes, recordsByObject: {} }
}
