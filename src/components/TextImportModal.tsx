'use client'

import { useRef, useState } from 'react'
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

type Tab = 'file' | 'text'

/** サーバーAPIのレスポンス型 */
type ImportResult = {
  imported?: number
  updated?:  number
  error?:    string   // 致命的エラー（400/500）
  errors?:   string[] // 行単位のスキップ理由
}

/** テキストの列数を簡易チェック（クォートを考慮した最大列数） */
function detectColumnCount(line: string): number {
  let count = 1
  let inQ = false
  for (const ch of line) {
    if (ch === '"') inQ = !inQ
    else if (ch === ',' && !inQ) count++
  }
  return count
}

export default function TextImportModal({
  importUrl,
  title,
  csvFormat,
  defaultContext,
  buttonLabel = 'インポート',
}: Props) {
  const [open, setOpen]       = useState(false)
  const [tab, setTab]         = useState<Tab>('file')
  const [text, setText]       = useState('')
  const [file, setFile]       = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [copied, setCopied]   = useState(false)

  function copyFormat() {
    navigator.clipboard.writeText(csvFormat)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  const fileRef = useRef<HTMLInputElement>(null)
  const router  = useRouter()

  function handleClose() {
    setOpen(false)
    setMessage(null)
    setText('')
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function switchTab(next: Tab) {
    setTab(next)
    setMessage(null)
  }

  /** テキスト入力の書式を事前チェック（送信前） */
  function validateText(raw: string): string | null {
    const lines = raw.trim().split(/\r?\n/).filter((l) => l.trim())
    if (lines.length === 0) return 'テキストが空です'

    const expectedCols = csvFormat.split(',').length

    // ヘッダー行の有無を判定（先頭行に csvFormat のヘッダーが含まれるか）
    const firstLineCols = detectColumnCount(lines[0])
    const firstLineHeaders = lines[0].split(',').map((s) => s.trim())
    const formatHeaders    = csvFormat.split(',').map((s) => s.trim())
    const matchCount = firstLineHeaders.filter((h) => formatHeaders.includes(h)).length
    const hasHeader  = matchCount >= Math.ceil(formatHeaders.length / 2)

    const dataLine = hasHeader && lines.length >= 2 ? lines[1] : lines[0]
    const actualCols = detectColumnCount(dataLine)

    if (actualCols === 1 && expectedCols > 1) {
      return `列が 1 つしか検出されませんでした（期待: ${expectedCols} 列）。カンマ区切りで入力されているか確認してください。`
    }
    if (actualCols < Math.ceil(expectedCols / 2)) {
      return `列数が少なすぎます（期待: ${expectedCols} 列、検出: ${actualCols} 列）。フォーマットを確認してください。`
    }
    return null
  }

  async function handleSubmit() {
    // テキストタブの書式事前チェック
    if (tab === 'text') {
      const err = validateText(text)
      if (err) { setMessage({ type: 'err', text: err }); return }
    }

    setLoading(true)
    setMessage(null)
    try {
      const fd = new FormData()
      if (tab === 'file') {
        if (!file) return
        fd.append('file', file)
      } else {
        fd.append('text', text.trim())
      }
      for (const [k, v] of Object.entries(defaultContext ?? {})) {
        fd.append(k, v)
      }
      const res  = await fetch(importUrl, { method: 'POST', body: fd })
      const json = await res.json() as ImportResult
      if (!res.ok) throw new Error(json.error ?? 'エラーが発生しました')

      // ── 結果サマリーを構築
      const parts: string[] = []
      if (json.imported) parts.push(`${json.imported} 件追加`)
      if (json.updated)  parts.push(`${json.updated} 件更新`)
      const summary = parts.length > 0 ? parts.join('、') + 'しました' : '変更なし'

      if (json.errors && json.errors.length > 0) {
        // 部分成功＋スキップあり
        const shown   = json.errors.slice(0, 5)
        const andMore = json.errors.length > 5 ? `\n他 ${json.errors.length - 5} 件` : ''
        setMessage({
          type: 'err',
          text: `${summary}\n\nスキップ・エラー (${json.errors.length} 件):\n${shown.join('\n')}${andMore}`,
        })
      } else {
        setMessage({ type: 'ok', text: summary })
      }
      router.refresh()
    } catch (err: unknown) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = tab === 'file' ? !!file : !!text.trim()

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

            {/* タブ切り替え */}
            <div className="flex border-b border-zinc-200 shrink-0">
              <button
                onClick={() => switchTab('file')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === 'file'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700'
                }`}
              >
                📁 ファイル
              </button>
              <button
                onClick={() => switchTab('text')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === 'text'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700'
                }`}
              >
                📋 テキスト
              </button>
            </div>

            {/* 本文 */}
            <div className="px-6 py-4 flex flex-col gap-3 overflow-y-auto">

              {/* フォーマット説明 */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-md p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-zinc-500">CSVフォーマット（1行目はヘッダー行・カンマ区切り）</p>
                  <button
                    type="button"
                    onClick={copyFormat}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    {copied ? '✓ コピー済み' : 'コピー'}
                  </button>
                </div>
                <code className="text-xs text-zinc-700 break-all">{csvFormat}</code>
                <p className="text-xs text-zinc-400 mt-2">
                  ・<span className="font-medium">ID あり</span> → 既存レコードを更新<br />
                  ・<span className="font-medium">ID なし（空）</span> → 新規追加
                  {defaultContext && Object.keys(defaultContext).length > 0 && (
                    <><br />・関連先IDは現在のページから自動設定されます</>
                  )}
                </p>
              </div>

              {/* ファイル選択 */}
              {tab === 'file' && (
                <div className="border border-zinc-200 rounded-md p-4">
                  <label className="block text-xs text-zinc-500 mb-2">CSVファイルを選択</label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="w-full text-sm text-zinc-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200"
                  />
                  {file && <p className="text-xs text-zinc-400 mt-2">選択中: {file.name}</p>}
                </div>
              )}

              {/* テキスト入力 */}
              {tab === 'text' && (
                <textarea
                  value={text}
                  onChange={(e) => { setText(e.target.value); setMessage(null) }}
                  placeholder={
                    csvFormat + '\n' +
                    csvFormat.split(',').map((h) => `(${h.trim()})`).join(',') + '\n...'
                  }
                  rows={10}
                  className="w-full border border-zinc-300 rounded-md px-3 py-2 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}

              {/* 結果メッセージ */}
              {message && (
                <p className={`text-sm px-3 py-2 rounded-md whitespace-pre-wrap ${
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
                disabled={loading || !canSubmit}
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
