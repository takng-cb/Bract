'use client'

/**
 * PLAUD Note 共有リンクを貼って活動記録を自動入力するボタン（#143 / REQ-0077）。
 * コンテナで `plaud_import` 機能が有効な時だけ ActivityForm に表示される。
 *
 * リンク → server action（取得＋AI抽出）→ 件名/種別/内容を同じフォームに流し込む。
 */
import { useState, useTransition } from 'react'
import { Loader2, X, AudioLines } from 'lucide-react'
import { importActivityFromPlaud } from '@/app/actions/plaud'
import { applyField } from '@/lib/formFill'

export default function PlaudImportButton({
  formRef,
}: {
  formRef: React.RefObject<HTMLFormElement | null>
}) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function close() {
    setOpen(false)
    setMsg(null)
  }

  function run() {
    setMsg(null)
    startTransition(async () => {
      const res = await importActivityFromPlaud(url.trim())
      if (!res.ok) {
        setMsg({ ok: false, text: res.error })
        return
      }
      const form = formRef.current
      if (!form) {
        setMsg({ ok: false, text: 'フォームが見つかりません' })
        return
      }
      if (res.fields.type) applyField(form, 'type', res.fields.type)
      applyField(form, 'subject', res.fields.subject)
      applyField(form, 'body', res.fields.body)
      setMsg({
        ok: true,
        text: `取り込みました${res.meta.aiUsed ? '（AI抽出）' : ''}${res.meta.hasSummary ? '＋PLAUD要約' : ''}`,
      })
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-2.5 py-1 text-xs text-zinc-500 border border-zinc-300 rounded-md hover:bg-zinc-50 transition-colors inline-flex items-center gap-1"
      >
        <AudioLines className="w-3.5 h-3.5" aria-hidden />
        PLAUD取込
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) close()
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
              <h2 className="text-base font-bold text-zinc-900 inline-flex items-center gap-2">
                <AudioLines className="w-4.5 h-4.5 text-zinc-500" aria-hidden />
                PLAUD リンクから取り込む
              </h2>
              <button onClick={close} aria-label="閉じる" className="text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" strokeWidth={2.25} aria-hidden />
              </button>
            </div>

            <div className="px-6 py-4 space-y-3">
              <p className="text-xs text-zinc-500">
                PLAUD Note の共有リンク（<code className="text-zinc-700">https://web.plaud.ai/s/...</code>）を貼ると、
                文字起こしから件名・種別・要点を自動入力し、PLAUD の AI 要約も本文に転記します。
              </p>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && url.trim() && !pending) run()
                }}
                placeholder="https://web.plaud.ai/s/pub_..."
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-blue-400 transition-colors"
                autoFocus
              />
              {msg && (
                <p className={`text-sm ${msg.ok ? 'text-positive' : 'text-red-600'}`}>{msg.text}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-zinc-200">
              <button
                type="button"
                onClick={close}
                className="px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 rounded-md transition-colors"
              >
                {msg?.ok ? '閉じる' : 'キャンセル'}
              </button>
              <button
                type="button"
                onClick={run}
                disabled={pending || !url.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
              >
                {pending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
                {pending ? '取り込み中…' : '取り込む'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
