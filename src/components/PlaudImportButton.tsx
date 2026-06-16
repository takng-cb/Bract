'use client'

/**
 * PLAUD Note のエクスポート markdown/テキストをアップロードして活動記録を自動入力し、
 * アクションアイテムを確認の上 ToDo 化するボタン（#143 / REQ-0077）。
 * コンテナで `plaud_import` が有効な時だけ ActivityForm に表示。
 *
 * フロー: ファイル選択 → パース →（確認画面）件名/内容プレビュー＋アクション一覧の
 * チェックリスト（担当者/顧客が混在するので取捨選択）→ 取り込む で活動入力＋選択 ToDo 作成。
 */
import { useRef, useState, useTransition } from 'react'
import { Loader2, X, AudioLines, Upload } from 'lucide-react'
import { importActivityFromPlaud, createTasksFromPlaud } from '@/app/actions/plaud'
import { applyField } from '@/lib/formFill'
import type { PlaudActionItem } from '@/lib/plaud/markdown'

const MAX_BYTES = 2 * 1024 * 1024 // 2MB

type Parsed = {
  fields: { type?: string; subject: string; body: string }
  items: (PlaudActionItem & { selected: boolean })[]
}

export default function PlaudImportButton({
  formRef,
}: {
  formRef: React.RefObject<HTMLFormElement | null>
}) {
  const [open, setOpen] = useState(false)
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function close() {
    setOpen(false)
    setMsg(null)
    setFileName('')
    setParsed(null)
  }

  async function onFile(file: File | null) {
    setMsg(null)
    setParsed(null)
    if (!file) return
    if (file.size > MAX_BYTES) {
      setMsg({ ok: false, text: 'ファイルが大きすぎます（2MBまで）' })
      return
    }
    setFileName(file.name)
    const text = await file.text()
    startTransition(async () => {
      const res = await importActivityFromPlaud(text)
      if (!res.ok) {
        setMsg({ ok: false, text: res.error })
        return
      }
      setParsed({ fields: res.fields, items: res.actionItems.map((a) => ({ ...a, selected: true })) })
    })
  }

  function toggle(idx: number) {
    setParsed((p) => (p ? { ...p, items: p.items.map((it, i) => (i === idx ? { ...it, selected: !it.selected } : it)) } : p))
  }

  function setTask(idx: number, task: string) {
    setParsed((p) => (p ? { ...p, items: p.items.map((it, i) => (i === idx ? { ...it, task } : it)) } : p))
  }

  function confirm() {
    if (!parsed) return
    const form = formRef.current
    if (!form) {
      setMsg({ ok: false, text: 'フォームが見つかりません' })
      return
    }
    // 1. 活動フォームへ反映
    if (parsed.fields.type) applyField(form, 'type', parsed.fields.type)
    applyField(form, 'subject', parsed.fields.subject)
    applyField(form, 'body', parsed.fields.body)

    // 2. 選択された ToDo を作成
    const chosen = parsed.items.filter((it) => it.selected && it.task.trim())
    startTransition(async () => {
      let created = 0
      if (chosen.length > 0) {
        const r = await createTasksFromPlaud(chosen.map((it) => ({ task: it.task, person: it.person })))
        if (!r.ok) {
          setMsg({ ok: false, text: `活動は入力しましたが ToDo 作成に失敗: ${r.error}` })
          return
        }
        created = r.created
      }
      setMsg({ ok: true, text: `活動を入力しました${created ? `／ToDo ${created} 件作成` : ''}` })
    })
  }

  const selectedCount = parsed?.items.filter((it) => it.selected).length ?? 0

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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl mx-4 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 shrink-0">
              <h2 className="text-base font-bold text-zinc-900 inline-flex items-center gap-2">
                <AudioLines className="w-4.5 h-4.5 text-zinc-500" aria-hidden />
                PLAUD ファイルから取り込む
              </h2>
              <button onClick={close} aria-label="閉じる" className="text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" strokeWidth={2.25} aria-hidden />
              </button>
            </div>

            <div className="px-6 py-4 space-y-3 overflow-y-auto">
              {!parsed && (
                <>
                  <p className="text-xs text-zinc-500">
                    PLAUD アプリでノートを <b>markdown / テキスト</b>でエクスポートし、その
                    <code className="text-zinc-700"> .md / .txt </code>ファイルを選択してください。
                  </p>
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={pending}
                    className="w-full border-2 border-dashed border-zinc-300 rounded-lg px-4 py-6 text-sm text-zinc-500 hover:border-blue-400 hover:bg-blue-50/40 transition-colors inline-flex flex-col items-center gap-1.5 disabled:opacity-60"
                  >
                    {pending ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden /> : <Upload className="w-5 h-5" aria-hidden />}
                    {fileName ? <span className="text-zinc-800 font-medium">{fileName}</span> : 'クリックして .md / .txt を選択'}
                  </button>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".md,.markdown,.txt,text/markdown,text/plain"
                    className="hidden"
                    onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                  />
                </>
              )}

              {parsed && (
                <>
                  <div className="rounded-md bg-zinc-50 border border-zinc-200 px-3 py-2">
                    <p className="text-[11px] text-zinc-500">件名（活動に入力）</p>
                    <p className="text-sm font-medium text-zinc-900">{parsed.fields.subject}</p>
                  </div>

                  {parsed.items.length > 0 ? (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs text-zinc-600">
                          アクションアイテム → ToDo 化（<b>必要なものだけ</b>チェック。担当者/顧客が混在します）
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            const all = parsed.items.every((x) => x.selected)
                            setParsed((p) => (p ? { ...p, items: p.items.map((x) => ({ ...x, selected: !all })) } : p))
                          }}
                          className="text-xs text-blue-600 hover:underline shrink-0 ml-2"
                        >
                          {parsed.items.every((x) => x.selected) ? '全解除' : '全選択'}
                        </button>
                      </div>
                      <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                        {parsed.items.map((it, idx) => (
                          <li key={idx} className="flex items-start gap-2 rounded-md border border-zinc-200 px-2.5 py-1.5">
                            <input
                              type="checkbox"
                              checked={it.selected}
                              onChange={() => toggle(idx)}
                              className="mt-1 accent-blue-600 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <input
                                type="text"
                                value={it.task}
                                onChange={(e) => setTask(idx, e.target.value)}
                                className="w-full text-sm bg-transparent focus:outline-none text-zinc-900"
                              />
                              {(it.person || it.status) && (
                                <p className="text-[11px] text-zinc-400">
                                  {it.person ? `担当: ${it.person}` : ''}{it.person && it.status ? ' ・ ' : ''}{it.status}
                                </p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-400">アクションアイテムは見つかりませんでした（活動の入力のみ行います）。</p>
                  )}

                  {msg && <p className={`text-sm ${msg.ok ? 'text-positive' : 'text-red-600'}`}>{msg.text}</p>}
                </>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-zinc-200 shrink-0">
              <span className="text-xs text-zinc-400">
                {parsed && parsed.items.length > 0 ? `${selectedCount}/${parsed.items.length} 件を ToDo 化` : ''}
              </span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={close} className="px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 rounded-md transition-colors">
                  {msg?.ok ? '閉じる' : 'キャンセル'}
                </button>
                {parsed && !msg?.ok && (
                  <button
                    type="button"
                    onClick={confirm}
                    disabled={pending}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                  >
                    {pending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
                    {pending ? '処理中…' : `取り込む${selectedCount ? `（ToDo ${selectedCount}）` : ''}`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
