'use client'

/**
 * 商談の「商品」セクション。商品系レコード（商品/部品）を明細として紐付ける。#5
 * - 既存明細をテーブル表示（数量・単価・小計・合計）。
 * - 商品を選んで（任意でフリー入力名）追加。各行は削除可。
 * - SearchableSelect で商品を選ぶと名前・単価を自動補完。
 */
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'
import {
  addOpportunityProduct,
  deleteOpportunityProduct,
} from '@/app/actions/opportunityProducts'

export type ProductLine = {
  id: string
  product_object_api: string
  product_record_id: string | null
  name: string
  quantity: string | null
  unit_price: string | null
  note: string | null
}
export type ProductOption = { value: string; label: string; price: number | null }

const yen = (n: number) => `¥${Math.round(n).toLocaleString('ja-JP')}`
const INPUT = 'w-full border border-zinc-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

function hrefForLine(l: ProductLine): string | null {
  if (!l.product_record_id) return null
  if (l.product_object_api === 'product') return `/products/${l.product_record_id}`
  if (l.product_object_api === 'part') return `/parts/${l.product_record_id}`
  return null
}

export default function OpportunityProductsEditor({
  opportunityId, lines, productOptions, canEdit,
}: {
  opportunityId: string
  lines: ProductLine[]
  productOptions: ProductOption[]
  canEdit: boolean
}) {
  const [pending, start] = useTransition()
  const [adding, setAdding] = useState(false)
  const [target, setTarget] = useState('')
  const [name, setName] = useState('')
  const [qty, setQty] = useState('1')
  const [price, setPrice] = useState('')
  const [error, setError] = useState<string | null>(null)

  const total = lines.reduce((s, l) => s + Number(l.quantity ?? 0) * Number(l.unit_price ?? 0), 0)

  function onPick(value: string) {
    setTarget(value)
    const opt = productOptions.find((o) => o.value === value)
    if (opt) {
      setName(opt.label)
      if (opt.price != null) setPrice(String(opt.price))
    }
  }

  function reset() {
    setTarget(''); setName(''); setQty('1'); setPrice(''); setError(null); setAdding(false)
  }

  function submitAdd() {
    setError(null)
    if (!name.trim()) { setError('商品名を入力するか商品を選択してください'); return }
    const fd = new FormData()
    fd.set('target', target)
    fd.set('name', name.trim())
    fd.set('quantity', qty)
    fd.set('unit_price', price)
    start(async () => {
      try { await addOpportunityProduct(opportunityId, fd); reset() }
      catch (e) { setError(e instanceof Error ? e.message : '追加に失敗しました') }
    })
  }

  function remove(id: string) {
    start(async () => { await deleteOpportunityProduct(id, opportunityId) })
  }

  return (
    <div>
      {lines.length === 0 ? (
        <p className="text-sm text-zinc-400 py-3 text-center">商品はまだ紐付けられていません</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-y border-zinc-200">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium text-zinc-700">商品</th>
                <th className="px-2 py-1.5 text-right font-medium text-zinc-700 w-16">数量</th>
                <th className="px-2 py-1.5 text-right font-medium text-zinc-700 w-24">単価</th>
                <th className="px-2 py-1.5 text-right font-medium text-zinc-700 w-24">小計</th>
                {canEdit && <th className="w-10"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {lines.map((l) => {
                const href = hrefForLine(l)
                const sub = Number(l.quantity ?? 0) * Number(l.unit_price ?? 0)
                return (
                  <tr key={l.id}>
                    <td className="px-2 py-1.5 text-zinc-800">
                      {href ? <Link href={href} className="text-brand-700 hover:underline">{l.name}</Link> : l.name}
                      {l.note && <p className="text-[11px] text-zinc-500 mt-0.5">{l.note}</p>}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-zinc-700">{l.quantity ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-zinc-700">{l.unit_price != null ? yen(Number(l.unit_price)) : '—'}</td>
                    <td className="px-2 py-1.5 text-right font-mono font-semibold text-zinc-900">{yen(sub)}</td>
                    {canEdit && (
                      <td className="px-2 py-1.5 text-center">
                        <button type="button" onClick={() => remove(l.id)} disabled={pending} aria-label="削除" className="text-zinc-400 hover:text-rose-600 disabled:opacity-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-zinc-50 border-t-2 border-zinc-300">
              <tr>
                <td colSpan={3} className="px-2 py-2 text-right text-xs font-semibold text-zinc-700">合計</td>
                <td className="px-2 py-2 text-right font-mono font-semibold">{yen(total)}</td>
                {canEdit && <td></td>}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {canEdit && (
        <div className="mt-3">
          {!adding ? (
            <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-sm text-brand-700 font-semibold hover:text-brand-800">
              <Plus className="w-4 h-4" strokeWidth={2.5} />商品を追加
            </button>
          ) : (
            <div className="border border-brand-300 rounded-lg p-3 bg-white space-y-2">
              {error && <p className="text-xs text-rose-600">{error}</p>}
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">商品を選択（商品マスタ／部品）</label>
                <SearchableSelect
                  name="__product_pick"
                  defaultValue={target || undefined}
                  options={productOptions.map((o) => ({ value: o.value, label: o.label }))}
                  placeholder="商品・部品を検索…"
                  onSelect={onPick}
                />
                <p className="text-[11px] text-zinc-400 mt-1">マスタに無い場合は下の名称欄に直接入力できます</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_80px_120px] gap-2">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="商品名" className={INPUT} />
                <input value={qty} onChange={(e) => setQty(e.target.value)} type="number" min="0" placeholder="数量" className={INPUT} />
                <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" placeholder="単価" className={INPUT} />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button type="button" onClick={submitAdd} disabled={pending} className="px-3.5 py-1.5 bg-brand-600 text-white text-sm font-semibold rounded-md hover:bg-brand-700 disabled:opacity-50">{pending ? '追加中…' : '追加'}</button>
                <button type="button" onClick={reset} className="px-3 py-1.5 border border-zinc-300 text-zinc-600 text-sm rounded-md hover:bg-zinc-50">取消</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
