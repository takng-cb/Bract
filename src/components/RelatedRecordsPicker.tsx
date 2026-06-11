'use client'

/**
 * 関連レコードの複数選択 Picker（オンデマンド検索版）。
 * 活動・ToDo・経費フォームと詳細ページのインライン編集で使う共通 UI。
 *
 * 旧実装はサーバーから「全オブジェクトの全レコード」を props で受け取っていたが、
 * データ増加でページが重くなるため、/api/search/records をその場で叩く方式に変更。
 *   - 行を追加しオブジェクトを選ぶと、最近更新 30 件を表示
 *   - 検索ボックス入力で 250ms デバウンス検索
 *   - 選択済みはチップ表示（検索結果に出ていなくても保持・解除可能）
 *   - defaultValue（編集時の既存選択）は ids= でラベルを一括解決
 *
 * 送信形式は従来どおり hidden input name={name} value="<object_api>:<record_id>"。
 */
import { useState, useMemo, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export type ObjectTypeOption = {
  api:   string   // 'account' | 'contact' | 'opportunity' | 'maintenance' | <custom api_name>
  label: string
  icon?: string   // 旧互換（未使用）
}

export type RecordOption = {
  id:    string
  label: string
  sub?:  string
}

export type RelatedRecordSelection = {
  object_api: string
  record_id:  string
  /** 既知ならラベル（無ければ API で解決） */
  label?: string
}

type Props = {
  name?:            string
  objectTypes:      ObjectTypeOption[]
  /** @deprecated オンデマンド検索化により未使用（呼び出し側互換のため残置） */
  recordsByObject?: Record<string, RecordOption[]>
  defaultValue?:    RelatedRecordSelection[]
  defaultObjectApi?: string
}

type Row = {
  uid: string
  object_api: string
  /** 選択済み: id → label */
  selected: Map<string, string>
  search: string
  results: RecordOption[]
  loading: boolean
}

function genUid() { return Math.random().toString(36).slice(2, 10) }

async function fetchRecords(objectApi: string, params: Record<string, string>): Promise<RecordOption[]> {
  const sp = new URLSearchParams({ objectType: objectApi, ...params })
  const res = await fetch(`/api/search/records?${sp.toString()}`)
  if (!res.ok) return []
  return res.json()
}

/** defaultValue を行配列にグルーピング（ラベル未解決は後で ids= で解決） */
function groupDefaultsToRows(defaults: RelatedRecordSelection[]): Row[] {
  const grouped: Record<string, Map<string, string>> = {}
  for (const d of defaults) {
    if (!grouped[d.object_api]) grouped[d.object_api] = new Map()
    grouped[d.object_api].set(d.record_id, d.label ?? '…')
  }
  return Object.entries(grouped).map(([api, sel]) => ({
    uid: genUid(), object_api: api, selected: sel, search: '', results: [], loading: false,
  }))
}

export default function RelatedRecordsPicker({
  name = 'related_records',
  objectTypes,
  defaultValue = [],
  defaultObjectApi,
}: Props) {
  const [rows, setRows] = useState<Row[]>(() => groupDefaultsToRows(defaultValue))
  const labelResolvedRef = useRef(false)

  const usedApis = useMemo(() => new Set(rows.map((r) => r.object_api).filter(Boolean)), [rows])

  const firstAvailableApi = useMemo(() => {
    const candidates = [defaultObjectApi, ...objectTypes.map((t) => t.api)]
    for (const c of candidates) if (c && !usedApis.has(c)) return c
    return ''
  }, [defaultObjectApi, objectTypes, usedApis])

  // ── 既存選択のラベルを ids= で一括解決（初回のみ）──
  useEffect(() => {
    if (labelResolvedRef.current) return
    labelResolvedRef.current = true
    const targets = rows.filter((r) => Array.from(r.selected.values()).some((v) => v === '…'))
    if (targets.length === 0) return
    ;(async () => {
      for (const row of targets) {
        const ids = Array.from(row.selected.keys())
        const recs = await fetchRecords(row.object_api, { ids: ids.join(','), limit: String(ids.length) })
        const byId = new Map(recs.map((r) => [r.id, r.label]))
        setRows((prev) => prev.map((r) => {
          if (r.uid !== row.uid) return r
          const next = new Map(r.selected)
          for (const id of next.keys()) {
            if (next.get(id) === '…') next.set(id, byId.get(id) ?? `#${id.slice(0, 8)}`)
          }
          return { ...r, selected: next }
        }))
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 行ごとの検索（デバウンス）──
  function loadResults(uid: string, objectApi: string, q: string) {
    setRows((prev) => prev.map((r) => r.uid === uid ? { ...r, loading: true } : r))
    fetchRecords(objectApi, q ? { q } : {}).then((recs) => {
      setRows((prev) => prev.map((r) => {
        if (r.uid !== uid) return r
        if (r.object_api !== objectApi || r.search.trim() !== q) return r  // 古い応答は破棄
        return { ...r, results: recs, loading: false }
      }))
    })
  }

  function addRow() {
    const api = firstAvailableApi
    const uid = genUid()
    setRows((prev) => [...prev, { uid, object_api: api, selected: new Map(), search: '', results: [], loading: !!api }])
    if (api) loadResults(uid, api, '')
  }

  function removeRow(uid: string) {
    setRows((prev) => prev.filter((r) => r.uid !== uid))
  }

  function changeObject(uid: string, newApi: string) {
    setRows((prev) => prev.map((r) =>
      r.uid === uid ? { ...r, object_api: newApi, selected: new Map(), search: '', results: [], loading: !!newApi } : r
    ))
    if (newApi) loadResults(uid, newApi, '')
  }

  function toggleRecord(uid: string, rec: RecordOption) {
    setRows((prev) => prev.map((r) => {
      if (r.uid !== uid) return r
      const next = new Map(r.selected)
      if (next.has(rec.id)) next.delete(rec.id)
      else next.set(rec.id, rec.label)
      return { ...r, selected: next }
    }))
  }

  function unselect(uid: string, recordId: string) {
    setRows((prev) => prev.map((r) => {
      if (r.uid !== uid) return r
      const next = new Map(r.selected)
      next.delete(recordId)
      return { ...r, selected: next }
    }))
  }

  // 検索デバウンス
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  function setSearch(uid: string, objectApi: string, value: string) {
    setRows((prev) => prev.map((r) => r.uid === uid ? { ...r, search: value } : r))
    clearTimeout(debounceRef.current[uid])
    debounceRef.current[uid] = setTimeout(() => loadResults(uid, objectApi, value.trim()), 250)
  }

  // 初期行（編集時）も結果を読み込む（effect 内の同期 setState を避けるため遅延起動）
  useEffect(() => {
    const t = setTimeout(() => {
      for (const r of rows) {
        if (r.object_api && r.results.length === 0 && !r.loading) loadResults(r.uid, r.object_api, '')
      }
    }, 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const flatSelections = rows.flatMap((r) =>
    Array.from(r.selected.keys()).map((rid) => ({ object_api: r.object_api, record_id: rid }))
  )

  const remainingTypes = objectTypes.filter((t) => !usedApis.has(t.api))
  const canAddRow = remainingTypes.length > 0

  return (
    <div className="space-y-3">
      {/* 集約された hidden inputs（サーバ送信用） */}
      {flatSelections.map((s, i) => (
        <input key={`${s.object_api}-${s.record_id}-${i}`} type="hidden" name={name} value={`${s.object_api}:${s.record_id}`} />
      ))}

      {rows.length === 0 && (
        <p className="text-sm text-zinc-500">
          関連レコードがまだありません。「+ 関連レコードを追加」をクリックして追加してください。
        </p>
      )}

      {rows.map((row) => {
        const availableForThisRow = objectTypes.filter(
          (t) => t.api === row.object_api || !usedApis.has(t.api)
        )
        return (
          <div key={row.uid} className="border border-zinc-200 rounded-md p-3 bg-zinc-50/50 space-y-2">
            <div className="flex items-start gap-2">
              <select
                value={row.object_api}
                onChange={(e) => changeObject(row.uid, e.target.value)}
                className="border border-zinc-300 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {!row.object_api && <option value="">— ブックを選択 —</option>}
                {availableForThisRow.map((t) => (
                  <option key={t.api} value={t.api}>{t.label}</option>
                ))}
              </select>
              <div className="flex-1" />
              {row.selected.size > 0 && (
                <span className="text-xs text-blue-600 font-medium pt-1.5">{row.selected.size} 件選択中</span>
              )}
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

            {row.object_api && (
              <>
                {/* 選択済みチップ（検索結果に無くても保持） */}
                {row.selected.size > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(row.selected.entries()).map(([id, label]) => (
                      <span key={id} className="inline-flex items-center gap-1 max-w-full rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs pl-2.5 pr-1 py-0.5">
                        <span className="truncate">{label}</span>
                        <button type="button" onClick={() => unselect(row.uid, id)} aria-label="解除" className="shrink-0 rounded-full hover:bg-blue-100 p-0.5">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <input
                  type="text"
                  value={row.search}
                  onChange={(e) => setSearch(row.uid, row.object_api, e.target.value)}
                  placeholder="レコードを名前で検索..."
                  className="w-full border border-zinc-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {row.loading ? (
                  <p className="text-xs text-zinc-400 px-2 py-1">検索中…</p>
                ) : row.results.length === 0 ? (
                  <p className="text-xs text-zinc-400 px-2 py-1">
                    {row.search.trim() ? '該当するレコードがありません' : 'レコードがありません'}
                  </p>
                ) : (
                  <div className="border border-zinc-200 rounded-md divide-y divide-zinc-100 max-h-40 overflow-y-auto bg-white">
                    {row.results.map((rec) => {
                      const checked = row.selected.has(rec.id)
                      return (
                        <label
                          key={rec.id}
                          className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-zinc-50 ${checked ? 'bg-blue-50' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRecord(row.uid, rec)}
                            className="accent-blue-600"
                          />
                          <span className="text-sm text-zinc-700 truncate">{rec.label}</span>
                          {rec.sub && <span className="text-xs text-zinc-400 shrink-0 ml-auto">{rec.sub}</span>}
                        </label>
                      )
                    })}
                    {!row.search.trim() && row.results.length >= 30 && (
                      <p className="text-[11px] text-zinc-400 px-3 py-1.5">最近更新の30件を表示中。検索で絞り込めます</p>
                    )}
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
        {canAddRow ? '+ 関連レコードを追加' : '全てのブックが既に追加されています'}
      </button>
    </div>
  )
}
