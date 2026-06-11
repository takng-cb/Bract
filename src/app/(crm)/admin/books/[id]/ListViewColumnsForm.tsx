'use client'

import { useState, useTransition } from 'react'
import type { ColAvail } from '@/lib/listViewDefs'
import { updateListViewColumns } from '@/app/actions/listViewSettings'

type Props = {
  objectType: string
  availableColumns: ColAvail[]
  currentKeys: string[]  // 現在保存されているキー（空 = 未設定=デフォルト）
}

export default function ListViewColumnsForm({ objectType, availableColumns, currentKeys }: Props) {
  const defaults = currentKeys.length > 0 ? currentKeys : availableColumns.filter((c) => c.defaultOn).map((c) => c.key)
  const [selected, setSelected] = useState<Set<string>>(new Set(defaults))
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    setSaved(false)
  }

  function handleSave() {
    // 表示順は availableColumns の並び順を維持
    const ordered = availableColumns.map((c) => c.key).filter((k) => selected.has(k))
    startTransition(async () => {
      await updateListViewColumns(objectType, ordered)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {availableColumns.map((col) => (
          <label key={col.key} className="flex items-center gap-2 cursor-pointer text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={selected.has(col.key)}
              onChange={() => toggle(col.key)}
              className="w-4 h-4 rounded border-zinc-300 text-blue-600 accent-blue-600"
            />
            {col.label}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || selected.size === 0}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? '保存中...' : '保存'}
        </button>
        {saved && <span className="text-sm text-green-600">✓ 保存しました</span>}
        {selected.size === 0 && <span className="text-xs text-amber-600">最低1つ選択してください</span>}
      </div>
    </div>
  )
}
