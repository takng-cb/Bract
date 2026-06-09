import { getAllObjectDefs, getCustomObjectsForNav } from '@/lib/objectMetadata'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { deleteObjectDef } from '@/app/actions/objectDefinitions'
import DeleteButton from '@/components/DeleteButton'
import NavOrderEditor from '@/components/NavOrderEditor'
import { getNavOrderSettings } from '@/app/actions/navSettings'
import { customObjectsToNavItems } from '@/lib/navItems'
import { activeIndustry } from '@/lib/industry'
import ActivityTypesEditor from '@/components/ActivityTypesEditor'
import { getActivityTypes } from '@/lib/activityTypes'
import { NavIcon } from '@/lib/navIcon'
import PageHeader from '@/components/ui/PageHeader'

export default async function AdminObjectsPage() {
  await requireAdmin()

  const [objects, { userOrder, systemOrder }, customObjects, activityTypes] = await Promise.all([
    getAllObjectDefs(),
    getNavOrderSettings(),
    getCustomObjectsForNav(),
    getActivityTypes(),
  ])

  // ナビ並び替えに渡すカスタムオブジェクトのアイテム（業種オーバーレイ対応 URL）。
  // layout.tsx と同じヘルパーを使い href ドリフトを防ぐ。
  const customNavItems = customObjectsToNavItems(
    customObjects.filter((o) => o.nav_enabled),
    activeIndustry,
  )

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8 space-y-8">
      <PageHeader
        icon="🗂️"
        title="オブジェクト管理"
        description="オブジェクト（テーブル）とフィールドの追加・編集、サイドバーの並び替えができます"
        className="mb-0"
        actions={
          <Link
            href="/admin/objects/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            ＋ 新規オブジェクト
          </Link>
        }
      />

      <div className="bg-white rounded-xl border border-zinc-200 shadow-xs divide-y divide-zinc-100">
        {objects.length === 0 && (
          <p className="px-5 py-8 text-sm text-zinc-400 text-center">オブジェクトがまだありません</p>
        )}
        {objects.map((obj) => (
          <div key={obj.id} className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50">
            <div className="flex items-center gap-3">
              <NavIcon icon={obj.icon} className="w-5 h-5 text-zinc-500" />
              <div>
                <p className="font-medium text-zinc-900 text-sm">{obj.label_plural}</p>
                <p className="text-xs text-zinc-400">
                  api_name: <code className="font-mono">{obj.api_name}</code>
                  {obj.is_builtin && (
                    <span className="ml-2 px-1.5 py-0.5 bg-zinc-100 text-zinc-500 rounded text-xs">組み込み</span>
                  )}
                  {!obj.nav_enabled && (
                    <span className="ml-2 px-1.5 py-0.5 bg-yellow-50 text-yellow-600 rounded text-xs">非表示</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/admin/objects/${obj.id}`}
                className="text-sm text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
              >
                フィールド管理 →
              </Link>
              {!obj.is_builtin && (
                <ObjectDeleteButton id={obj.id} label={obj.label_plural} />
              )}
            </div>
          </div>
        ))}
      </div>

      <NavOrderEditor userOrder={userOrder} systemOrder={systemOrder} customItems={customNavItems} />

      {/* 活動種別の管理（builtin object のピックリスト値） */}
      <section className="bg-white rounded-lg border border-zinc-200 p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-zinc-900 flex items-center gap-2"><NavIcon icon="📋" className="w-4 h-4" /> 活動種別</h2>
          <p className="text-xs text-zinc-500 mt-1">
            活動履歴フォームで選べる種別の一覧。既存の活動レコードに影響する場合があるので、
            value の変更は慎重に。
          </p>
        </div>
        <ActivityTypesEditor initial={activityTypes} />
      </section>
    </div>
  )
}

// deleteObjectDef を bind して Client Component に渡す
async function ObjectDeleteButton({ id, label }: { id: string; label: string }) {
  const action = deleteObjectDef.bind(null, id)
  return (
    <DeleteButton
      action={action}
      confirmMessage={`「${label}」を削除しますか？関連レコードもすべて削除されます。`}
      label="削除"
    />
  )
}
