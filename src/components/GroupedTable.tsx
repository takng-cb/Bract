'use client'

import React, { useState, useCallback, ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { FieldDef } from '@/components/FilterBuilder'
import { parseSortParams, toggleSort, sortParamsToString } from '@/lib/sortUtils'

// ────────────────────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────────────────────

export type ColDef = {
  key: string
  label: string
  align?: 'left' | 'right'
  render: (record: Record<string, unknown>) => ReactNode
}

type GroupNode = {
  pathKey: string
  displayLabel: string
  records: Record<string, unknown>[]
  children: GroupNode[]
}

// ────────────────────────────────────────────────────────────
// ユーティリティ
// ────────────────────────────────────────────────────────────

function getNestedValue(record: Record<string, unknown>, fieldPath: string): string {
  const parts = fieldPath.split('.')
  let cur: unknown = record
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return ''
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur != null ? String(cur) : ''
}

function getGroupLabel(fields: FieldDef[], fieldKey: string, rawValue: string): string {
  const field = fields.find((f) => f.value === fieldKey)
  if (field?.type === 'select' && field.options) {
    const opt = field.options.find((o) => o.value === rawValue)
    if (opt) return opt.label
  }
  return rawValue || '（未設定）'
}

function buildGroups(
  records: Record<string, unknown>[],
  groupBy: string[],
  fields: FieldDef[],
  depth = 0,
  parentPath = '',
): GroupNode[] {
  if (depth >= groupBy.length) return []
  const fieldKey = groupBy[depth]
  const map = new Map<string, Record<string, unknown>[]>()
  for (const rec of records) {
    const val = getNestedValue(rec, fieldKey)
    if (!map.has(val)) map.set(val, [])
    map.get(val)!.push(rec)
  }
  return Array.from(map.entries()).map(([rawValue, recs]) => {
    const pathKey = `${parentPath}${depth}:${rawValue}`
    return {
      pathKey,
      displayLabel: getGroupLabel(fields, fieldKey, rawValue),
      records: recs,
      children:
        depth + 1 < groupBy.length
          ? buildGroups(recs, groupBy, fields, depth + 1, pathKey + '/')
          : [],
    }
  })
}

// ────────────────────────────────────────────────────────────
// GroupRows
// ────────────────────────────────────────────────────────────

const DEPTH_BG = ['bg-zinc-100', 'bg-zinc-50', 'bg-white']

function GroupRows({
  nodes, columns, depth, openPaths, toggle, colWidths,
}: {
  nodes: GroupNode[]
  columns: ColDef[]
  depth: number
  openPaths: Set<string>
  toggle: (key: string) => void
  colWidths: Record<string, number>
}) {
  const colSpan = columns.length
  return (
    <>
      {nodes.map((node) => {
        const isOpen = openPaths.has(node.pathKey)
        const indentRem = depth * 1.5
        const bgClass = DEPTH_BG[Math.min(depth, DEPTH_BG.length - 1)]

        return (
          <React.Fragment key={node.pathKey}>
            <tr className={`${bgClass} border-t border-zinc-200`}>
              <td colSpan={colSpan} className="px-4 py-2">
                <button
                  type="button"
                  onClick={() => toggle(node.pathKey)}
                  className="flex items-center gap-2 text-sm font-semibold text-zinc-700 hover:text-zinc-900 w-full text-left"
                  style={{ paddingLeft: `${indentRem}rem` }}
                >
                  <span className="text-zinc-400 text-xs w-3 shrink-0">
                    {isOpen ? '▼' : '▶'}
                  </span>
                  <span>{node.displayLabel}</span>
                  <span className="ml-1 text-xs font-normal text-zinc-400">
                    （{node.records.length} 件）
                  </span>
                </button>
              </td>
            </tr>

            {isOpen && (
              node.children.length > 0 ? (
                <GroupRows
                  nodes={node.children}
                  columns={columns}
                  depth={depth + 1}
                  openPaths={openPaths}
                  toggle={toggle}
                  colWidths={colWidths}
                />
              ) : (
                node.records.map((rec) => (
                  <tr key={`rec-${String(rec.id)}-${node.pathKey}`} className="hover:bg-blue-50/30 transition-colors border-t border-zinc-100">
                    {columns.map((col, ci) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 text-sm overflow-hidden ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                        style={{
                          ...(ci === 0 ? { paddingLeft: `${indentRem + 2.5}rem` } : undefined),
                          ...(colWidths[col.key] ? { width: colWidths[col.key], maxWidth: colWidths[col.key] } : undefined),
                        }}
                      >
                        {col.render(rec)}
                      </td>
                    ))}
                  </tr>
                ))
              )
            )}
          </React.Fragment>
        )
      })}
    </>
  )
}

// ────────────────────────────────────────────────────────────
// ソートアイコン
// ────────────────────────────────────────────────────────────

function SortIcon({ dir, rank }: { dir: 'asc' | 'desc' | null; rank: number | null }) {
  if (!dir) return <span className="text-zinc-300 text-xs ml-1">↕</span>
  return (
    <span className="ml-1 inline-flex items-center gap-0.5">
      <span className="text-blue-500 text-xs">{dir === 'asc' ? '▲' : '▼'}</span>
      {rank !== null && rank > 0 && (
        <span className="text-[9px] text-blue-400 font-medium">{rank + 1}</span>
      )}
    </span>
  )
}

// ────────────────────────────────────────────────────────────
// GroupedTable
// ────────────────────────────────────────────────────────────

type Props = {
  records: Record<string, unknown>[]
  columns: ColDef[]
  groupBy: string[]
  fields: FieldDef[]
  /** サーバーから渡す現在のソート文字列（例: "name:asc,status:desc"） */
  currentSortStr?: string
}

export default function GroupedTable({ records, columns, groupBy, fields, currentSortStr = '' }: Props) {
  const isFlat = groupBy.length === 0
  const groups = isFlat ? [] : buildGroups(records, groupBy, fields)

  const [openPaths, setOpenPaths] = useState<Set<string>>(() => {
    const s = new Set<string>()
    function collect(nodes: GroupNode[]) {
      for (const n of nodes) { s.add(n.pathKey); collect(n.children) }
    }
    collect(groups)
    return s
  })

  function toggle(key: string) {
    setOpenPaths((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // ── ソート ──────────────────────────────────────────────
  // useSearchParams を使わず、クリック時に window.location.search から読む
  const currentSort = parseSortParams(currentSortStr)
  const pathname = usePathname()
  const router = useRouter()

  function handleSortClick(field: string) {
    // クリック時点の URL パラメータを読む（useSearchParams 不要）
    const params = new URLSearchParams(
      typeof window !== 'undefined' ? window.location.search : ''
    )
    const sortStr = params.get('sort') ?? ''
    const cur = parseSortParams(sortStr)
    const newSort = toggleSort(cur, field, 3)
    const newSortStr = sortParamsToString(newSort)
    if (newSortStr) params.set('sort', newSortStr)
    else params.delete('sort')
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  // ── 列幅リサイズ ────────────────────────────────────────
  const [colWidths, setColWidths] = useState<Record<string, number>>({})

  const startResize = useCallback((colKey: string, e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = colWidths[colKey] ?? (e.currentTarget.parentElement?.offsetWidth ?? 120)

    function onMouseMove(ev: MouseEvent) {
      const newW = Math.max(60, startW + (ev.clientX - startX))
      setColWidths((prev) => ({ ...prev, [colKey]: newW }))
    }
    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [colWidths])

  return (
    <div className="bg-white rounded-lg border border-zinc-200 shadow-xs overflow-x-auto">
      <table className="w-full text-sm" style={{ tableLayout: 'fixed', minWidth: `${columns.length * 120 + 16}px` }}>
        <colgroup>
          {columns.map((col) => (
            <col key={col.key} style={colWidths[col.key] ? { width: colWidths[col.key] } : undefined} />
          ))}
        </colgroup>

        <thead className="bg-zinc-50 border-b border-zinc-200">
          <tr>
            {columns.map((col) => {
              const sortIdx = currentSort.findIndex((s) => s.field === col.key)
              const sortDir = sortIdx >= 0 ? currentSort[sortIdx].dir : null
              return (
                <th
                  key={col.key}
                  className={`relative px-4 py-2.5 font-semibold text-zinc-500 select-none group ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                  style={colWidths[col.key] ? { width: colWidths[col.key] } : undefined}
                >
                  <button
                    type="button"
                    onClick={() => handleSortClick(col.key)}
                    className="flex items-center gap-0.5 hover:text-zinc-900 transition-colors w-full"
                    style={col.align === 'right' ? { justifyContent: 'flex-end' } : undefined}
                    title="クリックでソート（3段階まで）"
                  >
                    <span className="truncate">{col.label}</span>
                    <SortIcon dir={sortDir} rank={sortIdx} />
                  </button>
                  <div
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-blue-400 active:bg-blue-600 transition-opacity"
                    onMouseDown={(e) => startResize(col.key, e)}
                  />
                </th>
              )
            })}
          </tr>
        </thead>

        {isFlat ? (
          <tbody className="divide-y divide-zinc-100">
            {records.map((rec) => (
              <tr key={String(rec.id)} className="hover:bg-zinc-50 transition-colors">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 text-sm overflow-hidden ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                    style={colWidths[col.key] ? { width: colWidths[col.key], maxWidth: colWidths[col.key] } : undefined}
                  >
                    {col.render(rec)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ) : (
          <tbody>
            <GroupRows
              nodes={groups}
              columns={columns}
              depth={0}
              openPaths={openPaths}
              toggle={toggle}
              colWidths={colWidths}
            />
          </tbody>
        )}
      </table>
    </div>
  )
}
