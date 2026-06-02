/**
 * 消耗品の前回交換履歴集計 (Phase A item 4)
 *
 * customer_vehicle に紐づく maintenance_line_items を業務上の
 * カテゴリ（オイル交換 / バッテリー / タイヤ / ブレーキパッド / 車検 / その他フィルタ系）
 * にマッピングし、各カテゴリの「直近の交換」を返す。
 *
 * work_category や item_name は自由文字列なので、業務でよく使われる
 * キーワードのマッチングで分類する（完全分類は今後の整理対象）。
 */

/** 集計対象のカテゴリ定義（id をキーとした表示順固定） */
export const CONSUMABLE_CATEGORIES = [
  { id: 'oil',         label: 'エンジンオイル交換', icon: '🛢️', keywords: ['オイル交換', 'エンジンオイル', 'オイルエレメント', 'オイルフィルタ'] },
  { id: 'battery',     label: 'バッテリー交換',     icon: '🔋', keywords: ['バッテリー'] },
  { id: 'tire',        label: 'タイヤ交換',         icon: '🛞', keywords: ['タイヤ交換', 'タイヤローテーション', 'タイヤ組替'] },
  { id: 'brake',       label: 'ブレーキパッド交換', icon: '🛑', keywords: ['ブレーキパッド', 'ブレーキシュー'] },
  { id: 'wiper',       label: 'ワイパー交換',       icon: '🌧️', keywords: ['ワイパー'] },
  { id: 'inspection',  label: '車検',               icon: '🚗', keywords: ['車検', '法定点検', '12ヶ月点検', '24ヶ月点検'] },
] as const

export type ConsumableCategoryId = (typeof CONSUMABLE_CATEGORIES)[number]['id']

/** 入力レコード（maintenance_line_items + 親 maintenance の値を join した形） */
export type LineWithMaintenance = {
  work_category: string | null
  item_name:     string | null
  intake_date:   string | null
  delivery_date: string | null
  mileage:       number | string | null
  maintenance_id:string
}

/** 集計結果 1 件 */
export type LatestConsumableEntry = {
  categoryId:    ConsumableCategoryId
  label:         string
  icon:          string
  date:          string | null      // 納車日 or 入庫日
  mileage:       number | null
  itemName:      string | null      // 実際の line.item_name
  maintenanceId: string
}

/**
 * lines を消耗カテゴリにマッピングし、各カテゴリの最新 1 件を返す。
 * 該当する line が無いカテゴリはエントリ自体が含まれない。
 */
export function aggregateLatestConsumables(lines: LineWithMaintenance[]): LatestConsumableEntry[] {
  // category 毎に該当 line を最新日付順で集める
  const byCat = new Map<ConsumableCategoryId, LineWithMaintenance[]>()
  for (const line of lines) {
    const haystack = `${line.work_category ?? ''} ${line.item_name ?? ''}`
    for (const cat of CONSUMABLE_CATEGORIES) {
      if (cat.keywords.some((kw) => haystack.includes(kw))) {
        if (!byCat.has(cat.id)) byCat.set(cat.id, [])
        byCat.get(cat.id)!.push(line)
        break // 1 行は 1 カテゴリにだけ寄せる
      }
    }
  }

  // カテゴリ定義の順序を保ちつつ、最新を 1 件抽出
  const out: LatestConsumableEntry[] = []
  for (const cat of CONSUMABLE_CATEGORIES) {
    const list = byCat.get(cat.id)
    if (!list || list.length === 0) continue
    const latest = list.reduce((a, b) => {
      const ad = a.delivery_date ?? a.intake_date ?? ''
      const bd = b.delivery_date ?? b.intake_date ?? ''
      return bd > ad ? b : a
    })
    out.push({
      categoryId:    cat.id,
      label:         cat.label,
      icon:          cat.icon,
      date:          latest.delivery_date ?? latest.intake_date,
      mileage:       latest.mileage == null ? null : Number(latest.mileage),
      itemName:      latest.item_name,
      maintenanceId: latest.maintenance_id,
    })
  }
  return out
}
