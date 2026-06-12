'use client'

import { useState } from 'react'
import { saveActivityTypes } from '@/app/actions/activityTypes'
import type { ActivityType } from '@/lib/activityTypes'
import { showToast } from '@/components/Toast'

type Props = {
  initial: ActivityType[]
}

export default function ActivityTypesEditor({ initial }: Props) {
  const [items, setItems] = useState<ActivityType[]>(initial)
  const [pending, setPending] = useState(false)
  // 保存成功はグローバルトーストで通知（REQ-0057）。エラーのみ inline 表示。
  const [error, setError] = useState<string | null>(null)

  const update = (idx: number, patch: Partial<ActivityType>) => {
    setItems((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)))
  }

  const move = (idx: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev]
      const j = idx + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return next
    })
  }

  const remove = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const add = () => {
    setItems((prev) => [
      ...prev,
      { value: `type_${prev.length + 1}`, label: '新規', icon: '📋' },
    ])
  }

  const onSave = async () => {
    setPending(true); setError(null)
    try {
      await saveActivityTypes(items)
      showToast('活動種別を保存しました')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        サイドバー「活動履歴」ページで選べる種別と表示ラベルを編集できます。
        値（value）は内部識別用なので英数字＋アンダースコア推奨。表示は「ラベル」です。
        既存の活動レコードが該当 value を持っている場合、ラベル変更で表記も切り替わります。
      </p>

      <div className="border border-zinc-200 rounded-md divide-y divide-zinc-100 bg-white">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-zinc-50 text-xs font-semibold text-zinc-500">
          <div className="col-span-1">並び</div>
          <div className="col-span-1">アイコン</div>
          <div className="col-span-3">ラベル</div>
          <div className="col-span-3">値 (value)</div>
          <div className="col-span-3">バッジ色 (Tailwind)</div>
          <div className="col-span-1 text-right">削除</div>
        </div>
        {items.map((t, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 items-center">
            <div className="col-span-1 flex gap-1">
              <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} className="text-xs text-zinc-400 hover:text-zinc-700 disabled:opacity-30">↑</button>
              <button type="button" onClick={() => move(idx, +1)} disabled={idx === items.length - 1} className="text-xs text-zinc-400 hover:text-zinc-700 disabled:opacity-30">↓</button>
            </div>
            <input
              value={t.icon}
              onChange={(e) => update(idx, { icon: e.target.value })}
              className="col-span-1 border border-zinc-300 rounded px-2 py-1 text-sm text-center"
              placeholder="📞"
            />
            <input
              value={t.label}
              onChange={(e) => update(idx, { label: e.target.value })}
              className="col-span-3 border border-zinc-300 rounded px-2 py-1 text-sm"
              placeholder="例: 電話"
            />
            <input
              value={t.value}
              onChange={(e) => update(idx, { value: e.target.value })}
              className="col-span-3 border border-zinc-300 rounded px-2 py-1 text-sm font-mono"
              placeholder="例: call"
            />
            <input
              value={t.color ?? ''}
              onChange={(e) => update(idx, { color: e.target.value || undefined })}
              className="col-span-3 border border-zinc-300 rounded px-2 py-1 text-xs font-mono"
              placeholder="bg-blue-50 text-blue-700"
            />
            <button
              type="button"
              onClick={() => remove(idx)}
              className="col-span-1 text-xs text-red-500 hover:text-red-700 text-right"
            >削除</button>
          </div>
        ))}
        {items.length === 0 && (
          <p className="px-3 py-4 text-sm text-zinc-400 text-center">種別が1つもありません</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={add}
          className="text-sm text-blue-600 hover:text-blue-800"
        >＋ 種別を追加</button>
        <div className="flex items-center gap-3">
          {error && <span className="text-sm text-red-600">{error}</span>}
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
