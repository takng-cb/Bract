'use client'

/**
 * 新規作成ページ用の入力カード（REQ-0051）。
 *
 * レコード詳細の EditableInfoCard（編集モード）と同じ見た目で入力欄を並べる。
 * - 詳細と同じカード・見出し・2カラムグリッド（dense は左カラム用の1カラム）
 * - <form> やボタンは持たない（ページ側の1つの form に内包して使う）
 * - 新規作成では「変更」概念が無いため dirty 強調はしない
 */
import type { ReactNode } from 'react'

export type CreateField = {
  label: string
  name: string
  kind?: 'text' | 'email' | 'tel' | 'date' | 'datetime' | 'number' | 'textarea' | 'select'
  defaultValue?: string | number | null
  options?: { value: string; label: string }[]
  placeholder?: string
  required?: boolean
  /** 全幅（メモ等） */
  fullWidth?: boolean
  /** select の先頭に置く空選択肢のラベル（既定 '—'。null で空選択肢なし） */
  emptyOption?: string | null
  min?: number
}

const INPUT = 'w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 transition-colors'

function FieldInput({ f }: { f: CreateField }) {
  const dv = f.defaultValue ?? ''
  if (f.kind === 'textarea') {
    return <textarea name={f.name} defaultValue={String(dv)} rows={3} required={f.required} placeholder={f.placeholder} className={`${INPUT} resize-y`} />
  }
  if (f.kind === 'select') {
    return (
      <select name={f.name} defaultValue={String(dv)} required={f.required} className={INPUT}>
        {f.emptyOption !== null && <option value="">{f.emptyOption ?? '—'}</option>}
        {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  }
  const type = f.kind === 'email' ? 'email' : f.kind === 'tel' ? 'tel' : f.kind === 'date' ? 'date' : f.kind === 'datetime' ? 'datetime-local' : f.kind === 'number' ? 'number' : 'text'
  return <input type={type} name={f.name} defaultValue={String(dv)} required={f.required} placeholder={f.placeholder} min={f.min} className={INPUT} />
}

export default function CreateInfoCard({
  title,
  fields,
  action,
  dense = false,
  children,
}: {
  title: string
  fields: CreateField[]
  /** 見出し右側のアクション（AI入力モーダル等） */
  action?: ReactNode
  /** 左カラム用コンパクト表示（詳細の dense カードと同じ作法） */
  dense?: boolean
  /** fields の後に差し込む追加コンテンツ（カスタム項目等） */
  children?: ReactNode
}) {
  if (dense) {
    return (
      <div className="bg-white border border-zinc-200 rounded-xl shadow-xs">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100">
          <h2 className="text-[13px] font-bold text-zinc-800">{title}</h2>
          {action}
        </div>
        <div className="px-4 py-3 space-y-2.5">
          {fields.map((f, i) => (
            <label key={i} className="block">
              <span className="block text-[12px] text-zinc-500 mb-1">
                {f.label}{f.required && <span className="text-red-500"> *</span>}
              </span>
              <FieldInput f={f} />
            </label>
          ))}
          {children}
        </div>
      </div>
    )
  }

  const grid = fields.filter((f) => !f.fullWidth)
  const full = fields.filter((f) => f.fullWidth)
  return (
    <div className="mb-6 bg-white border border-zinc-200 rounded-lg shadow-xs p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-zinc-700">{title}</h2>
        {action}
      </div>
      {grid.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {grid.map((f, i) => (
            <label key={i} className="block">
              <span className="block text-xs text-zinc-400 mb-1">
                {f.label}{f.required && <span className="text-red-500"> *</span>}
              </span>
              <FieldInput f={f} />
            </label>
          ))}
        </div>
      )}
      {full.map((f, i) => (
        <label key={i} className={`block ${grid.length > 0 || i > 0 ? 'mt-4 pt-4 border-t border-zinc-100' : ''}`}>
          <span className="block text-xs text-zinc-400 mb-1">
            {f.label}{f.required && <span className="text-red-500"> *</span>}
          </span>
          <FieldInput f={f} />
        </label>
      ))}
      {children}
    </div>
  )
}
