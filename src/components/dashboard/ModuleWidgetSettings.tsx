'use client'

/**
 * モジュールホーム（/modules/<id>）の表示設定（#105）
 *
 * 歯車ボタンで DashboardWidgetSettings（/settings と同じ UX）を開閉し、
 * scope='module:<id>' でユーザー単位に保存する。
 * ウィジェット定義が無いモジュール（expenses / workspace 等）では何も表示しない。
 */
import { useState } from 'react'
import { Settings } from 'lucide-react'
import type { WidgetMeta, DashboardWidgetPrefs } from '@/lib/dashboard/widgets'
import { moduleWidgetPrefsScope } from '@/lib/dashboard/scopedPrefs'
import DashboardWidgetSettings from '@/components/DashboardWidgetSettings'

type Props = {
  /** モジュール ID（保存 scope の導出に使用） */
  moduleId:         string
  /** このモジュールで利用可能なウィジェット一覧 */
  availableWidgets: WidgetMeta[]
  /** 現在のユーザー設定 (null なら全 default) */
  currentPrefs:     DashboardWidgetPrefs | null
}

export default function ModuleWidgetSettings({ moduleId, availableWidgets, currentPrefs }: Props) {
  const [open, setOpen] = useState(false)

  // 設定対象が無いモジュールでは歯車自体を出さない
  if (availableWidgets.length === 0) return null

  return (
    <div className="-mt-4 mb-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="表示設定"
          title="表示設定"
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
            open
              ? 'border-brand-300 bg-brand-50 text-brand-700'
              : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-700'
          }`}
        >
          <Settings className="h-3.5 w-3.5" />
          表示設定
        </button>
      </div>
      {open && (
        <div className="mt-3">
          <DashboardWidgetSettings
            availableWidgets={availableWidgets}
            currentPrefs={currentPrefs}
            scope={moduleWidgetPrefsScope(moduleId)}
            heading="表示設定"
          />
        </div>
      )}
    </div>
  )
}
