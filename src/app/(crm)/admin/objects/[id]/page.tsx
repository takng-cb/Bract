import { getObjectDefById, getFieldDefs } from '@/lib/objectMetadata'
import { requireAdmin } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  createFieldDef,
  deleteFieldDef,
  updateObjectDef,
} from '@/app/actions/objectDefinitions'
import FieldEditRow from './FieldEditRow'
import NewFieldForm from './NewFieldForm'
import ObjectEditForm from './ObjectEditForm'
import ListViewColumnsForm from './ListViewColumnsForm'
import { LIST_VIEW_COLS } from '@/lib/listViewDefs'
import { getListViewColumns } from '@/lib/listViewSettings'

const FIELD_TYPE_LABELS: Record<string, string> = {
  text:     'テキスト',
  textarea: '長文テキスト',
  number:   '数値',
  date:     '日付',
  boolean:  'チェックボックス',
  select:   '選択肢',
  formula:  '数式',
  section:  'セクション',
}

export default async function AdminObjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params

  const obj = await getObjectDefById(id)
  if (!obj) notFound()

  const fields = await getFieldDefs(id)
  const availableCols = LIST_VIEW_COLS[obj.api_name] ?? null
  const currentKeys   = availableCols ? await getListViewColumns(obj.api_name) : []

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="mb-6">
        <Link href="/admin/objects" className="text-sm text-zinc-400 hover:text-zinc-600">← オブジェクト管理</Link>
        <h1 className="text-2xl font-bold text-zinc-900 mt-2">
          {obj.icon} {obj.label_plural}
        </h1>
        <p className="text-sm text-zinc-400 font-mono mt-0.5">api_name: {obj.api_name}</p>
      </div>

      {/* オブジェクト設定 */}
      <section className="bg-white rounded-lg border border-zinc-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-zinc-700 mb-4">オブジェクト設定</h2>
        <ObjectEditForm obj={obj} updateAction={updateObjectDef} />
      </section>

      {/* フィールド一覧 */}
      <section className="bg-white rounded-lg border border-zinc-200 mb-6">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-700">フィールド一覧</h2>
          <span className="text-xs text-zinc-400">{fields.length} 件</span>
        </div>
        {fields.length === 0 ? (
          <p className="px-5 py-8 text-sm text-zinc-400 text-center">フィールドがまだありません</p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {fields.map((field, idx) => (
              <FieldEditRow
                key={field.id}
                field={field}
                objectId={id}
                isFirst={idx === 0}
                isLast={idx === fields.length - 1}
                fieldTypLabels={FIELD_TYPE_LABELS}
                deleteAction={deleteFieldDef}
              />
            ))}
          </div>
        )}
      </section>

      {/* リストビュー表示項目（組み込みオブジェクトのみ） */}
      {availableCols && (
        <section className="bg-white rounded-lg border border-zinc-200 p-5 mb-6">
          <h2 className="text-sm font-semibold text-zinc-700 mb-1">リストビュー表示項目</h2>
          <p className="text-xs text-zinc-400 mb-4">リストビューに表示するカラムを選択します。変更はすべてのユーザーに反映されます。</p>
          <ListViewColumnsForm
            objectType={obj.api_name}
            availableColumns={availableCols}
            currentKeys={currentKeys}
          />
        </section>
      )}

      {/* 新規フィールド追加（組み込みオブジェクトにもカスタムフィールドは追加可能） */}
      <section className="bg-white rounded-lg border border-zinc-200 p-5">
        <h2 className="text-sm font-semibold text-zinc-700 mb-4">フィールドを追加</h2>
        {obj.is_builtin && (
          <p className="text-xs text-zinc-400 mb-4">
            ※ 組み込みオブジェクトです。カスタムフィールドの追加はできますが、このフィールドは汎用レコード（/objects/...）ではなく専用画面で使用します。
          </p>
        )}
        <NewFieldForm objectId={id} createAction={createFieldDef} />
      </section>
    </div>
  )
}
