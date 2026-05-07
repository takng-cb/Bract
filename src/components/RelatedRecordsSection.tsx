/**
 * RelatedRecordsSection — サーバーコンポーネント
 *
 * 詳細ページ上で「関連レコード」のセクションを表示する。
 * - 関係性定義を読み込み、紐づくレコードを解決して表示
 * - 追加・削除はインラインで行う（RelatedRecordsEditor に委譲）
 */

import { db } from '@/lib/db'
import { relationship_definitions, relationship_values } from '@/lib/schema'
import { eq, and, or, inArray } from 'drizzle-orm'
import { resolveRecords, OBJECT_TYPE_LABELS } from '@/lib/relationships'
import { canEdit } from '@/lib/auth'
import RelatedRecordsEditor from './RelatedRecordsEditor'

type Props = {
  /** このレコードのオブジェクト種別 */
  objectType: string
  /** このレコードの ID */
  recordId: string
  /** 詳細ページのパス（revalidatePath 用） */
  pagePath: string
}

export default async function RelatedRecordsSection({ objectType, recordId, pagePath }: Props) {
  const edit = await canEdit()

  // このオブジェクト種別に関係する定義をSQLで絞り込み
  const relevantDefs = await db.select().from(relationship_definitions).where(
    or(
      eq(relationship_definitions.source_object_type, objectType),
      eq(relationship_definitions.target_object_type, objectType),
    )
  )

  if (relevantDefs.length === 0) return null

  const defIds = relevantDefs.map((d) => d.id)

  // 全定義のうちこのレコードに紐づく値を一括取得（SQL で絞り込む）
  const allValues = await db.select().from(relationship_values).where(
    and(
      inArray(relationship_values.relationship_id, defIds),
      or(
        eq(relationship_values.source_record_id, recordId),
        eq(relationship_values.target_record_id, recordId),
      )
    )
  )

  // 各定義について紐づくレコードを解決
  const sections = await Promise.all(
    relevantDefs.map(async (def) => {
      const isSource = def.source_object_type === objectType
      const relatedObjectType = isSource ? def.target_object_type : def.source_object_type
      const label = isSource ? def.label : (def.reverse_label ?? def.label)

      const defRows = allValues.filter((r) => r.relationship_id === def.id)
      const relatedIds = isSource
        ? defRows.map((r) => r.target_record_id)
        : defRows.map((r) => r.source_record_id)

      const resolved = await resolveRecords(relatedObjectType, relatedIds)

      return {
        def,
        label,
        relatedObjectType,
        isSource,
        resolved,
      }
    })
  )

  return (
    <div className="space-y-6">
      {sections.map(({ def, label, relatedObjectType, isSource, resolved }) => (
        <div key={def.id} className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
          {/* ヘッダー */}
          <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 border-b border-zinc-200">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-800">🔗 {label}</span>
              <span className="text-xs text-zinc-400 bg-zinc-200 rounded-full px-2 py-0.5">
                {OBJECT_TYPE_LABELS[relatedObjectType] ?? relatedObjectType}
              </span>
              <span className="text-xs text-zinc-400">{resolved.length} 件</span>
            </div>
          </div>

          {/* レコード一覧 */}
          <div className="divide-y divide-zinc-100">
            {resolved.length === 0 && (
              <p className="px-4 py-3 text-sm text-zinc-400">関連レコードがありません</p>
            )}
            {resolved.map((rec) => (
              <div key={rec.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-50">
                <div className="min-w-0">
                  <a
                    href={rec.href}
                    className="text-sm font-medium text-blue-600 hover:underline truncate block"
                  >
                    {rec.label}
                  </a>
                  {rec.sub && <p className="text-xs text-zinc-400 mt-0.5">{rec.sub}</p>}
                </div>
                {edit && (
                  <RelatedRecordsEditor
                    mode="remove"
                    relationshipId={def.id}
                    sourceRecordId={isSource ? recordId : rec.id}
                    targetRecordId={isSource ? rec.id : recordId}
                    pagePath={pagePath}
                  />
                )}
              </div>
            ))}
          </div>

          {/* 追加 UI */}
          {edit && (
            <div className="px-4 py-3 border-t border-zinc-100 bg-zinc-50">
              <RelatedRecordsEditor
                mode="add"
                relationshipId={def.id}
                relatedObjectType={relatedObjectType}
                currentRecordId={recordId}
                isSource={isSource}
                pagePath={pagePath}
                existingIds={resolved.map((r) => r.id)}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
