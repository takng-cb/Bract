'use client'

import { useState, ReactNode } from 'react'
import type { FieldDef } from '@/components/FilterBuilder'

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
  pathKey: string        // "0-active" など、一意識別用
  displayLabel: string   // グループヘッダーに表示する文字列
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
// GroupRows — 再帰的にグループ行・レコード行を描画
// ────────────────────────────────────────────────────────────

const DEPTH_BG = [
  'bg-zinc-100',
  'bg-zinc-50',
  'bg-white',
]

function GroupRows({
  nodes,
  columns,
  depth,
  openPaths,
  toggle,
  detailHref,
}: {
  nodes: GroupNode[]
  columns: ColDef[]
  depth: number
  openPaths: Set<string>
  toggle: (key: string) => void
  detailHref: (r: Record<string, unknown>) => string
}) {
  const colSpan = columns.length + 1
  return (
    <>
      {nodes.map((node) => {
        const isOpen = openPaths.has(node.pathKey)
        const indentRem = depth * 1.5
        const bgClass = DEPTH_BG[Math.min(depth, DEPTH_BG.length - 1)]

        return (
          <tbody key={node.pathKey}>
            {/* グループヘッダー行 */}
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

            {/* 展開時: 子グループ or レコード */}
            {isOpen && (
              node.children.length > 0 ? (
                <GroupRows
                  nodes={node.children}
                  columns={columns}
                  depth={depth + 1}
                  openPaths={openPaths}
                  toggle={toggle}
                  detailHref={detailHref}
                />
              ) : (
                node.records.map((rec) => (
                  <tr key={String(rec.id)} className="hover:bg-blue-50/30 transition-colors border-t border-zinc-100">
                    {columns.map((col, ci) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 text-sm ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                        style={ci === 0 ? { paddingLeft: `${indentRem + 2.5}rem` } : undefined}
                      >
                        {col.render(rec)}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <a
                        href={detailHref(rec)}
                        className="text-blue-600 hover:text-blue-800 text-xs"
                      >
                        詳細 →
                      </a>
                    </td>
                  </tr>
                ))
              )
            )}
          </tbody>
        )
      })}
    </>
  )
}

// ────────────────────────────────────────────────────────────
// GroupedTable — メインコンポーネント
// ────────────────────────────────────────────────────────────

type Props = {
  records: Record<string, unknown>[]
  columns: ColDef[]
  groupBy: string[]       // 空配列 = フラット表示
  fields: FieldDef[]      // グループラベル変換に使用
  detailHref: (r: Record<string, unknown>) => string
}

export default function GroupedTable({ records, columns, groupBy, fields, detailHref }: Props) {
  const isFlat = groupBy.length === 0
  const groups = isFlat ? [] : buildGroups(records, groupBy, fields)

  // 初期: すべてのグループを展開した状態
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

  return (
    <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 border-b border-zinc-200">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 font-medium text-zinc-600 ${
                  col.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {col.label}
              </th>
            ))}
            <th className="px-4 py-3 w-16" />
          </tr>
        </thead>

        {isFlat ? (
          /* グルーピングなし: フラットにレコードを描画 */
          <tbody className="divide-y divide-zinc-100">
            {records.map((rec) => (
              <tr key={String(rec.id)} className="hover:bg-zinc-50 transition-colors">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 text-sm ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    {col.render(rec)}
                  </td>
                ))}
                <td className="px-4 py-3 text-right">
                  <a href={detailHref(rec)} className="text-blue-600 hover:text-blue-800 text-xs">
                    詳細 →
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        ) : (
          /* グルーピングあり: 再帰的グループ描画 */
          <GroupRows
            nodes={groups}
            columns={columns}
            depth={0}
            openPaths={openPaths}
            toggle={toggle}
            detailHref={detailHref}
          />
        )}
      </table>
    </div>
  )
}
