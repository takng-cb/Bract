'use client'

/**
 * 閲覧と編集を同じレイアウトで切り替えるカード（#112 / 案C）。
 *
 * - 既定は閲覧モード（dl 表示）。「編集」で同じ並びのまま入力欄に切替。
 * - 保存は渡された Server Action（更新後に同URLへ redirect 想定）。取消で閲覧へ戻る。
 * - フィールドは config 駆動なので他オブジェクトにも横展開できる。
 * - `section` を付けると見出しでグルーピングできる（登記情報など項目が多い時用）。
 *   1枚のカード＝1つの form＝1つの保存ボタンに収まるため、複数カードを跨いだ
 *   同時編集での保存取りこぼしが起きない。
 */
import { useState, useEffect, useRef, type ReactNode } from 'react'
import { SquarePen, X } from 'lucide-react'
import SubmitButton from '@/components/SubmitButton'

export type EditField = {
  label: string
  /** 閲覧モードでの表示（リンク等の装飾込み） */
  view: ReactNode
  /** 編集対象なら form フィールド名。未指定＝閲覧専用（編集モードでも表示のみ） */
  name?: string
  kind?: 'text' | 'email' | 'tel' | 'date' | 'number' | 'textarea' | 'select'
  /** 入力初期値（生の値） */
  value?: string | null
  options?: { value: string; label: string }[]
  /** 全幅（メモ等） */
  fullWidth?: boolean
  /** 見出しグループ名（連続する同名フィールドが 1 セクションにまとまる） */
  section?: string
}

const INPUT = 'w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none'

function FieldInput({ f }: { f: EditField }) {
  if (!f.name) return <div className="text-sm text-zinc-700">{f.view}</div>
  const v = f.value ?? ''
  if (f.kind === 'textarea') return <textarea name={f.name} defaultValue={v} rows={3} className={INPUT} />
  if (f.kind === 'select')
    return (
      <select name={f.name} defaultValue={v} className={INPUT}>
        <option value="">—</option>
        {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  const type = f.kind === 'email' ? 'email' : f.kind === 'tel' ? 'tel' : f.kind === 'date' ? 'date' : f.kind === 'number' ? 'number' : 'text'
  return <input type={type} name={f.name} defaultValue={v} className={INPUT} />
}

/** フィールドを順序を保ったままセクション単位にまとめる（section 未指定は 1 グループ）。 */
function groupBySection(fields: EditField[]): { section?: string; fields: EditField[] }[] {
  const groups: { section?: string; fields: EditField[] }[] = []
  for (const f of fields) {
    const last = groups[groups.length - 1]
    if (last && last.section === f.section) last.fields.push(f)
    else groups.push({ section: f.section, fields: [f] })
  }
  return groups
}

export default function EditableInfoCard({
  title,
  fields,
  action,
  canEdit,
  hiddenFields,
  showEditButton = true,
  editEvent = 'bract:edit-record',
}: {
  title: string
  fields: EditField[]
  action: (formData: FormData) => void | Promise<void>
  canEdit: boolean
  /** 更新アクションに必要だがカードに出さない値（full_name など） */
  hiddenFields?: { name: string; value: string }[]
  /** カード内に編集ボタンを出すか（トップの編集ボタンに任せるなら false） */
  showEditButton?: boolean
  /** この名前のイベントを受けると編集モードに入る（右上の編集ボタン連動） */
  editEvent?: string
}) {
  const [editing, setEditing] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const groups = groupBySection(fields)

  // 右上の編集ボタン等からのイベントで編集モードに入る
  useEffect(() => {
    if (!canEdit) return
    const onEdit = () => setEditing(true)
    window.addEventListener(editEvent, onEdit)
    return () => window.removeEventListener(editEvent, onEdit)
  }, [canEdit, editEvent])

  // 編集モードに入ったらカードへスクロール
  useEffect(() => {
    if (editing) rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [editing])

  return (
    <div ref={rootRef} className="mb-6 scroll-mt-20">
      {!editing ? (
        <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-zinc-700">{title}</h2>
            {canEdit && showEditButton && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800"
              >
                <SquarePen className="w-3.5 h-3.5" strokeWidth={2.25} />編集
              </button>
            )}
          </div>
          {groups.map((g, gi) => {
            const grid = g.fields.filter((f) => !f.fullWidth)
            const full = g.fields.filter((f) => f.fullWidth)
            return (
              <div key={gi} className={gi > 0 ? 'mt-5 pt-4 border-t border-zinc-100' : ''}>
                {g.section && <p className="text-xs font-semibold text-zinc-500 mb-3">{g.section}</p>}
                {grid.length > 0 && (
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {grid.map((f, i) => (
                      <div key={i}>
                        <dt className="text-xs text-zinc-400 mb-1">{f.label}</dt>
                        <dd className="text-sm text-zinc-800">{f.view}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {full.map((f, i) => (
                  <div key={i} className="mt-4 pt-4 border-t border-zinc-100">
                    <dt className="text-xs text-zinc-400 mb-1">{f.label}</dt>
                    <dd className="text-sm text-zinc-800 whitespace-pre-wrap min-h-10">{f.view}</dd>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      ) : (
        <form action={action} className="bg-white border border-brand-300 rounded-lg shadow-xs p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-zinc-700">{title}<span className="ml-2 text-xs font-normal text-brand-600">編集中</span></h2>
            <button type="button" onClick={() => setEditing(false)} aria-label="閉じる" className="text-zinc-400 hover:text-zinc-700"><X className="w-4 h-4" /></button>
          </div>
          {hiddenFields?.map((h) => <input key={h.name} type="hidden" name={h.name} value={h.value} />)}
          {groups.map((g, gi) => {
            const grid = g.fields.filter((f) => !f.fullWidth)
            const full = g.fields.filter((f) => f.fullWidth)
            return (
              <div key={gi} className={gi > 0 ? 'mt-5 pt-4 border-t border-zinc-100' : ''}>
                {g.section && <p className="text-xs font-semibold text-zinc-500 mb-3">{g.section}</p>}
                {grid.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {grid.map((f, i) => (
                      <label key={i} className="block">
                        <span className="block text-xs text-zinc-400 mb-1">{f.label}</span>
                        <FieldInput f={f} />
                      </label>
                    ))}
                  </div>
                )}
                {full.map((f, i) => (
                  <label key={i} className="block mt-4 pt-4 border-t border-zinc-100">
                    <span className="block text-xs text-zinc-400 mb-1">{f.label}</span>
                    <FieldInput f={f} />
                  </label>
                ))}
              </div>
            )
          })}
          <div className="mt-5 flex items-center gap-2">
            <SubmitButton>保存</SubmitButton>
            <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 border border-zinc-300 text-zinc-600 text-sm rounded-md hover:bg-zinc-50">取消</button>
          </div>
        </form>
      )}
    </div>
  )
}
