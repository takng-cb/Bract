'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SlidersHorizontal } from 'lucide-react'
import FilterBuilder, { type FieldDef } from '@/components/FilterBuilder'

type GroupField = { key: string; label: string }

type Props = {
  fields: FieldDef[]
  initialFilters: string[]
  basePath: string
  groupableFields: GroupField[]
  initialGroup: string        // e.g. "stage,status"
  persistParams?: Record<string, string>
}

export default function ListViewToolbar({
  fields,
  initialFilters,
  basePath,
  groupableFields,
  initialGroup,
  persistParams,
}: Props) {
  const router = useRouter()

  const groupValues = initialGroup ? initialGroup.split(',').filter(Boolean) : []
  const activeFilterCount = initialFilters.length
  const activeGroupCount  = groupValues.length

  const [filterOpen, setFilterOpen] = useState(activeFilterCount > 0)
  const [groupOpen,  setGroupOpen]  = useState(false)
  const [g1, setG1] = useState(groupValues[0] ?? '')
  const [g2, setG2] = useState(groupValues[1] ?? '')
  const [g3, setG3] = useState(groupValues[2] ?? '')

  function buildBaseParams() {
    // preserve filter params from current URL
    const url    = new URL(window.location.href)
    const params = new URLSearchParams()
    for (const v of url.searchParams.getAll('f')) params.append('f', v)
    for (const [k, v] of Object.entries(persistParams ?? {})) params.set(k, v)
    return params
  }

  function applyGrouping() {
    const groups = [g1, g2, g3].filter(Boolean)
    const params = buildBaseParams()
    if (groups.length > 0) params.set('group', groups.join(','))
    router.push(`${basePath}?${params.toString()}`)
    setGroupOpen(false)
  }

  function clearGrouping() {
    const params = buildBaseParams()
    setG1(''); setG2(''); setG3('')
    router.push(`${basePath}?${params.toString()}`)
    setGroupOpen(false)
  }

  return (
    <div className="mb-5 space-y-2">
      {/* ── トグルボタン行 ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setFilterOpen((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
            filterOpen || activeFilterCount > 0
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4 inline -mt-0.5" strokeWidth={2.25} /> フィルター
          {activeFilterCount > 0 && (
            <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center leading-none">
              {activeFilterCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setGroupOpen((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
            groupOpen || activeGroupCount > 0
              ? 'bg-violet-50 border-violet-300 text-violet-700'
              : 'bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50'
          }`}
        >
          ⊞ グルーピング
          {activeGroupCount > 0 && (
            <span className="bg-violet-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center leading-none">
              {activeGroupCount}
            </span>
          )}
        </button>
      </div>

      {/* ── フィルターパネル ── */}
      {filterOpen && (
        <FilterBuilder
          fields={fields}
          initialFilters={initialFilters}
          basePath={basePath}
          persistParams={{
            ...persistParams,
            ...(initialGroup ? { group: initialGroup } : {}),
          }}
        />
      )}

      {/* ── グルーピングパネル ── */}
      {groupOpen && (
        <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-violet-700">グルーピング（最大3つ）</p>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { val: g1, set: setG1, ph: '第1グループ', disabled: false },
                { val: g2, set: setG2, ph: '第2グループ', disabled: !g1 },
                { val: g3, set: setG3, ph: '第3グループ', disabled: !g2 },
              ] as const
            ).map((item, i) => (
              <select
                key={i}
                value={item.val}
                onChange={(e) => {
                  if (i === 0) { setG1(e.target.value); setG2(''); setG3('') }
                  if (i === 1) { setG2(e.target.value); setG3('') }
                  if (i === 2) { setG3(e.target.value) }
                }}
                disabled={item.disabled}
                className="border border-violet-300 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="">— {item.ph} —</option>
                {groupableFields.map((f) => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </select>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={applyGrouping}
              className="px-3 py-1.5 bg-violet-600 text-white text-sm font-medium rounded-md hover:bg-violet-700 transition-colors"
            >
              適用
            </button>
            {activeGroupCount > 0 && (
              <button
                type="button"
                onClick={clearGrouping}
                className="text-sm text-violet-600 hover:underline"
              >
                グルーピングをクリア
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
