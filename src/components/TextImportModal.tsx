'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  importUrl: string
  title: string
  /** CSV フォーマットの説明（モーダル内に表示） */
  csvFormat: string
  /** レコードページからの呼び出し時に自動設定されるフィールド（例: { account_id: 'xxx' }） */
  defaultContext?: Record<string, string>
  /** ボタンに表示するラベル */
  buttonLabel?: string
}

export default function TextImportModal({
  importUrl,
  title,
  csvFormat,
  defaultContext,
  buttonLabel = '📋 テキスト',
}: Props) {
  const [open, setOpen]       = useState(false)
  const [text, setText]       = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const router = useRouter()

  function handleClose() {
    setOpen(false)
    setMessage(null)
    setText('')
  }

  async function handleSubmit() {
    const trimmed = text.trim()
    if (!trimmed) return
    setLoading(true)
    setMessage(null)
    try {
      const fd = new FormData()
      fd.append('text', trimmed)
      for (const [k, v] of Object.entries(defaultContext ?? {})) {
        fd.append(k, v)
      }
      const res  = await fetch(importUrl, { method: 'POST', body: fd })
      const json = await res.json() as { imported?: number; updated?: number; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'エラーが発生しました')

      const parts: string[] = []
      if (json.imported) parts.push(`${json.imported} 件追加`)
      if (json.updated)  parts.push(`${json.updated} 件更新`)
      setMessage({ type: 'ok', text: parts.length > 0 ? parts.join('、') + 'しました' : '変更なし' })
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessage({ type: 'err', text: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* トリガーボタン */}
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 border border-zinc-300 text-zinc-600 text-xs font-medium rounded-md hover:bg-zinc-50 transition-colors"
      >
        {buttonLabel}
      </button>

      {/* モーダル */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 shrink-0">
              <h2 className="text-base font-bold text-zinc-900">{title}</h2>
              <button onClick={handleClose} className="text-zinc-400 hover:text-zinc-600 text-xl leading-none">×</button>
            </div>

            {/* 本文 */}
            <div className="px-6 py-4 flex flex-col gap-3 overflow-y-auto">
              {/* フォーマット説明 */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-md p-3">
                <p className="text-xs font-semibold text-zinc-500 mb-1">CSVフォーマット（1行目はヘッダー行）</p>
                <code className="text-xs text-zinc-700 break-all">{csvFormat}</code>
                <p className="text-xs text-zinc-400 mt-2">
                  ・<span className="font-medium">ID あり</span> → 既存レコードを更新<br />
                  ・<span className="font-medium">ID なし（空）</span> → 新規追加
                  {defaultContext && Object.keys(defaultContext).length > 0 && (
                    <><br />・関連先IDは現在のページから自動設定されます</>
                  )}
                </p>
              </div>

              {/* テキストエリア */}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={csvFormat + '\nデータ行1\nデータ行2'}
                rows={10}
                className="w-full border border-zinc-300 rounded-md px-3 py-2 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {/* 結果メッセージ */}
              {message && (
                <p className={`text-sm px-3 py-2 rounded-md ${
                  message.type === 'ok'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-600 border border-red-200'
                }`}>
                  {message.text}
                </p>
              )}
            </div>

            {/* フッター */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-zinc-200 shrink-0">
              <button
                onClick={handleClose}
                className="px-4 py-2 border border-zinc-300 text-sm rounded-md hover:bg-zinc-50 transition-colors"
              >
                閉じる
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !text.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'インポート中...' : 'インポート実行'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
