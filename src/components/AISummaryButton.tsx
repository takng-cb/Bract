'use client'

/**
 * AI 要約ボタン — 商談・物件などの詳細ページに配置。
 *
 * クリックでモーダルを開き、期間を指定して AI 要約を実行する。
 * 結果は同モーダル内にストリーミングではなく一括表示する。
 *
 * 使用例:
 *   ```tsx
 *   <AISummaryButton
 *     label="🤖 AI で活動をまとめる"
 *     action={async (from, to) => summarizeOpportunity(opportunityId, from, to)}
 *   />
 *   ```
 */
import { useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { NavIcon } from '@/lib/navIcon'

type SummaryActionResult =
  | { ok: true; result: { summary: string; activityCount: number; taskCount: number; meta: { provider: string; model: string } } }
  | { ok: false; error: string }

type Props = {
  /** ボタンに表示するラベル */
  label: string
  /** 期間 (from / to) を受け取って Server Action を呼ぶ関数 */
  action: (from: string, to: string) => Promise<SummaryActionResult>
  /** デフォルト開始日 (YYYY-MM-DD)。省略時は 30 日前 */
  defaultFrom?: string
  /** デフォルト終了日 (YYYY-MM-DD)。省略時は今日 */
  defaultTo?: string
}

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function getDefaultRange(): { from: string; to: string } {
  const now = new Date()
  const ago = new Date()
  ago.setDate(now.getDate() - 30)
  return { from: ymd(ago), to: ymd(now) }
}

export default function AISummaryButton({ label, action, defaultFrom, defaultTo }: Props) {
  const def = getDefaultRange()
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(defaultFrom ?? def.from)
  const [to,   setTo]   = useState(defaultTo   ?? def.to)
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<SummaryActionResult | null>(null)

  function handleRun() {
    setResult(null)
    startTransition(async () => {
      const r = await action(from, to)
      setResult(r)
    })
  }

  function handleClose() {
    setOpen(false)
    setResult(null)
  }

  function setPreset(days: number) {
    const now = new Date()
    const past = new Date()
    past.setDate(now.getDate() - days)
    setFrom(ymd(past))
    setTo(ymd(now))
    setResult(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white text-sm font-medium rounded-md hover:bg-violet-700 transition-colors shadow-sm"
      >
        <NavIcon icon="🤖" className="w-4 h-4" /> {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-800 flex items-center gap-2"><NavIcon icon="🤖" className="w-4 h-4" />AI まとめ</h2>
              <button
                type="button"
                onClick={handleClose}
                className="text-zinc-400 hover:text-zinc-600"
                aria-label="閉じる"
              >
                <X className="w-4 h-4" strokeWidth={2.25} aria-hidden />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* 期間入力 */}
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">期間</p>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <label className="block">
                    <span className="text-[10px] text-zinc-500 mb-0.5 block">開始日</span>
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => { setFrom(e.target.value); setResult(null) }}
                      className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] text-zinc-500 mb-0.5 block">終了日</span>
                    <input
                      type="date"
                      value={to}
                      onChange={(e) => { setTo(e.target.value); setResult(null) }}
                      className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setPreset(7)} className="text-xs px-2 py-0.5 rounded border border-zinc-200 hover:bg-zinc-50">直近 7 日</button>
                  <button type="button" onClick={() => setPreset(30)} className="text-xs px-2 py-0.5 rounded border border-zinc-200 hover:bg-zinc-50">直近 30 日</button>
                  <button type="button" onClick={() => setPreset(90)} className="text-xs px-2 py-0.5 rounded border border-zinc-200 hover:bg-zinc-50">直近 90 日</button>
                </div>
              </div>

              {/* 実行ボタン */}
              <div>
                <button
                  type="button"
                  onClick={handleRun}
                  disabled={pending || !from || !to || from > to}
                  className="w-full px-4 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-md hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                >
                  {pending ? 'AI が要約中...' : 'AI で要約する'}
                </button>
                {from > to && (
                  <p className="text-xs text-rose-600 mt-1">開始日は終了日より前にしてください</p>
                )}
              </div>

              {/* 結果表示 */}
              {result && (
                <div className="border-t border-zinc-200 pt-4">
                  {result.ok ? (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">要約結果</p>
                        <p className="text-[10px] text-zinc-400">
                          活動 {result.result.activityCount} 件 / ToDo {result.result.taskCount} 件
                          {result.result.meta.provider && ` · ${result.result.meta.provider} (${result.result.meta.model})`}
                        </p>
                      </div>
                      <div className="bg-violet-50 border border-violet-200 rounded-md p-4">
                        <p className="text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed">
                          {result.result.summary}
                        </p>
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-2">
                        ※ AI が生成した要約です。事実と異なる場合があるため、重要事項は元データで確認してください。
                      </p>
                    </>
                  ) : (
                    <div className="bg-rose-50 border border-rose-200 rounded-md p-4">
                      <p className="text-xs font-semibold text-rose-700 mb-1">エラー</p>
                      <p className="text-sm text-rose-800 whitespace-pre-wrap">{result.error}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-zinc-200 flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm border border-zinc-300 rounded-md hover:bg-zinc-50"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
