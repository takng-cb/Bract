'use client'

/**
 * ダッシュボードウィジェット表示設定 UI (ベース機能)
 *
 * 各ユーザーがダッシュボードに表示するウィジェットを ON/OFF できる。
 * /settings ページに埋め込む。
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronUp, ChevronDown } from 'lucide-react'
import type { WidgetMeta, DashboardWidgetPrefs } from '@/lib/dashboard/widgets'
import { updateDashboardWidgetPrefs } from '@/app/actions/dashboardPrefs'
import { NavIcon } from '@/lib/navIcon'

type Props = {
  /** 現在の業種で利用可能なウィジェット一覧 */
  availableWidgets: WidgetMeta[]
  /** 現在のユーザー設定 (null なら全 default) */
  currentPrefs:     DashboardWidgetPrefs | null
  /** 保存先 scope（省略時 'global' = /dashboard。モジュールホームは 'module:<id>'。#105） */
  scope?:           string
  /** 見出し（省略時は /settings 埋め込み用の「ホーム表示設定」） */
  heading?:         string
}

export default function DashboardWidgetSettings({ availableWidgets, currentPrefs, scope, heading }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const widgetById = new Map(availableWidgets.map((w) => [w.id, w]))

  // 各 widget の表示状態
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    for (const w of availableWidgets) init[w.id] = currentPrefs?.[w.id]?.enabled ?? w.defaultEnabled
    return init
  })

  // 表示順（現在の prefs order → 無ければ defaultOrder）。並び替え可能。
  const [order, setOrder] = useState<string[]>(() =>
    [...availableWidgets]
      .sort((a, b) => (currentPrefs?.[a.id]?.order ?? a.defaultOrder) - (currentPrefs?.[b.id]?.order ?? b.defaultOrder))
      .map((w) => w.id),
  )

  function toggle(id: string) {
    setEnabledMap((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function move(idx: number, dir: -1 | 1) {
    setOrder((prev) => {
      const next = [...prev]
      const j = idx + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return next
    })
  }

  function handleSave() {
    setMessage(null)
    const prefs: DashboardWidgetPrefs = {}
    order.forEach((id, idx) => { prefs[id] = { enabled: enabledMap[id], order: idx } })
    startTransition(async () => {
      const r = await updateDashboardWidgetPrefs(prefs, scope)
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
    setOrder([...availableWidgets].sort((a, b) => a.defaultOrder - b.defaultOrder).map((w) => w.id))
  }

  const enabledCount = Object.values(enabledMap).filter(Boolean).length

  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-zinc-700"><NavIcon icon="📊" className="w-4 h-4" />{heading ?? 'ホーム表示設定'}</h2>
          <p className="text-xs text-zinc-400 mt-1">
            表示するウィジェットの選択と並び替え ({enabledCount} / {availableWidgets.length} 表示中)
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
        {order.map((id, idx) => {
          const w = widgetById.get(id)
          if (!w) return null
          return (
            <div key={id} className="flex items-start gap-3 p-3 rounded-md hover:bg-zinc-50 transition-colors">
              <input
                type="checkbox"
                checked={enabledMap[id] ?? false}
                onChange={() => toggle(id)}
                aria-label={`${w.title} を表示`}
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
              <div className="flex flex-col shrink-0">
                <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0}
                  aria-label={`${w.title} を上へ`} className="text-zinc-400 hover:text-zinc-700 disabled:opacity-30">
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => move(idx, 1)} disabled={idx === order.length - 1}
                  aria-label={`${w.title} を下へ`} className="text-zinc-400 hover:text-zinc-700 disabled:opacity-30">
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          )
        })}
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
