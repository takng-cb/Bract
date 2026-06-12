'use client'

/**
 * CSV エクスポート/インポートのツールバー。
 *
 * filterFields を渡すと、エクスポートボタンが**フィルタ指定ダイアログ**になる（REQ-0052）:
 * 条件（フィールド × 演算子 × 値）を組み立てて f パラメータ付きでダウンロードする。
 * 渡さない場合は従来どおり全件エクスポートのリンク。
 */
import { useState } from 'react'
import { X, Plus, Download } from 'lucide-react'
import TextImportModal from './TextImportModal'
import { OPERATORS, type FieldDef } from './FilterBuilder'

type Props = {
  exportUrl:     string
  importUrl:     string
  label:         string
  csvFormat:     string   // インポートモーダル内に表示するフォーマット文字列
  fieldOptions?: Record<string, string[]>  // 選択リスト項目の選択肢
  showImport?:   boolean
  /** 指定するとエクスポートがフィルタ指定ダイアログになる（REQ-0052） */
  filterFields?: FieldDef[]
}

type Condition = { uid: number; field: string; op: string; value: string }

function ExportDialog({ exportUrl, label, fields }: { exportUrl: string; label: string; fields: FieldDef[] }) {
  const [open, setOpen] = useState(false)
  const [conds, setConds] = useState<Condition[]>([])
  const [uid, setUid] = useState(1)

  const addCond = () => {
    const f = fields[0]
    setConds((prev) => [...prev, { uid, field: f.value, op: OPERATORS[f.type][0].value, value: '' }])
    setUid((n) => n + 1)
  }
  const update = (id: number, patch: Partial<Condition>) => {
    setConds((prev) => prev.map((c) => {
      if (c.uid !== id) return c
      if (patch.field !== undefined) {
        const nf = fields.find((f) => f.value === patch.field) ?? fields[0]
        return { ...c, field: nf.value, op: OPERATORS[nf.type][0].value, value: '' }
      }
      return { ...c, ...patch }
    }))
  }
  const remove = (id: number) => setConds((prev) => prev.filter((c) => c.uid !== id))

  const download = () => {
    const params = new URLSearchParams()
    for (const c of conds) {
      if (c.value.trim() !== '') params.append('f', `${c.field}|${c.op}|${c.value}`)
    }
    const qs = params.toString()
    window.location.href = qs ? `${exportUrl}?${qs}` : exportUrl
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 border border-zinc-300 text-zinc-600 text-xs font-medium rounded-md hover:bg-zinc-50 transition-colors"
      >
        ↓ エクスポート
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div className="w-full max-w-xl rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-zinc-900">{label}をエクスポート</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="閉じる" className="text-zinc-400 hover:text-zinc-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-xs text-zinc-500">
              条件を指定すると絞り込んだ結果だけを CSV 出力します（条件なし＝全件）。
            </p>

            <div className="space-y-2">
              {conds.map((c) => {
                const f = fields.find((x) => x.value === c.field) ?? fields[0]
                return (
                  <div key={c.uid} className="flex flex-wrap items-center gap-2">
                    <select value={c.field} onChange={(e) => update(c.uid, { field: e.target.value })} className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
                      {fields.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                    </select>
                    <select value={c.op} onChange={(e) => update(c.uid, { op: e.target.value })} className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
                      {OPERATORS[f.type].map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    {f.type === 'select' ? (
                      <select value={c.value} onChange={(e) => update(c.uid, { value: e.target.value })} className="min-w-36 rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
                        <option value="">選択してください</option>
                        {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input
                        type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                        value={c.value}
                        onChange={(e) => update(c.uid, { value: e.target.value })}
                        className="w-40 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm"
                      />
                    )}
                    <button type="button" onClick={() => remove(c.uid)} aria-label="条件を削除" className="text-zinc-300 hover:text-red-500">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
            </div>

            <button
              type="button"
              onClick={addCond}
              className="mt-2 inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
            >
              <Plus className="h-3.5 w-3.5" />条件を追加
            </button>

            <div className="mt-5 flex justify-end gap-2 border-t border-zinc-100 pt-4">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50">
                キャンセル
              </button>
              <button type="button" onClick={download} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                <Download className="h-4 w-4" />
                {conds.some((c) => c.value.trim()) ? 'この条件でエクスポート' : '全件エクスポート'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function CsvToolbar({
  exportUrl,
  importUrl,
  label,
  csvFormat,
  fieldOptions,
  showImport = true,
  filterFields,
}: Props) {
  return (
    <div className="hidden md:flex items-center gap-2">
      {/* エクスポート（filterFields があればフィルタ指定ダイアログ） */}
      {filterFields && filterFields.length > 0 ? (
        <ExportDialog exportUrl={exportUrl} label={label} fields={filterFields} />
      ) : (
        <a
          href={exportUrl}
          download
          className="px-3 py-1.5 border border-zinc-300 text-zinc-600 text-xs font-medium rounded-md hover:bg-zinc-50 transition-colors"
        >
          ↓ エクスポート
        </a>
      )}

      {/* インポート（ファイル／テキスト統一モーダル） */}
      {showImport && (
        <TextImportModal
          importUrl={importUrl}
          title={`${label}をインポート`}
          csvFormat={csvFormat}
          fieldOptions={fieldOptions}
        />
      )}
    </div>
  )
}
