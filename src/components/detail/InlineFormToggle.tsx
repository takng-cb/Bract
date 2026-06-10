'use client'

/**
 * 詳細ページの「閲覧 ⇄ 編集フォーム」をその場で切り替える汎用トグル（#112）。
 * 右上の編集ボタン（InlineEditButton）が発火するイベントを購読して編集に入る。
 * カスタムオブジェクトなど、既存の編集フォームをそのままインライン表示したい場合に使う。
 */
import { useState, useEffect, useRef, type ReactNode } from 'react'

export default function InlineFormToggle({
  canEdit,
  view,
  form,
  editEvent = 'bract:edit-record',
}: {
  canEdit: boolean
  view: ReactNode
  form: ReactNode
  editEvent?: string
}) {
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!canEdit) return
    const onEdit = () => setEditing(true)
    window.addEventListener(editEvent, onEdit)
    return () => window.removeEventListener(editEvent, onEdit)
  }, [canEdit, editEvent])

  useEffect(() => {
    if (editing) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [editing])

  return (
    <div ref={ref} className="scroll-mt-20">
      {editing ? form : view}
    </div>
  )
}
