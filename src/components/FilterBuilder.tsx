'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { X } from 'lucide-react'

// ============================================================
// 型定義
// ============================================================

export type FieldType = 'text' | 'select' | 'number' | 'date'

export type FieldDef = {
  value: string
  label: string
  type: FieldType
  options?: { value: string; label: string }[]
}

type Condition = {
  uid: string
  field: string
  op: string
  value: string
}

// ============================================================
// 演算子定義
// ============================================================

export const OPERATORS: Record<FieldType, { value: string; label: string }[]> = {
  text: [
    { value: 'contains',     label: 'を含む' },
    { value: 'not_contains', label: 'を含まない' },
    { value: 'starts_with',  label: 'で始まる' },
    { value: 'eq',           label: 'と等しい' },
    { value: 'neq',          label: 'と等しくない' },
  ],
  select: [
    { value: 'eq',  label: 'と等しい' },
    { value: 'neq', label: 'と等しくない' },
  ],
  number: [
    { value: 'eq',  label: 'と等しい' },
    { value: 'gte', label: '以上' },
    { value: 'lte', label: '以下' },
  ],
  date: [
    { value: 'gte', label: '以降' },
    { value: 'lte', label: '以前' },
    { value: 'eq',  label: 'と等しい' },
  ],
}

// ============================================================
// ユーティリティ
// ============================================================

let _uid = 0
function newUid() { return String(++_uid) }

function parseInitial(raw: string[]): Condition[] {
  return raw
    .map((s) => {
      const idx1 = s.indexOf('|')
      const idx2 = s.indexOf('|', idx1 + 1)
      if (idx1 < 0 || idx2 < 0) return null
      return {
        uid:   newUid(),
        field: s.slice(0, idx1),
        op:    s.slice(idx1 + 1, idx2),
        value: s.slice(idx2 + 1),
      }
    })
    .filter((c): c is Condition => c !== null && c.value.trim() !== '')
}

// ============================================================
// コンポーネント
// ============================================================

type Props = {
  fields: FieldDef[]
  /** URL の f パラメータ（生の値配列）*/
  initialFilters: string[]
  /** 遷移先ベースパス（例: /accounts） */
  basePath: string
  /** 検索・クリア時に常に保持するパラメータ（例: 経費の year/month） */
  persistParams?: Record<string, string>
}

export default function FilterBuilder({
  fields,
  initialFilters,
  basePath,
  persistParams,
}: Props) {
  const router = useRouter()

  const [conditions, setConditions] = useState<Condition[]>(() =>
    parseInitial(initialFilters),
  )

  // ── 条件追加 ──────────────────────────────────────────────
  const addCondition = () => {
    const f  = fields[0]
    const op = OPERATORS[f.type][0].value
    setConditions((prev) => [...prev, { uid: newUid(), field: f.value, op, value: '' }])
  }

  // ── 条件削除 ──────────────────────────────────────────────
  const remove = (uid: string) =>
    setConditions((prev) => prev.filter((c) => c.uid !== uid))

  // ── 条件更新 ──────────────────────────────────────────────
  const update = (uid: string, key: keyof Omit<Condition, 'uid'>, val: string) => {
    setConditions((prev) =>
      prev.map((c) => {
        if (c.uid !== uid) return c
        // フィールドが変わったとき → 演算子・値をリセット
        if (key === 'field') {
          const newField = fields.find((f) => f.value === val) ?? fields[0]
          return { ...c, field: val, op: OPERATORS[newField.type][0].value, value: '' }
        }
        return { ...c, [key]: val }
      }),
    )
  }

  // ── URL 構築 & ナビゲーション ─────────────────────────────
  const buildParams = (conds: Condition[]) => {
    const params = new URLSearchParams(persistParams)
    for (const c of conds) {
      if (c.value.trim() !== '') params.append('f', `${c.field}|${c.op}|${c.value}`)
    }
    return params
  }

  const handleSearch = () => {
    const params = buildParams(conditions)
    router.push(`${basePath}?${params.toString()}`)
  }

  const handleClear = () => {
    setConditions([])
    const params = new URLSearchParams(persistParams)
    const qs = params.toString()
    router.push(qs ? `${basePath}?${qs}` : basePath)
  }

  const hasValue = conditions.some((c) => c.value.trim() !== '')

  // ── レンダリング ──────────────────────────────────────────
  return (
    <div className="mb-5 bg-zinc-50 border border-zinc-200 rounded-lg overflow-hidden">
      {/* 条件リスト */}
      <div className="p-3 space-y-2">
        {conditions.length === 0 ? (
          <p className="text-sm text-zinc-400 py-1 text-center">
            条件がありません。「＋ 条件を追加」で絞り込めます。
          </p>
        ) : (
          conditions.map((cond, idx) => {
            const fieldDef = fields.find((f) => f.value === cond.field) ?? fields[0]
            const ops      = OPERATORS[fieldDef.type]
            return (
              <div key={cond.uid} className="flex items-center gap-2">
                {/* 条件番号 */}
                <span className="text-xs text-zinc-400 w-4 shrink-0 text-right">{idx + 1}</span>

                {/* フィールド選択 */}
                <select
                  value={cond.field}
                  onChange={(e) => update(cond.uid, 'field', e.target.value)}
                  className="border border-zinc-300 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {fields.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>

                {/* 演算子 */}
                <select
                  value={cond.op}
                  onChange={(e) => update(cond.uid, 'op', e.target.value)}
                  className="border border-zinc-300 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ops.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>

                {/* 値入力 */}
                {fieldDef.type === 'select' ? (
                  <select
                    value={cond.value}
                    onChange={(e) => update(cond.uid, 'value', e.target.value)}
                    className="flex-1 min-w-0 border border-zinc-300 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">選択してください</option>
                    {(fieldDef.options ?? []).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={
                      fieldDef.type === 'number' ? 'number'
                      : fieldDef.type === 'date'   ? 'date'
                      : 'text'
                    }
                    value={cond.value}
                    onChange={(e) => update(cond.uid, 'value', e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="値を入力..."
                    className="flex-1 min-w-0 border border-zinc-300 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}

                {/* 削除ボタン */}
                <button
                  type="button"
                  onClick={() => remove(cond.uid)}
                  title="この条件を削除"
                  className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <X className="w-4 h-4" strokeWidth={2.25} aria-hidden />
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* フッター：追加ボタン + 検索/クリア */}
      <div className="flex items-center gap-3 px-3 py-2 border-t border-zinc-200 bg-white">
        <button
          type="button"
          onClick={addCondition}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
        >
          ＋ 条件を追加
        </button>
        <div className="flex-1" />
        {(conditions.length > 0 || hasValue) && (
          <button
            type="button"
            onClick={handleClear}
            className="text-sm text-zinc-500 hover:text-zinc-700 underline transition-colors"
          >
            クリア
          </button>
        )}
        <button
          type="button"
          onClick={handleSearch}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          検索
        </button>
      </div>
    </div>
  )
}
