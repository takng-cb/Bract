/**
 * MobileGroupedCards — サーバーコンポーネント
 *
 * ページ（サーバー）から renderCard 関数を受け取り、グループ構造を構築して
 * GroupAccordion（クライアント）に children として渡す。
 * サーバー→サーバー間の props 渡しなので関数を props に使える。
 * トグル状態は GroupAccordion が持つ（クライアント側のみ）。
 */

import React from 'react'
import type { FieldDef } from '@/components/FilterBuilder'
import GroupAccordion from '@/components/GroupAccordion'

// ────────────────────────────────────────────────────────────
// グループ構造 構築（サーバー側で実行）
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
// グループセクション（再帰・サーバー側）
// ────────────────────────────────────────────────────────────

function GroupSections({
  nodes,
  renderCard,
  depth,
}: {
  nodes: GroupNode[]
  renderCard: (record: Record<string, unknown>) => React.ReactNode
  depth: number
}) {
  return (
    <>
      {nodes.map((node) => (
        <GroupAccordion
          key={node.pathKey}
          label={node.label}
          count={node.records.length}
          depth={depth}
        >
          {node.children.length > 0 ? (
            <GroupSections
              nodes={node.children}
              renderCard={renderCard}
              depth={depth + 1}
            />
          ) : (
            node.records.map((r, i) => (
              <React.Fragment key={String(r.id ?? i)}>
                {renderCard(r)}
              </React.Fragment>
            ))
          )}
        </GroupAccordion>
      ))}
    </>
  )
}

// ────────────────────────────────────────────────────────────
// MobileGroupedCards（公開 API）
// ────────────────────────────────────────────────────────────

type Props = {
  records: Record<string, unknown>[]
  groupBy: string[]
  fields: FieldDef[]
  /** サーバー側でカード JSX を返す関数（サーバー→サーバーで渡すので OK） */
  renderCard: (record: Record<string, unknown>) => React.ReactNode
}

export default function MobileGroupedCards({ records, groupBy, fields, renderCard }: Props) {
  // グルーピングなし → フラットなカードリスト
  if (groupBy.length === 0) {
    return (
      <div className="space-y-2">
        {records.map((r, i) => (
          <React.Fragment key={String(r.id ?? i)}>
            {renderCard(r)}
          </React.Fragment>
        ))}
      </div>
    )
  }

  // グルーピングあり → アコーディオン
  const groups = buildGroups(records, groupBy, fields)
  return (
    <div className="space-y-1">
      <GroupSections nodes={groups} renderCard={renderCard} depth={0} />
    </div>
  )
}
