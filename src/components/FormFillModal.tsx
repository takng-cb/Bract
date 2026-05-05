'use client'

import { useState } from 'react'

type Props = {
  /** モーダル内に表示するフォーマット文字列（ヘッダー行） */
  csvFormat: string
  /** CSVヘッダー名 → フォームフィールドの name 属性 */
  fieldMap: Record<string, string>
  /** フィールド値の変換マップ（日本語ラベル → select/radio の value 値） */
  valueMap?: Record<string, Record<string, string>>
  /** フォーム要素への ref */
  formRef: React.RefObject<HTMLFormElement>
  /** Reactステートを持つフィールド（ラジオ以外）の更新コールバック */
  onFill?: (data: Record<string, string>) => void
  buttonLabel?: string
}

/** シンプルなCSV1行パーサー（クォート対応） */
function parseRow(line: string): string[] {
  const cols: string[] = []
  let cur = ''
  let inQ = false
  for (const ch of line) {
    if (ch === '"') {
      inQ = !inQ
    } else if (ch === ',' && !inQ) {
      cols.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  cols.push(cur.trim())
  return cols
}

/** フォームフィールドに値をセット（input / textarea / select / radio グループ対応） */
function applyField(form: HTMLFormElement, name: string, value: string) {
  const el = form.elements.namedItem(name)
  if (!el) return
  // ラジオグループは RadioNodeList の .value セッターで一括変更
  if (el instanceof RadioNodeList) {
    el.value = value
    return
  }
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  ) {
    el.value = value
  }
}

export default function FormFillModal({
  csvFormat,
  fieldMap,
  valueMap = {},
  formRef,
  onFill,
  buttonLabel = 'テキストから入力',
}: Props) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [msg, setMsg]   = useState<{ ok: boolean; text: string } | null>(null)

  function close() {
    setOpen(false)
    setText('')
    setMsg(null)
  }

  function fill() {
    const lines = text.trim().split(/\r?\n/).filter((l) => l.trim())
    if (!lines.length) return

    const formatHeaders = csvFormat.split(',').map((h) => h.trim())

    // ヘッダー行の有無を判定（先頭行がフォーマット定義のいずれかのヘッダーを含む場合）
    const firstCols = parseRow(lines[0])
    const hasHeader  = firstCols.some((c) => formatHeaders.includes(c))

    let data: Record<string, string>
    if (hasHeader && lines.length >= 2) {
      // ヘッダー行あり → 2行目をデータとして動的マッピング
      const dynHeaders = parseRow(lines[0])
      const vals = parseRow(lines[1])
      data = Object.fromEntries(dynHeaders.map((h, i) => [h, vals[i] ?? '']))
    } else {
      // ヘッダー行なし → 定義順でマッピング
      const vals = parseRow(lines[0])
      data = Object.fromEntries(formatHeaders.map((h, i) => [h, vals[i] ?? '']))
    }

    const form = formRef.current
    if (!form) {
      setMsg({ ok: false, text: 'フォームが見つかりません' })
      return
    }

    let n = 0
    for (const [csvHeader, fieldName] of Object.entries(fieldMap)) {
      const raw = data[csvHeader]
      if (!raw) continue
      // valueMap があれば変換、なければそのまま使用
      applyField(form, fieldName, valueMap[fieldName]?.[raw] ?? raw)
      n++
    }

    // Reactステート管理フィールドへのコールバック
    onFill?.(data)

    setMsg({ ok: true, text: `${n} 項目を入力しました` })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-2.5 py-1 text-xs text-zinc-500 border border-zinc-300 rounded-md hover:bg-zinc-50 transition-colors"
      >
        {buttonLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) close() }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl mx-4 flex flex-col max-h-[85vh]">

            {/* ヘッダー */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 shrink-0">
              <h2 className="text-base font-bold text-zinc-900">テキストから入力</h2>
              <button onClick={close} className="text-zinc-400 hover:text-zinc-600 text-xl leading-none">×</button>
            </div>

            {/* 本文 */}
            <div className="px-6 py-4 flex flex-col gap-3 overflow-y-auto">
              <div className="bg-zinc-50 border border-zinc-200 rounded-md p-3">
                <p className="text-xs font-semibold text-zinc-500 mb-1">フォーマット（ヘッダー行は省略可）</p>
                <code className="text-xs text-zinc-700 break-all">{csvFormat}</code>
                <p className="text-xs text-zinc-400 mt-1">データを1行貼り付けてください。入力後は通常通り「保存」で確定します。</p>
              </div>

              <textarea
                value={text}
                onChange={(e) => { setText(e.target.value); setMsg(null) }}
                placeholder={csvFormat + '\n値1,値2,...'}
                rows={5}
                className="w-full border border-zinc-300 rounded-md px-3 py-2 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {msg && (
                <p className={`text-sm px-3 py-2 rounded-md border ${
                  msg.ok
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-red-50 text-red-600 border-red-200'
                }`}>
                  {msg.text}
                </p>
              )}
            </div>

            {/* フッター */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-zinc-200 shrink-0">
              <button
                type="button"
                onClick={close}
                className="px-4 py-2 border border-zinc-300 text-sm rounded-md hover:bg-zinc-50 transition-colors"
              >
                閉じる
              </button>
              <button
                type="button"
                onClick={fill}
                disabled={!text.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                フォームに入力
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
