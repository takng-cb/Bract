'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type TemplateOption = {
  id: string
  name: string
  category: string | null
  description: string | null
  lineCount: number
  feeCount: number
}

type Props = {
  templates: TemplateOption[]
  applyAction: (templateId: string) => Promise<{ lines: number; fees: number }>
}

export default function ApplyTemplateButton({ templates, applyAction }: Props) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  if (templates.length === 0) {
    return (
      <Link
        href="/maintenance/templates/new"
        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-zinc-300 text-blue-600 rounded-md hover:bg-zinc-50"
      >
        📋 整備パッケージを作成
      </Link>
    )
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm"
      >
        📋 テンプレを適用
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-80 max-h-96 overflow-y-auto bg-white border border-zinc-200 rounded-md shadow-lg z-20">
            <div className="px-3 py-2 border-b border-zinc-100 flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-600">整備パッケージから選択</span>
              <Link href="/maintenance/templates" className="text-[10px] text-blue-600 hover:text-blue-800">管理 →</Link>
            </div>
            {message && (
              <div className="px-3 py-2 text-xs text-emerald-700 bg-emerald-50 border-b border-emerald-200">{message}</div>
            )}
            <ul className="divide-y divide-zinc-100">
              {templates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (!confirm(`「${t.name}」を現在の整備に追加しますか？\n（既存の行・諸費用は残り、テンプレ内容が追記されます）`)) return
                      startTransition(async () => {
                        try {
                          const r = await applyAction(t.id)
                          setMessage(`✓ ${t.name} を適用しました（行 ${r.lines} 件 / 諸費用 ${r.fees} 件）`)
                          router.refresh()
                          setTimeout(() => setOpen(false), 1500)
                        } catch (e) {
                          setMessage(`✗ ${(e as Error).message}`)
                        }
                      })
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-zinc-50/40 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-800">📋 {t.name}</span>
                      {t.category && <span className="text-[10px] px-1 py-0.5 rounded bg-zinc-50 text-zinc-700 border border-zinc-200">{t.category}</span>}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      行 {t.lineCount} 件 / 諸費用 {t.feeCount} 件
                      {t.description && <> · {t.description}</>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            {pending && <p className="px-3 py-2 text-xs text-zinc-500 border-t border-zinc-100">適用中…</p>}
          </div>
        </>
      )}
    </div>
  )
}
