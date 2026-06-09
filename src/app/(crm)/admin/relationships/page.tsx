import { db } from '@/lib/db'
import { relationship_definitions } from '@/lib/schema'
import { requireAdmin } from '@/lib/auth'
import { deleteRelationshipDefinition } from '@/app/actions/relationships'
import { OBJECT_TYPE_LABELS } from '@/lib/relationships'
import { asc } from 'drizzle-orm'
import Link from 'next/link'
import DeleteButton from '@/components/DeleteButton'
import { NavIcon } from '@/lib/navIcon'

export default async function AdminRelationshipsPage() {
  await requireAdmin()

  const defs = await db
    .select()
    .from(relationship_definitions)
    .orderBy(asc(relationship_definitions.created_at))

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900"><NavIcon icon="🔗" className="w-6 h-6" />関係性管理</h1>
          <p className="text-sm text-zinc-500 mt-1">
            オブジェクト間の多対多リレーションを定義します
          </p>
        </div>
        <Link
          href="/admin/relationships/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          ＋ 新規定義
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 divide-y divide-zinc-100">
        {defs.length === 0 && (
          <p className="px-5 py-8 text-sm text-zinc-400 text-center">
            関係性の定義がまだありません
          </p>
        )}
        {defs.map((def) => (
          <div key={def.id} className="flex items-center justify-between px-4 py-4 hover:bg-zinc-50">
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-800">
                <span className="px-2 py-1 bg-zinc-100 rounded-md text-xs">
                  {OBJECT_TYPE_LABELS[def.source_object_type] ?? def.source_object_type}
                </span>
                <span className="text-zinc-400">⟷</span>
                <span className="px-2 py-1 bg-zinc-100 rounded-md text-xs">
                  {OBJECT_TYPE_LABELS[def.target_object_type] ?? def.target_object_type}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900 truncate">{def.label}</p>
                {def.reverse_label && (
                  <p className="text-xs text-zinc-400">逆方向: {def.reverse_label}</p>
                )}
              </div>
              <span className="shrink-0 text-xs px-2 py-0.5 bg-violet-50 text-violet-700 rounded-full">
                {def.cardinality === 'many_to_many' ? '多対多' : '一対多'}
              </span>
            </div>
            <DeleteButton
              action={deleteRelationshipDefinition.bind(null, def.id)}
              confirmMessage="この関係性定義を削除すると、紐づくすべての関係データも削除されます。本当に削除しますか？"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
