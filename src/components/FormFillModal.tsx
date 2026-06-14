'use client'

import { useState, useMemo } from 'react'
import { X } from 'lucide-react'
import type { FieldDef } from '@/lib/bookMetadata'
import { parseFieldOptions } from '@/lib/fieldUtils'

type Props = {
  /** モーダル内に表示するフォーマット文字列（ヘッダー行） */
  csvFormat: string
  /** CSVヘッダー名 → フォームフィールドの name 属性 */
  fieldMap: Record<string, string>
  /** フィールド値の変換マップ（日本語ラベル → select/radio の value 値） */
  valueMap?: Record<string, Record<string, string>>
  /** フォーム要素への ref */
  formRef: React.RefObject<HTMLFormElement | null>
  /** Reactステートを持つフィールド（ラジオ以外）の更新コールバック */
  onFill?: (data: Record<string, string>) => void
  /** カスタムフィールド定義（渡すと csvFormat・fieldMap に自動追加） */
  customFields?: FieldDef[]
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

/**
 * React の制御コンポーネント（EditableInfoCard 等）でも反映されるよう、
 * ネイティブ setter で値を入れてから input/change イベントを発火する。
 */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : el instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (setter) setter.call(el, value)
  else el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

/** フォームフィールドに値をセット（input / textarea / select / radio グループ対応） */
function applyField(form: HTMLFormElement, name: string, value: string) {
  const el = form.elements.namedItem(name)
  if (!el) return
  if (el instanceof RadioNodeList) {
    el.value = value
    return
  }
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  ) {
    setNativeValue(el, value)
  }
}

export default function FormFillModal({
  csvFormat,
  fieldMap,
  valueMap = {},
  formRef,
  onFill,
  customFields = [],
  buttonLabel = 'テキストから入力',
}: Props) {
  const [open, setOpen]           = useState(false)
  const [text, setText]           = useState('')
  const [msg, setMsg]             = useState<{ ok: boolean; text: string } | null>(null)
  const [copied, setCopied]       = useState(false)
  const [copiedPrompt, setCopiedPrompt] = useState(false)

  // カスタムフィールド（section・boolean 除く）を標準フィールドにマージ
  const mergedCsvFormat = useMemo(() => {
    const fillable = customFields.filter(
      (f) => f.is_visible && f.field_type !== 'section' && f.field_type !== 'boolean'
    )
    if (fillable.length === 0) return csvFormat
    return csvFormat + ',' + fillable.map((f) => f.label).join(',')
  }, [csvFormat, customFields])

  const mergedFieldMap = useMemo(() => {
    const fillable = customFields.filter(
      (f) => f.is_visible && f.field_type !== 'section' && f.field_type !== 'boolean'
    )
    if (fillable.length === 0) return fieldMap
    return {
      ...fieldMap,
      ...Object.fromEntries(fillable.map((f) => [f.label, `cf_${f.api_name}`])),
    }
  }, [fieldMap, customFields])

  // 選択リスト項目（valueMap + カスタムフィールドの select）
  const selectLines = useMemo(() => {
    const nameToLabel: Record<string, string> = {}
    for (const [label, name] of Object.entries(mergedFieldMap)) {
      nameToLabel[name] = label
    }
    const lines: { label: string; opts: string[] }[] = []
    for (const [fieldName, optionMap] of Object.entries(valueMap)) {
      const label = nameToLabel[fieldName]
      if (!label) continue
      lines.push({ label, opts: Object.keys(optionMap) })
    }
    for (const cf of customFields) {
      if (!cf.is_visible || cf.field_type !== 'select') continue
      const opts = parseFieldOptions(cf.options)
      if (opts.length > 0) lines.push({ label: cf.label, opts })
    }
    return lines
  }, [mergedFieldMap, valueMap, customFields])

  function copyFormat() {
    navigator.clipboard.writeText(mergedCsvFormat)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function copyPrompt() {
    // valueMap から「ヘッダーラベル → 選択肢一覧」を構築
    const nameToLabel: Record<string, string> = {}
    for (const [label, name] of Object.entries(mergedFieldMap)) {
      nameToLabel[name] = label
    }
    const selectLines: string[] = []
    for (const [fieldName, optionMap] of Object.entries(valueMap)) {
      const label = nameToLabel[fieldName]
      if (!label) continue
      selectLines.push(`・${label}：${Object.keys(optionMap).join(' / ')}`)
    }
    // カスタムフィールドの select オプション
    for (const cf of customFields) {
      if (!cf.is_visible || cf.field_type !== 'select') continue
      const opts = parseFieldOptions(cf.options)
      if (opts.length > 0) selectLines.push(`・${cf.label}：${opts.join(' / ')}`)
    }
    const selectSection = selectLines.length > 0
      ? `\n■ 選択リスト項目（以下の値のみ使用可能）\n${selectLines.join('\n')}\n`
      : ''
    const prompt = `添付のPDFを解析し、以下のCSVフォーマットに従って情報を抽出してください。

■ CSVフォーマット（1行目：ヘッダー行）
${mergedCsvFormat}
${selectSection}
■ 出力ルール
・1行目はヘッダー行をそのまま出力すること
・2行目にデータを出力すること（複数レコードがある場合は行を追加）
・値にカンマが含まれる場合はダブルクォート（"）で囲むこと
・不明・該当なしの項目は空欄にすること
・選択リスト項目は指定された値以外を使用しないこと
・日付はすべて「YYYY-MM-DD」の形式で出力すること（例：2024-03-15）
・IDは空にしてください`
    navigator.clipboard.writeText(prompt)
    setCopiedPrompt(true)
    setTimeout(() => setCopiedPrompt(false), 2000)
  }

  function close() {
    setOpen(false)
    setText('')
    setMsg(null)
  }

  function fill() {
    const lines = text.trim().split(/\r?\n/).filter((l) => l.trim())

    // ── ヘッダー行＋データ行の2行が必須
    if (lines.length < 2) {
      setMsg({ ok: false, text: 'ヘッダー行とデータ行の2行を入力してください。' })
      return
    }

    const headers  = parseRow(lines[0])
    const dataCols = parseRow(lines[1])

    // ── カンマ区切りチェック（ヘッダーが1列だけの場合は区切り文字が違う可能性）
    if (headers.length === 1 && mergedCsvFormat.includes(',')) {
      setMsg({
        ok: false,
        text: '列が 1 つしか検出されませんでした。カンマ区切りで入力されているか確認してください。',
      })
      return
    }

    // ヘッダー名をキー、値を対応するデータとするマップを構築（省略列は単純に存在しない）
    const data: Record<string, string> = Object.fromEntries(
      headers.map((h, i) => [h, dataCols[i] ?? ''])
    )

    const form = formRef.current
    if (!form) {
      setMsg({ ok: false, text: 'フォームが見つかりません' })
      return
    }

    let n = 0
    for (const [csvHeader, fieldName] of Object.entries(mergedFieldMap)) {
      const raw = data[csvHeader]
      if (!raw) continue
      applyField(form, fieldName, valueMap[fieldName]?.[raw] ?? raw)
      n++
    }

    onFill?.(data)

    if (n === 0) {
      setMsg({ ok: false, text: '入力できる項目がありませんでした。ヘッダー名がフォーマットと一致しているか確認してください。' })
      return
    }

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
              <button onClick={close} aria-label="閉じる" className="text-zinc-400 hover:text-zinc-600"><X className="w-5 h-5" strokeWidth={2.25} aria-hidden /></button>
            </div>

            {/* 本文 */}
            <div className="px-6 py-4 flex flex-col gap-3 overflow-y-auto">
              <div className="bg-zinc-50 border border-zinc-200 rounded-md p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-zinc-500">フォーマット（1行目ヘッダー必須・省略列は無視）</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={copyFormat}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      {copied ? '✓ コピー済み' : 'ヘッダーコピー'}
                    </button>
                    <button
                      type="button"
                      onClick={copyPrompt}
                      className="text-xs font-medium text-violet-600 hover:text-violet-800 transition-colors"
                    >
                      {copiedPrompt ? '✓ コピー済み' : 'プロンプトコピー'}
                    </button>
                  </div>
                </div>
                <code className="text-xs text-zinc-700 break-all">{mergedCsvFormat}</code>
                {selectLines.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-zinc-200 space-y-0.5">
                    <p className="text-xs font-semibold text-zinc-500 mb-1">選択リスト項目</p>
                    {selectLines.map(({ label, opts }) => (
                      <p key={label} className="text-xs text-zinc-500 leading-relaxed">
                        <span className="font-medium text-zinc-600">{label}：</span>{opts.join(' / ')}
                      </p>
                    ))}
                  </div>
                )}
                <p className="text-xs text-zinc-400 mt-2">1行目ヘッダー＋2行目データの2行を貼り付けてください。省略した列は無視されます。入力後は「保存」で確定します。</p>
              </div>

              <textarea
                value={text}
                onChange={(e) => { setText(e.target.value); setMsg(null) }}
                placeholder={
                  mergedCsvFormat + '\n' +
                  mergedCsvFormat.split(',').map((h) => `(${h.trim()})`).join(',')
                }
                rows={5}
                className="w-full border border-zinc-300 rounded-md px-3 py-2 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {msg && (
                <p className={`text-sm px-3 py-2 rounded-md border whitespace-pre-wrap ${
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
