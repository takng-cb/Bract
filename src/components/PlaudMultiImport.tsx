'use client'

/**
 * PLAUD 議事録を「複数案件」に AI 分割し、案件ごとの活動として一括作成する（REQ-0077 拡張）。
 *
 * フロー: .md/.txt アップロード → segmentPlaudByCase(AI 分割) → 案件カード一覧
 *   （件名/内容を編集・案件ごとに関連先を検索して確定・アクションを ToDo 化選択・不要案件は除外）
 *   → createActivitiesFromPlaudSegments で N 件の活動を作成（各々を関連先に紐付け）＋選択 ToDo 作成。
 * AI 必須・plaud_import 有効時のみ表示。
 */
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X, AudioLines, Upload, Search, Check, Plus } from 'lucide-react'
import { segmentPlaudByCase, createActivitiesFromPlaudSegments, createTasksFromPlaud, type PlaudSegment } from '@/app/actions/plaud'
import type { ObjectTypeOption } from '@/components/RelatedRecordsPicker'

const MAX_BYTES = 2 * 1024 * 1024

type Related = { object_api: string; record_id: string; label: string; typeLabel: string }
type Seg = {
  subject: string
  body: string
  related: Related | null
  relatedName?: string
  items: { task: string; person: string; status: string; selected: boolean }[]
  include: boolean
  // 関連先検索 UI 用
  query: string
  results: { object_api: string; record_id: string; label: string; sub?: string; typeLabel: string }[]
  searching: boolean
}

async function searchRecords(objectTypes: ObjectTypeOption[], q: string) {
  const lists = await Promise.all(
    objectTypes.map((t) =>
      fetch(`/api/search/records?objectType=${encodeURIComponent(t.api)}&q=${encodeURIComponent(q)}&limit=6`)
        .then((r) => (r.ok ? r.json() : []))
        .then((recs: { id: string; label: string; sub?: string }[]) =>
          recs.map((rec) => ({ object_api: t.api, record_id: rec.id, label: rec.label, sub: rec.sub, typeLabel: t.label })),
        ),
    ),
  )
  return lists.flat()
}

function segToState(s: PlaudSegment): Seg {
  const body = [s.summary, s.body].filter(Boolean).join('\n\n')
  return {
    subject: s.title, body,
    related: null, relatedName: s.relatedName,
    items: s.actionItems.map((a) => ({ task: a.task, person: a.person, status: a.status, selected: true })),
    include: true, query: s.relatedName ?? '', results: [], searching: false,
  }
}

export default function PlaudMultiImport({
  objectTypes,
  triggerClassName,
  triggerContent,
  onDone,
}: {
  objectTypes: ObjectTypeOption[]
  /** トリガーボタンの見た目を上書き（クイック操作内など） */
  triggerClassName?: string
  triggerContent?: React.ReactNode
  /** 作成完了時に呼ばれる（呼び出し側の閉じる処理など） */
  onDone?: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [fileName, setFileName] = useState('')
  const [segs, setSegs] = useState<Seg[] | null>(null)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function close() { setOpen(false); setMsg(null); setFileName(''); setSegs(null) }
  function patch(i: number, p: Partial<Seg>) { setSegs((arr) => (arr ? arr.map((s, idx) => (idx === i ? { ...s, ...p } : s)) : arr)) }

  async function onFile(file: File | null) {
    setMsg(null); setSegs(null)
    if (!file) return
    if (file.size > MAX_BYTES) { setMsg({ ok: false, text: 'ファイルが大きすぎます（2MBまで）' }); return }
    setFileName(file.name)
    const text = await file.text()
    startTransition(async () => {
      const res = await segmentPlaudByCase(text)
      if (!res.ok) { setMsg({ ok: false, text: res.error }); return }
      setSegs(res.segments.map(segToState))
    })
  }

  function onQuery(i: number, q: string) {
    patch(i, { query: q })
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (!q.trim()) { patch(i, { results: [] }); return }
      patch(i, { searching: true })
      const results = await searchRecords(objectTypes, q.trim())
      patch(i, { results, searching: false })
    }, 250)
  }

  function create() {
    if (!segs) return
    const chosen = segs.filter((s) => s.include && s.subject.trim())
    if (chosen.length === 0) { setMsg({ ok: false, text: '作成する案件がありません' }); return }
    startTransition(async () => {
      const res = await createActivitiesFromPlaudSegments(
        chosen.map((s) => ({
          subject: s.subject, body: s.body, type: 'meeting',
          related: s.related ? { object_api: s.related.object_api, record_id: s.related.record_id } : null,
        })),
      )
      if (!res.ok) { setMsg({ ok: false, text: res.error }); return }
      // 選択された ToDo をまとめて作成（既存仕様：説明に担当者を付記）
      const todos = chosen.flatMap((s) => s.items.filter((it) => it.selected && it.task.trim()).map((it) => ({ task: it.task, person: it.person })))
      if (todos.length > 0) await createTasksFromPlaud(todos)
      close()
      onDone?.()
      router.push(res.firstHref ?? '/activities')
      router.refresh()
    })
  }

  const includeCount = segs?.filter((s) => s.include && s.subject.trim()).length ?? 0

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClassName ?? 'px-3 py-2 text-sm text-violet-700 border border-violet-200 rounded-md hover:bg-violet-50 transition-colors inline-flex items-center gap-1.5'}
      >
        {triggerContent ?? <><AudioLines className="w-4 h-4" aria-hidden /> PLAUDから複数案件</>}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-12" onClick={(e) => { if (e.target === e.currentTarget) close() }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[88vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 shrink-0">
              <h2 className="text-base font-bold text-zinc-900 inline-flex items-center gap-2">
                <AudioLines className="w-4.5 h-4.5 text-violet-600" aria-hidden /> PLAUD から複数案件を取り込む
              </h2>
              <button onClick={close} aria-label="閉じる" className="text-zinc-400 hover:text-zinc-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="px-6 py-4 space-y-3 overflow-y-auto">
              {!segs && (
                <>
                  <p className="text-xs text-zinc-500">
                    1つの議事録に複数案件の話が含まれる場合に、AI が案件ごとに分割します。PLAUD でエクスポートした
                    <code className="text-zinc-700"> .md / .txt </code>を選択してください。
                  </p>
                  <button type="button" onClick={() => inputRef.current?.click()} disabled={pending}
                    className="w-full border-2 border-dashed border-zinc-300 rounded-lg px-4 py-6 text-sm text-zinc-500 hover:border-violet-400 hover:bg-violet-50/40 transition-colors inline-flex flex-col items-center gap-1.5 disabled:opacity-60">
                    {pending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                    {pending ? 'AI が案件を分割中…' : fileName ? <span className="text-zinc-800 font-medium">{fileName}</span> : 'クリックして .md / .txt を選択'}
                  </button>
                  <input ref={inputRef} type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
                  {msg && <p className={`text-sm ${msg.ok ? 'text-positive' : 'text-red-600'}`}>{msg.text}</p>}
                </>
              )}

              {segs && (
                <>
                  <p className="text-xs text-zinc-600">{segs.length} 件の案件を検出。各案件を確認・編集し、関連先を指定して作成します。</p>
                  {segs.map((s, i) => (
                    <div key={i} className={`rounded-lg border p-3 space-y-2 ${s.include ? 'border-zinc-200' : 'border-zinc-200 bg-zinc-50 opacity-60'}`}>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={s.include} onChange={() => patch(i, { include: !s.include })} className="accent-violet-600 shrink-0" title="この案件を作成する" />
                        <input type="text" value={s.subject} onChange={(e) => patch(i, { subject: e.target.value })} placeholder="件名" className="flex-1 text-sm font-semibold text-zinc-900 border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:border-violet-400" />
                      </div>
                      {s.include && (
                        <>
                          <textarea value={s.body} onChange={(e) => patch(i, { body: e.target.value })} rows={3} className="w-full text-sm border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:border-violet-400" />

                          {/* 関連先 */}
                          <div>
                            <p className="text-[11px] text-zinc-500 mb-1">関連先{s.relatedName && !s.related ? `（AI候補: ${s.relatedName}）` : ''}</p>
                            {s.related ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs px-2 py-0.5">
                                <span className="text-[10px] text-blue-500">{s.related.typeLabel}</span>{s.related.label}
                                <button type="button" onClick={() => patch(i, { related: null })} className="ml-0.5 hover:bg-blue-100 rounded-full"><X className="w-3 h-3" /></button>
                              </span>
                            ) : (
                              <div className="relative">
                                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input value={s.query} onChange={(e) => onQuery(i, e.target.value)} placeholder="名前で検索（取引先・商談・プロジェクト等）" className="w-full text-sm border border-zinc-300 rounded pl-7 pr-2 py-1 focus:outline-none focus:border-blue-400" />
                                {s.searching && <Loader2 className="w-3.5 h-3.5 text-zinc-400 animate-spin absolute right-2 top-1/2 -translate-y-1/2" />}
                                {s.results.length > 0 && (
                                  <div className="mt-1 border border-zinc-200 rounded-md divide-y divide-zinc-100 max-h-40 overflow-y-auto bg-white">
                                    {s.results.map((r) => (
                                      <button key={`${r.object_api}:${r.record_id}`} type="button"
                                        onClick={() => patch(i, { related: { object_api: r.object_api, record_id: r.record_id, label: r.label, typeLabel: r.typeLabel }, results: [] })}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-zinc-50">
                                        <span className="text-sm text-zinc-800 truncate">{r.label}</span>
                                        <span className="text-[10px] text-zinc-500 bg-zinc-100 rounded px-1.5 py-0.5 shrink-0">{r.typeLabel}</span>
                                        <Plus className="w-3.5 h-3.5 text-zinc-400 ml-auto shrink-0" />
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* アクション → ToDo */}
                          {s.items.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between">
                                <p className="text-[11px] text-zinc-500">アクション → ToDo 化</p>
                                <button type="button" onClick={() => { const all = s.items.every((x) => x.selected); patch(i, { items: s.items.map((x) => ({ ...x, selected: !all })) }) }} className="text-[11px] text-blue-600 hover:underline">
                                  {s.items.every((x) => x.selected) ? '全解除' : '全選択'}
                                </button>
                              </div>
                              <ul className="space-y-1 mt-1">
                                {s.items.map((it, j) => (
                                  <li key={j} className="flex items-start gap-2 text-sm">
                                    <input type="checkbox" checked={it.selected} onChange={() => patch(i, { items: s.items.map((x, k) => (k === j ? { ...x, selected: !x.selected } : x)) })} className="mt-1 accent-blue-600 shrink-0" />
                                    <input type="text" value={it.task} onChange={(e) => patch(i, { items: s.items.map((x, k) => (k === j ? { ...x, task: e.target.value } : x)) })} className="flex-1 bg-transparent focus:outline-none text-zinc-800" />
                                    {it.person && <span className="text-[11px] text-zinc-400 shrink-0">{it.person}</span>}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                  {msg && <p className={`text-sm ${msg.ok ? 'text-positive' : 'text-red-600'}`}>{msg.text}</p>}
                </>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-zinc-200 shrink-0">
              <span className="text-xs text-zinc-400">{segs ? `${includeCount} 件の活動を作成` : ''}</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={close} className="px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 rounded-md">キャンセル</button>
                {segs && (
                  <button type="button" onClick={create} disabled={pending || includeCount === 0}
                    className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-md hover:bg-violet-700 disabled:opacity-50 inline-flex items-center gap-1.5">
                    {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {pending ? '作成中…' : `${includeCount} 件の活動を作成`}
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
