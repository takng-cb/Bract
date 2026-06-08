'use client'

/**
 * 関連レコードの複数選択 Picker。活動・ToDo・経費フォームの「関連レコード」
 * セクションで使う共通 UI。
 *
 * 動作:
 *   - 「+ 関連レコードを追加」で行を増やす
 *   - 各行: [オブジェクト dropdown] [レコード multi-select (search + checkbox)] [✕]
 *   - 同じオブジェクトを複数行に追加することは禁止（行内で複数選択するため）
 *   - 選択結果は <input type="hidden" name={name} value="<object_api>:<record_id>" /> として
 *     繰り返し送信される。サーバ側で split(':') してパース。
 *
 * Props:
 *   - name: form field 名（既定 'related_records'）
 *   - objectTypes: 選択可能なオブジェクト一覧（標準 + 有効カスタム）
 *   - recordsByObject: オブジェクト api_name → そのレコード一覧
 *   - defaultValue: 既存の選択（編集画面で使用）
 *
 * 既存 FK 列 (account_id/contact_id/opportunity_id/custom_record_id) との
 * dual-write: Phase 1 では本 Picker の出力 + 旧フィールドの両方をサーバ側で
 * 書き込む。後続フェーズで FK 列を撤廃する想定。
 */
import { useState, useMemo } from 'react'

export type ObjectTypeOption = {
  api:   string   // 'account' | 'contact' | 'opportunity' | <custom api_name>
  label: string   // '取引先' | '人物' | '商談' | カスタムオブジェクトのラベル
  icon?: string   // 表示用の絵文字（任意）
}

export type RecordOption = {
  id:    string
  label: string
}

export type RelatedRecordSelection = {
  object_api: string
  record_id:  string
}

type Props = {
  name?:            string
  objectTypes:      ObjectTypeOption[]
  recordsByObject:  Record<string, RecordOption[]>
  defaultValue?:    RelatedRecordSelection[]
  /** 行を追加した直後にデフォルトで選ばれるオブジェクト（初回のみ） */
  defaultObjectApi?: string
}

type Row = {
  /** 行を識別する一時 ID（React key 用） */
  uid: string
  /** この行で選ばれているオブジェクト */
  object_api: string
  /** この行で選ばれているレコード ID の集合 */
  record_ids: Set<string>
  /** レコード検索ボックスの入力値 */
  search: string
}

function genUid() { return Math.random().toString(36).slice(2, 10) }

/** defaultValue を行配列にグルーピング */
function groupDefaultsToRows(defaults: RelatedRecordSelection[]): Row[] {
  const grouped: Record<string, Set<string>> = {}
  for (const d of defaults) {
    if (!grouped[d.object_api]) grouped[d.object_api] = new Set()
    grouped[d.object_api].add(d.record_id)
  }
  return Object.entries(grouped).map(([api, ids]) => ({
    uid: genUid(),
    object_api: api,
    record_ids: ids,
    search: '',
  }))
}

export default function RelatedRecordsPicker({
  name = 'related_records',
  objectTypes,
  recordsByObject,
  defaultValue = [],
  defaultObjectApi,
}: Props) {
  const [rows, setRows] = useState<Row[]>(() => groupDefaultsToRows(defaultValue))

  /** 各行のオブジェクト api（重複を防ぐためのチェック用） */
  const usedApis = useMemo(() => new Set(rows.map((r) => r.object_api).filter(Boolean)), [rows])

  /** 「+追加」したときに自動選択するオブジェクト */
  const firstAvailableApi = useMemo(() => {
    const candidates = [defaultObjectApi, ...objectTypes.map((t) => t.api)]
    for (const c of candidates) {
      if (c && !usedApis.has(c)) return c
    }
    return ''  // 全部使われている場合
  }, [defaultObjectApi, objectTypes, usedApis])

  function addRow() {
    setRows((prev) => [
      ...prev,
      { uid: genUid(), object_api: firstAvailableApi, record_ids: new Set(), search: '' },
    ])
  }

  function removeRow(uid: string) {
    setRows((prev) => prev.filter((r) => r.uid !== uid))
  }

  function changeObject(uid: string, newApi: string) {
    setRows((prev) => prev.map((r) =>
      r.uid === uid ? { ...r, object_api: newApi, record_ids: new Set(), search: '' } : r
    ))
  }

  function toggleRecord(uid: string, recordId: string) {
    setRows((prev) => prev.map((r) => {
      if (r.uid !== uid) return r
      const next = new Set(r.record_ids)
      if (next.has(recordId)) next.delete(recordId)
      else next.add(recordId)
      return { ...r, record_ids: next }
    }))
  }

  function setSearch(uid: string, value: string) {
    setRows((prev) => prev.map((r) => r.uid === uid ? { ...r, search: value } : r))
  }

  /** flat な (object_api:record_id) の配列をすべての行から集約 */
  const flatSelections = rows.flatMap((r) =>
    Array.from(r.record_ids).map((rid) => ({ object_api: r.object_api, record_id: rid }))
  )

  const remainingTypes = objectTypes.filter((t) => !usedApis.has(t.api))
  const canAddRow = remainingTypes.length > 0

  return (
    <div className="space-y-3">
      {/* 集約された hidden inputs（サーバ送信用） */}
      {flatSelections.map((s, i) => (
        <input
          key={`${s.object_api}-${s.record_id}-${i}`}
          type="hidden"
          name={name}
          value={`${s.object_api}:${s.record_id}`}
        />
      ))}

      {rows.length === 0 && (
        <p className="text-sm text-zinc-500">
          関連レコードがまだありません。「+ 関連レコードを追加」をクリックして追加してください。
        </p>
      )}

      {rows.map((row) => {
        // この行で選択可能なオブジェクト = 自分が使ってる api + 他行で未使用の api
        const availableForThisRow = objectTypes.filter(
          (t) => t.api === row.object_api || !usedApis.has(t.api)
        )
        const allRecords = recordsByObject[row.object_api] ?? []
        const searchLower = row.search.trim().toLowerCase()
        const filteredRecords = searchLower
          ? allRecords.filter((r) => r.label.toLowerCase().includes(searchLower))
          : allRecords

        return (
          <div key={row.uid} className="border border-zinc-200 rounded-md p-3 bg-zinc-50/50 space-y-2">
            <div className="flex items-start gap-2">
              {/* オブジェクト選択 */}
              <select
                value={row.object_api}
                onChange={(e) => changeObject(row.uid, e.target.value)}
                className="border border-zinc-300 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {!row.object_api && <option value="">— オブジェクトを選択 —</option>}
                {availableForThisRow.map((t) => (
                  <option key={t.api} value={t.api}>
                    {t.icon ? `${t.icon} ` : ''}{t.label}
                  </option>
                ))}
              </select>

              <div className="flex-1" />

              {/* 選択数 */}
              {row.record_ids.size > 0 && (
                <span className="text-xs text-blue-600 font-medium pt-1.5">
                  {row.record_ids.size} 件選択中
                </span>
              )}

              {/* 削除 */}
              <button
                type="button"
                onClick={() => removeRow(row.uid)}
                className="text-zinc-400 hover:text-red-600 transition-colors p-1"
                aria-label="この行を削除"
                title="削除"
              >
                ✕
              </button>
            </div>

            {/* レコード選択（search + checkbox） */}
            {row.object_api && (
              <>
                <input
                  type="text"
                  value={row.search}
                  onChange={(e) => setSearch(row.uid, e.target.value)}
                  placeholder="レコードを名前で絞り込み..."
                  className="w-full border border-zinc-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {filteredRecords.length === 0 ? (
                  <p className="text-xs text-zinc-400 px-2 py-1">
                    {searchLower ? '該当するレコードがありません' : 'レコードがありません'}
                  </p>
                ) : (
                  <div className="border border-zinc-200 rounded-md divide-y divide-zinc-100 max-h-40 overflow-y-auto bg-white">
                    {filteredRecords.map((rec) => {
                      const checked = row.record_ids.has(rec.id)
                      return (
                        <label
                          key={rec.id}
                          className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-zinc-50 ${
                            checked ? 'bg-blue-50' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRecord(row.uid, rec.id)}
                            className="accent-blue-600"
                          />
                          <span className="text-sm text-zinc-700">{rec.label}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}

      <button
        type="button"
        onClick={addRow}
        disabled={!canAddRow}
        className="w-full border border-dashed border-zinc-300 rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 hover:border-zinc-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {canAddRow
          ? '+ 関連レコードを追加'
          : '全てのオブジェクトが既に追加されています'}
      </button>
    </div>
  )
}
