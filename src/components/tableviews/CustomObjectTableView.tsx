'use client'

import Link from 'next/link'
import GroupedTable, { type ColDef } from '@/components/GroupedTable'
import type { FieldDef } from '@/components/FilterBuilder'
import { evalFormula } from '@/lib/formulaEval'
import { NavIcon } from '@/lib/navIcon'

// フィールド定義（サーバーから渡す最小限の情報）
export type SerializedFieldDef = {
  api_name:    string
  label:       string
  field_type:  string
  options:     string[] | null  // select フィールドの選択肢
  formulaExpr: string | null    // formula フィールドの数式
}

type Props = {
  records: Record<string, unknown>[]
  fields: SerializedFieldDef[]
  objectApiName: string
  groupBy: string[]
  filterFields: FieldDef[]
  currentSortStr?: string
}

export default function CustomObjectTableView({
  records,
  fields,
  objectApiName,
  groupBy,
  filterFields,
  currentSortStr,
}: Props) {
  // フィールド定義から ColDef[] を動的生成
  const columns: ColDef[] = [
    // 件名（常に先頭に詳細リンク付きで表示）
    {
      key: 'name',
      label: '件名',
      render: (r) => {
        const name = String(r.name ?? r.title ?? r.id ?? '—')
        return (
          <Link
            href={`/books/${objectApiName}/${r.id}`}
            className="font-medium text-zinc-900 hover:text-blue-600"
          >
            {name}
          </Link>
        )
      },
    },
    // name / title 以外のデータフィールド（数式フィールドも含む）
    ...fields
      .filter((f) =>
        f.field_type !== 'section' &&
        f.field_type !== 'textarea' &&
        f.api_name !== 'name' &&
        f.api_name !== 'title',
      )
      .slice(0, 5)
      .map((f): ColDef => ({
        key: f.api_name,
        label: f.label,
        align: f.field_type === 'number' || f.field_type === 'formula' ? 'right' : 'left',
        render: (r) => renderCell(f, r, objectApiName),
      })),
  ]

  return (
    <GroupedTable
      records={records}
      columns={columns}
      groupBy={groupBy}
      fields={filterFields}
      currentSortStr={currentSortStr}
    />
  )
}

/** セル値を JSX/文字列でレンダリング */
function renderCell(
  field: SerializedFieldDef,
  rec: Record<string, unknown>,
  _objectApiName: string,
): React.ReactNode {
  // account_id / *_account_id → 取引先リンク
  if (field.api_name === 'account_id' || field.api_name.endsWith('_account_id')) {
    const id   = String(rec[field.api_name] ?? '').trim()
    const name = String(rec[`__name__${field.api_name}`] ?? '').trim()
    if (!id) return '—'
    return name
      ? <Link href={`/accounts/${id}`} className="text-blue-600 hover:underline">{name}</Link>
      : id
  }

  // contact_id / *_contact_id → 担当者リンク
  if (field.api_name === 'contact_id' || field.api_name.endsWith('_contact_id')) {
    const id   = String(rec[field.api_name] ?? '').trim()
    const name = String(rec[`__name__${field.api_name}`] ?? '').trim()
    if (!id) return '—'
    return name
      ? <Link href={`/contacts/${id}`} className="text-blue-600 hover:underline">{name}</Link>
      : id
  }

  // formula フィールド → 数式を評価
  if (field.field_type === 'formula') {
    const expr = field.formulaExpr ?? ''
    const computed = evalFormula(expr, rec as Record<string, unknown>)
    if (computed === '') return '—'
    const num = Number(computed)
    return isNaN(num)
      ? computed
      : <span className="font-medium text-zinc-700">{num.toLocaleString('ja-JP')}</span>
  }

  const val = rec[field.api_name]
  if (val == null || val === '') return '—'

  switch (field.field_type) {
    case 'boolean':
      return val ? <NavIcon icon="✅" className="w-4 h-4 text-green-600" /> : '—'
    case 'number':
      return Number(val).toLocaleString('ja-JP')
    case 'date':
      return new Date(String(val)).toLocaleDateString('ja-JP')
    case 'select':
      return String(val)
    default:
      return <span className="truncate">{String(val)}</span>
  }
}
