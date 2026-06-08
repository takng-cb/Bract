'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, X } from 'lucide-react'
import { NavIcon } from '@/lib/navIcon'
import type { QuickActionGroup } from '@/lib/modules/quick'

/**
 * グローバル「＋クイック」ランチャー（REQ-0016）
 *
 * 画面右下のボタンから、有効モジュールの「業務フロー起点」アクションを呼び出す。
 * v1: create/log アクション（遷移）を表示。wizard(AIクイック登録) は次段で有効化。
 */
export default function QuickLauncher({ groups }: { groups: QuickActionGroup[] }) {
  const [open, setOpen] = useState(false)

  // Esc で閉じる
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // モバイル下部タブ中央の FAB から開く（BottomNav が dispatch）
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener('bract:quick-open', onOpen)
    return () => window.removeEventListener('bract:quick-open', onOpen)
  }, [])

  if (groups.length === 0) return null

  return (
    <>
      {/* フローティングボタン */}
      <button
        onClick={() => setOpen(true)}
        title="クイック操作"
        className="print:hidden hidden md:flex fixed bottom-6 right-6 z-40 items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-white shadow-lg hover:bg-blue-700 transition-colors"
      >
        <Plus className="w-5 h-5 shrink-0" strokeWidth={2.25} aria-hidden />
        <span className="text-sm font-medium hidden sm:inline">クイック</span>
      </button>

      {/* オーバーレイ + パネル */}
      {open && (
        <div
          className="print:hidden fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-20"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b bg-white px-5 py-3">
              <h2 className="text-base font-bold text-zinc-900">クイック操作</h2>
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-700" aria-label="閉じる"><X className="w-5 h-5" /></button>
            </div>

            <div className="px-3 py-2">
              {groups.map((g) => (
                <div key={g.moduleId} className="mb-2">
                  <div className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    {g.moduleName}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {g.actions.map((a, i) => {
                      const isWizard = a.kind === 'wizard'
                      const content = (
                        <>
                          <NavIcon icon={a.icon} className="w-5 h-5 shrink-0" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-zinc-800">{a.label}</span>
                            {a.description && <span className="block truncate text-xs text-zinc-400">{a.description}</span>}
                          </span>
                          {isWizard && (
                            <span className="ml-auto shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">AI</span>
                          )}
                        </>
                      )
                      const cls = 'flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-left hover:bg-zinc-50 transition-colors'
                      // href があれば遷移（wizard も /quick/staffing 等へ）。href が無い場合のみ無効表示。
                      return a.href ? (
                        <Link key={i} href={a.href} onClick={() => setOpen(false)} className={cls}>
                          {content}
                        </Link>
                      ) : (
                        <button key={i} type="button" title="準備中" className={`${cls} opacity-60 cursor-not-allowed`} disabled>
                          {content}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
