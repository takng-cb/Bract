'use client'

/**
 * ディールグラフの確認・編集画面（REQ-0086 / ADR-0031）。
 * quickAiExtractGraph が返した複数レコード（取引先/連絡先/商談＋明細/活動/ToDo）を
 * カードで表示し、編集・除外・既存照合（既存に紐付け/新規作成）・商品明細を確定して
 * quickAiCreateGraph で依存順に一括作成する。
 */
import { useState } from 'react'
import { Loader2, Plus, Trash2, Link2 } from 'lucide-react'
import QuickFieldInput from '@/components/QuickFieldInput'
import {
  quickAiCreateGraph,
  type GraphDraft, type GraphLineItem, type GraphCreateNode, type QuickAiField, type QuickAiDup,
} from '@/app/actions/quickAi'

type EditNode = {
  ref: string
  book: string
  bookLabel: string
  fields: QuickAiField[]
  accountRef?: string | null
  contactRef?: string | null
  relatedRefs: string[]
  lineItems: GraphLineItem[]
  existing: QuickAiDup[]
  existingRecordId: string | null  // null = 新規作成
  include: boolean
}

function nodeName(fields: QuickAiField[], fallback: string): string {
  for (const k of ['name', 'full_name', 'subject', 'title']) {
    const v = fields.find((f) => f.apiName === k)?.value?.trim()
    if (v) return v
  }
  return fallback
}

export default function QuickGraphConfirm({
  draft, onCreated, onBack,
}: {
  draft: GraphDraft
  onCreated: (href: string) => void
  onBack: () => void
}) {
  const [nodes, setNodes] = useState<EditNode[]>(() =>
    draft.nodes.map((n) => {
      const name = nodeName(n.fields, '')
      // 「既存があれば紐付け」既定（REQ-0085）。ただし誤紐付けを避けるため完全一致のみ既定 ON。
      const exact = (n.existing ?? []).find((e) => e.label.trim() === name)
      return {
        ref: n.ref, book: n.book, bookLabel: n.bookLabel,
        fields: n.fields.map((f) => ({ ...f })),
        accountRef: n.accountRef, contactRef: n.contactRef,
        relatedRefs: n.relatedRefs ?? [],
        lineItems: (n.lineItems ?? []).map((li) => ({ ...li })),
        existing: n.existing ?? [],
        existingRecordId: exact ? exact.id : null,
        include: true,
      }
    }),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nameByRef = new Map(nodes.map((n) => [n.ref, nodeName(n.fields, n.bookLabel)]))
  const labelByRef = new Map(nodes.map((n) => [n.ref, n.bookLabel]))

  const patch = (ref: string, fn: (n: EditNode) => EditNode) =>
    setNodes((prev) => prev.map((n) => (n.ref === ref ? fn(n) : n)))

  const setFieldValue = (ref: string, apiName: string, value: string) =>
    patch(ref, (n) => ({ ...n, fields: n.fields.map((f) => (f.apiName === apiName ? { ...f, value } : f)) }))

  const setLineItem = (ref: string, idx: number, key: keyof GraphLineItem, value: string) =>
    patch(ref, (n) => ({ ...n, lineItems: n.lineItems.map((li, i) => (i === idx ? { ...li, [key]: value } : li)) }))
  const addLineItem = (ref: string) =>
    patch(ref, (n) => ({ ...n, lineItems: [...n.lineItems, { name: '', quantity: '1', unit_price: '' }] }))
  const removeLineItem = (ref: string, idx: number) =>
    patch(ref, (n) => ({ ...n, lineItems: n.lineItems.filter((_, i) => i !== idx) }))

  const relationLines = (n: EditNode): string[] => {
    const out: string[] = []
    if (n.accountRef && nameByRef.has(n.accountRef)) out.push(`取引先「${nameByRef.get(n.accountRef)}」に紐付け`)
    if (n.contactRef && nameByRef.has(n.contactRef)) out.push(`連絡先「${nameByRef.get(n.contactRef)}」に紐付け`)
    for (const r of n.relatedRefs) if (nameByRef.has(r)) out.push(`${labelByRef.get(r)}「${nameByRef.get(r)}」に関連付け`)
    return out
  }

  const create = async () => {
    setBusy(true); setError(null)
    try {
      const payload: GraphCreateNode[] = nodes
        .filter((n) => n.include)
        .map((n) => {
          const values: Record<string, string> = {}
          for (const f of n.fields) values[f.apiName] = f.value
          return {
            ref: n.ref, book: n.book, values,
            accountRef: n.accountRef, contactRef: n.contactRef,
            relatedRefs: n.relatedRefs,
            lineItems: n.lineItems.filter((li) => li.name.trim()),
            existingRecordId: n.existingRecordId,
          }
        })
      if (payload.length === 0) { setError('作成するレコードを1つ以上選択してください'); setBusy(false); return }
      const r = await quickAiCreateGraph(payload)
      if (!r.ok) { setError(r.error); setBusy(false); return }
      onCreated(r.data.primaryHref)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)); setBusy(false)
    }
  }

  const includedCount = nodes.filter((n) => n.include).length

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600">
        文章から <b>{nodes.length}</b> 件のレコードを抽出しました。内容を確認・編集して一括作成します。
      </p>
      {draft.note && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">要確認: {draft.note}</div>
      )}

      <div className="space-y-2.5">
        {nodes.map((n) => {
          const linking = Boolean(n.existingRecordId)
          const rels = relationLines(n)
          return (
            <div key={n.ref} className={`rounded-xl border p-3 ${n.include ? 'border-zinc-200' : 'border-zinc-200 bg-zinc-50 opacity-60'}`}>
              <div className="flex items-center gap-2 mb-2">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={n.include} onChange={() => patch(n.ref, (x) => ({ ...x, include: !x.include }))} className="accent-blue-600" />
                  <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">{n.bookLabel}</span>
                </label>
                <span className="truncate text-sm font-medium text-zinc-800">{nodeName(n.fields, n.bookLabel)}</span>
              </div>

              {rels.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {rels.map((t, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700"><Link2 className="h-3 w-3" />{t}</span>
                  ))}
                </div>
              )}

              {n.include && (
                <>
                  {/* 既存照合（取引先/連絡先/商談） */}
                  {n.existing.length > 0 && (
                    <div className="mb-2">
                      <span className="block text-xs text-zinc-500 mb-1">既存レコード</span>
                      <select
                        value={n.existingRecordId ?? ''}
                        onChange={(e) => patch(n.ref, (x) => ({ ...x, existingRecordId: e.target.value || null }))}
                        className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
                      >
                        <option value="">＋ 新規作成する</option>
                        {n.existing.map((e) => <option key={e.id} value={e.id}>既存「{e.label}」に紐付け</option>)}
                      </select>
                    </div>
                  )}

                  {/* 新規作成のときだけフィールドを編集（既存紐付け時は不要） */}
                  {!linking && (
                    <div className="grid grid-cols-1 gap-2">
                      {n.fields.map((f) => (
                        <QuickFieldInput key={f.apiName} field={f} onChange={(v) => setFieldValue(n.ref, f.apiName, v)} />
                      ))}
                    </div>
                  )}

                  {/* 商談の商品明細 */}
                  {n.book === 'opportunities' && !linking && (
                    <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-zinc-600">商品明細</span>
                        <button type="button" onClick={() => addLineItem(n.ref)} className="inline-flex items-center gap-0.5 text-xs text-blue-600 hover:underline"><Plus className="h-3 w-3" />明細を追加</button>
                      </div>
                      {n.lineItems.length === 0 ? (
                        <p className="text-[11px] text-zinc-400">明細なし</p>
                      ) : (
                        <div className="space-y-1.5">
                          {n.lineItems.map((li, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                              <input value={li.name} onChange={(e) => setLineItem(n.ref, idx, 'name', e.target.value)} placeholder="商品名"
                                className="flex-1 min-w-0 rounded border border-zinc-300 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none" />
                              <input value={li.quantity} onChange={(e) => setLineItem(n.ref, idx, 'quantity', e.target.value)} placeholder="数量" inputMode="numeric"
                                className="w-14 rounded border border-zinc-300 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none" />
                              <input value={li.unit_price} onChange={(e) => setLineItem(n.ref, idx, 'unit_price', e.target.value)} placeholder="単価" inputMode="numeric"
                                className="w-24 rounded border border-zinc-300 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none" />
                              <button type="button" onClick={() => removeLineItem(n.ref, idx)} aria-label="削除" className="shrink-0 text-zinc-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {error && <p className="text-sm text-red-600 whitespace-pre-wrap">{error}</p>}

      <div className="flex items-center gap-3 pt-1">
        <button onClick={create} disabled={busy || includedCount === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {busy ? '作成中…' : `${includedCount}件をまとめて作成`}
        </button>
        <button onClick={onBack} disabled={busy} className="text-sm text-zinc-500 hover:text-zinc-800">入力に戻る</button>
      </div>
    </div>
  )
}
