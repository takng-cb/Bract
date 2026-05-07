'use client'

import Link from 'next/link'
import GroupedTable, { type ColDef } from '@/components/GroupedTable'
import type { FieldDef } from '@/components/FilterBuilder'

// フィールド定義（サーバーから渡す最小限の情報）
export type SerializedFieldDef = {
  api_name: string
  label: string
  field_type: string
  options: string[] | null  // select フィールドの選択肢
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
            href={`/objects/${objectApiName}/${r.id}`}
            className="font-medium text-zinc-900 hover:text-blue-600"
          >
            {name}
          </Link>
        )
      },
    },
    // name / title 以外のデータフィールド
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
        align: f.field_type === 'number' ? 'right' : 'left',
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
  objectApiName: string,
): React.ReactNode {
  const val = rec[field.api_name]

  // account_id / *_account_id → 取引先リンク
  if (field.api_name === 'account_id' || field.api_name.endsWith('_account_id')) {
    const id   = String(val ?? '').trim()
    const name = String(rec[`__name__${field.api_name}`] ?? '').trim()
    if (!id) return '—'
    return name
      ? <Link href={`/accounts/${id}`} className="text-blue-600 hover:underline">{name}</Link>
      : id
  }

  // contact_id / *_contact_id → 担当者リンク
  if (field.api_name === 'contact_id' || field.api_name.endsWith('_contact_id')) {
    const id   = String(val ?? '').trim()
    const name = String(rec[`__name__${field.api_name}`] ?? '').trim()
    if (!id) return '—'
    return name
      ? <Link href={`/contacts/${id}`} className="text-blue-600 hover:underline">{name}</Link>
      : id
  }

  if (val == null || val === '') return '—'

  switch (field.field_type) {
    case 'boolean':
      return val ? '✅' : '—'
    case 'number':
      return Number(val).toLocaleString('ja-JP')
    case 'date':
      return new Date(String(val)).toLocaleDateString('ja-JP')
    case 'select': {
      // options が英語キーの場合もそのまま表示（管理画面で設定された値）
      return String(val)
    }
    default:
      return <span className="truncate">{String(val)}</span>
  }
}
