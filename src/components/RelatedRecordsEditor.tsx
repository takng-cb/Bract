'use client'

import { useState, useTransition } from 'react'
import { addRelationshipValue, removeRelationshipValue } from '@/app/actions/relationships'

// ────────────────────────────────────────────────────────────
// 削除ボタン
// ────────────────────────────────────────────────────────────

type RemoveProps = {
  mode: 'remove'
  relationshipId: string
  sourceRecordId: string
  targetRecordId: string
  pagePath: string
}

// ────────────────────────────────────────────────────────────
// 追加フォーム
// ────────────────────────────────────────────────────────────

type AddProps = {
  mode: 'add'
  relationshipId: string
  relatedObjectType: string
  currentRecordId: string
  isSource: boolean
  pagePath: string
  existingIds: string[]
}

type Props = RemoveProps | AddProps

export default function RelatedRecordsEditor(props: Props) {
  if (props.mode === 'remove') {
    return <RemoveButton {...props} />
  }
  return <AddForm {...props} />
}

// ────────────────────────────────────────────────────────────

function RemoveButton({
  relationshipId,
  sourceRecordId,
  targetRecordId,
  pagePath,
}: RemoveProps) {
  const [pending, startTransition] = useTransition()

  const handleClick = () => {
    if (!confirm('この関係を解除しますか？')) return
    startTransition(async () => {
      await removeRelationshipValue(relationshipId, sourceRecordId, targetRecordId, pagePath)
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="shrink-0 text-xs px-2 py-1 text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
    >
      {pending ? '...' : '解除'}
    </button>
  )
}

// ────────────────────────────────────────────────────────────

function AddForm({
  relationshipId,
  relatedObjectType,
  currentRecordId,
  isSource,
  pagePath,
  existingIds,
}: AddProps) {
  const [inputId, setInputId] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleAdd = () => {
    const trimmed = inputId.trim()
    if (!trimmed) return
    if (existingIds.includes(trimmed)) {
      setError('すでに関連付けられています')
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        const sourceId = isSource ? currentRecordId : trimmed
        const targetId = isSource ? trimmed : currentRecordId
        await addRelationshipValue(relationshipId, sourceId, targetId, pagePath)
        setInputId('')
      } catch (e) {
        setError('追加に失敗しました')
      }
    })
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          type="text"
          value={inputId}
          onChange={(e) => setInputId(e.target.value)}
          placeholder={`${relatedObjectType} の ID を入力...`}
          className="flex-1 border border-zinc-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={pending || !inputId.trim()}
          className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {pending ? '追加中...' : '追加'}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <p className="text-xs text-zinc-400">
        追加したいレコードの ID（UUID）を入力してください
      </p>
    </div>
  )
}
