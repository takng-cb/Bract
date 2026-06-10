'use client'

/**
 * 関連レコードの閲覧⇄編集トグル（#112）。活動・ToDo・経費の詳細ページで使う。
 *
 * - 既定は閲覧（チップ表示）。右上の「編集」ボタン（editEvent）を受けると編集モードへ。
 * - 編集は既存の RelatedRecordsPicker を再利用し、保存で junction を同期する Server Action を呼ぶ。
 * - EditableInfoCard と同じ editEvent を共有するため、1つの「編集」ボタンで本文項目カードと
 *   この関連レコード編集が同時に開く（保存はそれぞれ独立）。
 */
import { useState, useEffect, useRef, type ReactNode } from 'react'
import { SquarePen, X } from 'lucide-react'
import SubmitButton from '@/components/SubmitButton'
import RelatedRecordsPicker, { type ObjectTypeOption, type RecordOption, type RelatedRecordSelection } from '@/components/RelatedRecordsPicker'

export default function InlineRelatedRecordsEditor({
  canEdit,
  editEvent,
  action,
  objectTypes,
  recordsByObject,
  defaultValue,
  view,
}: {
  canEdit: boolean
  editEvent: string
  action: (formData: FormData) => void | Promise<void>
  objectTypes: ObjectTypeOption[]
  recordsByObject: Record<string, RecordOption[]>
  defaultValue: RelatedRecordSelection[]
  /** 閲覧モードでのチップ表示 */
  view: ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!canEdit) return
    const onEdit = () => setEditing(true)
    window.addEventListener(editEvent, onEdit)
    return () => window.removeEventListener(editEvent, onEdit)
  }, [canEdit, editEvent])

  useEffect(() => {
    if (editing) rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [editing])

  return (
    <div ref={rootRef} className="mb-4 scroll-mt-20">
      {!editing ? (
        <div className="bg-zinc-50 border border-zinc-200 rounded-md px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">関連レコード</p>
            {canEdit && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800"
              >
                <SquarePen className="w-3.5 h-3.5" strokeWidth={2.25} />編集
              </button>
            )}
          </div>
          {view}
        </div>
      ) : (
        <form action={action} className="bg-white border border-brand-300 rounded-lg shadow-xs p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-zinc-700">関連レコード<span className="ml-2 text-xs font-normal text-brand-600">編集中</span></p>
            <button type="button" onClick={() => setEditing(false)} aria-label="閉じる" className="text-zinc-400 hover:text-zinc-700"><X className="w-4 h-4" /></button>
          </div>
          <RelatedRecordsPicker objectTypes={objectTypes} recordsByObject={recordsByObject} defaultValue={defaultValue} />
          <div className="mt-4 flex items-center gap-2">
            <SubmitButton>保存</SubmitButton>
            <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 border border-zinc-300 text-zinc-600 text-sm rounded-md hover:bg-zinc-50">取消</button>
          </div>
        </form>
      )}
    </div>
  )
}
