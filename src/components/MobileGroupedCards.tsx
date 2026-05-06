'use client'

import React, { useState } from 'react'
import type { FieldDef } from '@/components/FilterBuilder'

// ────────────────────────────────────────────────────────────
// グループ構造 構築
// ────────────────────────────────────────────────────────────

type GroupNode = {
  pathKey: string
  label: string
  records: Record<string, unknown>[]
  children: GroupNode[]
}

function getNestedValue(record: Record<string, unknown>, fieldPath: string): string {
  let cur: unknown = record
  for (const p of fieldPath.split('.')) {
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
      label: getGroupLabel(fields, fieldKey, rawValue),
      records: recs,
      children:
        depth + 1 < groupBy.length
          ? buildGroups(recs, groupBy, fields, depth + 1, pathKey + '/')
          : [],
    }
  })
}

// ────────────────────────────────────────────────────────────
// グループセクション（再帰）
// ────────────────────────────────────────────────────────────

const INDENT = ['', 'ml-3 border-l-2 border-zinc-100 pl-3', 'ml-3 border-l-2 border-zinc-100 pl-3']

function GroupSection({
  nodes,
  renderCard,
  depth,
  openPaths,
  toggle,
}: {
  nodes: GroupNode[]
  renderCard: (record: Record<string, unknown>) => React.ReactNode
  depth: number
  openPaths: Set<string>
  toggle: (key: string) => void
}) {
  return (
    <div className={INDENT[Math.min(depth, INDENT.length - 1)]}>
      {nodes.map((node) => {
        const isOpen = openPaths.has(node.pathKey)
        return (
          <div key={node.pathKey} className="mb-2">
            {/* グループヘッダー */}
            <button
              type="button"
              onClick={() => toggle(node.pathKey)}
              className="w-full flex items-center gap-2 px-3 py-2.5 bg-zinc-100 rounded-lg text-sm font-semibold text-zinc-700 hover:bg-zinc-200 active:bg-zinc-300 transition-colors"
            >
              <span className="text-zinc-400 text-xs w-3 shrink-0">
                {isOpen ? '▼' : '▶'}
              </span>
              <span className="flex-1 text-left truncate">{node.label}</span>
              <span className="shrink-0 text-xs font-normal text-zinc-400 tabular-nums">
                {node.records.length} 件
              </span>
            </button>

            {/* グループ内容 */}
            {isOpen && (
              <div className="mt-1 space-y-1.5">
                {node.children.length > 0 ? (
                  <GroupSection
                    nodes={node.children}
                    renderCard={renderCard}
                    depth={depth + 1}
                    openPaths={openPaths}
                    toggle={toggle}
                  />
                ) : (
                  node.records.map((r, i) => (
                    <React.Fragment key={String(r.id ?? i)}>
                      {renderCard(r)}
                    </React.Fragment>
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// MobileGroupedCards（公開 API）
// ────────────────────────────────────────────────────────────

type Props = {
  records: Record<string, unknown>[]
  groupBy: string[]
  fields: FieldDef[]
  /** レコード 1 件分のカード JSX を返す関数 */
  renderCard: (record: Record<string, unknown>) => React.ReactNode
}

export default function MobileGroupedCards({ records, groupBy, fields, renderCard }: Props) {
  const isFlat = groupBy.length === 0
  const groups = isFlat ? [] : buildGroups(records, groupBy, fields)

  // 初期状態: すべてのグループを展開
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

  // グルーピングなし: フラットなカードリスト
  if (isFlat) {
    return (
      <div className="space-y-2">
        {records.map((r, i) => (
          <React.Fragment key={String(r.id ?? i)}>{renderCard(r)}</React.Fragment>
        ))}
      </div>
    )
  }

  // グルーピングあり: アコーディオン形式のグループ＋カード
  return (
    <div className="space-y-1">
      <GroupSection
        nodes={groups}
        renderCard={renderCard}
        depth={0}
        openPaths={openPaths}
        toggle={toggle}
      />
    </div>
  )
}
