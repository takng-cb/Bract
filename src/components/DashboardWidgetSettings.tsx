'use client'

/**
 * ダッシュボードウィジェット表示設定 UI (ベース機能)
 *
 * 各ユーザーがダッシュボードに表示するウィジェットを ON/OFF できる。
 * /settings ページに埋め込む。
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { WidgetMeta, DashboardWidgetPrefs } from '@/lib/dashboard/widgets'
import { updateDashboardWidgetPrefs } from '@/app/actions/dashboardPrefs'

type Props = {
  /** 現在の業種で利用可能なウィジェット一覧 */
  availableWidgets: WidgetMeta[]
  /** 現在のユーザー設定 (null なら全 default) */
  currentPrefs:     DashboardWidgetPrefs | null
}

export default function DashboardWidgetSettings({ availableWidgets, currentPrefs }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 各 widget の現在の表示状態を state で管理
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    for (const w of availableWidgets) {
      init[w.id] = currentPrefs?.[w.id]?.enabled ?? w.defaultEnabled
    }
    return init
  })

  function toggle(id: string) {
    setEnabledMap((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function handleSave() {
    setMessage(null)
    const prefs: DashboardWidgetPrefs = {}
    for (const w of availableWidgets) {
      prefs[w.id] = { enabled: enabledMap[w.id], order: w.defaultOrder }
    }
    startTransition(async () => {
      const r = await updateDashboardWidgetPrefs(prefs)
      if (r.ok) {
        setMessage({ type: 'success', text: '保存しました' })
        router.refresh()
      } else {
        setMessage({ type: 'error', text: r.error })
      }
    })
  }

  function handleReset() {
    const reset: Record<string, boolean> = {}
    for (const w of availableWidgets) reset[w.id] = w.defaultEnabled
    setEnabledMap(reset)
  }

  const enabledCount = Object.values(enabledMap).filter(Boolean).length

  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-zinc-700">📊 ダッシュボード表示設定</h2>
          <p className="text-xs text-zinc-400 mt-1">
            ダッシュボードに表示するウィジェットを選択 ({enabledCount} / {availableWidgets.length} 表示中)
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="text-xs text-zinc-500 hover:text-zinc-700 hover:underline"
        >
          デフォルトに戻す
        </button>
      </div>

      {message && (
        <div className={`mb-4 rounded-md p-3 text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200'
                                     : 'bg-rose-50 text-rose-700 border border-rose-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="space-y-2">
        {availableWidgets.map((w) => (
          <label
            key={w.id}
            className="flex items-start gap-3 p-3 rounded-md hover:bg-zinc-50 cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              checked={enabledMap[w.id] ?? false}
              onChange={() => toggle(w.id)}
              className="w-5 h-5 mt-0.5 accent-blue-600 cursor-pointer shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-800">{w.title}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{w.description}</p>
            </div>
            {w.industries !== 'all' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 shrink-0">
                {w.industries.join(', ')}
              </span>
            )}
          </label>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-zinc-100 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="px-5 py-2 text-sm bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 shadow-sm"
        >
          {pending ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  )
}
