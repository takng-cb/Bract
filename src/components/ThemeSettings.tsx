'use client'

/**
 * テーマ設定（カラープリセット＋ライト/ダーク）。REQ-0079。
 * 選択した瞬間に <html> へ反映＋cookie 書き込み（即時プレビュー）し、
 * サーバアクションで DB に永続化（クロスデバイス追従）。
 */
import { useState, useTransition } from 'react'
import { Check, Sun, Moon, Monitor } from 'lucide-react'
import {
  THEME_PRESETS, THEME_MODES, type ThemeMode,
  applyTheme, writeThemeCookie,
} from '@/lib/theme'
import { updateTheme } from '@/app/actions/settings'
import { showToast } from '@/components/Toast'

const MODE_ICON = { light: Sun, dark: Moon, system: Monitor } as const

type Props = { currentColor: string; currentMode: ThemeMode }

export default function ThemeSettings({ currentColor, currentMode }: Props) {
  const [color, setColor] = useState(currentColor)
  const [mode, setMode]   = useState<ThemeMode>(currentMode)
  const [, startTransition] = useTransition()

  function commit(nextColor: string, nextMode: ThemeMode) {
    // 即時プレビュー（描画 → cookie）
    applyTheme(nextColor, nextMode)
    writeThemeCookie(nextColor, nextMode)
    // 永続化（DB）。失敗してもプレビューは維持し、トーストで知らせる
    startTransition(async () => {
      const res = await updateTheme(nextColor, nextMode)
      if (res.ok) showToast('テーマを保存しました')
      else showToast(res.error ?? '保存に失敗しました', 'error')
    })
  }

  function pickColor(c: string) { setColor(c); commit(c, mode) }
  function pickMode(m: ThemeMode) { setMode(m); commit(color, m) }

  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6">
      <h2 className="text-sm font-bold text-zinc-700 mb-1">テーマ</h2>
      <p className="text-xs text-zinc-400 mb-5">アクセント色とライト／ダークを選べます（あなた個人の設定）</p>

      {/* カラープリセット */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-700 mb-2">アクセント色</label>
        <div className="flex flex-wrap gap-2.5">
          {THEME_PRESETS.map((p) => {
            const active = p.key === color
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => pickColor(p.key)}
                aria-pressed={active}
                title={p.label}
                className={`relative h-9 w-9 rounded-full transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-zinc-400 ${active ? 'ring-2 ring-offset-2 ring-zinc-700' : 'ring-1 ring-black/10'}`}
                style={{ backgroundColor: p.swatch }}
              >
                {active && <Check className="absolute inset-0 m-auto w-4 h-4 text-white" strokeWidth={3} aria-hidden />}
                <span className="sr-only">{p.label}</span>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-zinc-400 mt-2">{THEME_PRESETS.find((p) => p.key === color)?.label}</p>
      </div>

      {/* ライト / ダーク */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-2">表示モード</label>
        <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1">
          {THEME_MODES.map((m) => {
            const Icon = MODE_ICON[m.key]
            const active = m.key === mode
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => pickMode(m.key)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${active ? 'bg-white text-zinc-800 shadow-xs' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                <Icon className="w-4 h-4" aria-hidden />
                {m.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
