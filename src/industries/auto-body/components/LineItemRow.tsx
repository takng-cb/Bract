'use client'

import { useState, useActionState } from 'react'

type LineItem = {
  id:                string
  work_category:     string | null
  item_name:         string | null
  hours:             string | null
  labor_amount:      string | null
  parts_qty:         string | null
  parts_unit:        string | null
  parts_unit_price:  string | null
  cost_unit_price:   string | null
  note:              string | null
  state:             string | null
  is_excluded:       boolean
  work_status:       string
}

type Props = {
  index:        number
  item:         LineItem
  canEdit:      boolean
  updateAction: (formData: FormData) => Promise<void>
  deleteAction: () => Promise<void>
  toggleAction: (completed: boolean) => Promise<void>
}

const WORK_STATUSES = ['未完了', '完了']

const base = 'w-full border border-zinc-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function LineItemRow({
  index, item, canEdit, updateAction, deleteAction, toggleAction,
}: Props) {
  const [editing, setEditing] = useState(false)

  if (!editing) return (
    <ViewRow
      index={index}
      item={item}
      canEdit={canEdit}
      onEdit={() => setEditing(true)}
      deleteAction={deleteAction}
      toggleAction={toggleAction}
    />
  )

  return (
    <EditRow
      index={index}
      item={item}
      action={updateAction}
      onCancel={() => setEditing(false)}
    />
  )
}

function ViewRow({
  index, item, canEdit, onEdit, deleteAction, toggleAction,
}: {
  index: number
  item: LineItem
  canEdit: boolean
  onEdit: () => void
  deleteAction: () => Promise<void>
  toggleAction: (completed: boolean) => Promise<void>
}) {
  const labor = Number(item.labor_amount ?? 0)
  const qty   = Number(item.parts_qty ?? 0)
  const unit  = Number(item.parts_unit_price ?? 0)
  const partsSub = (Number.isFinite(qty) && Number.isFinite(unit)) ? qty * unit : 0
  const subtotal = (Number.isFinite(labor) ? labor : 0) + partsSub

  const done = item.work_status === '完了'

  return (
    <div className={`px-4 py-3 ${item.is_excluded ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-3">
        {/* 完了チェックボックス */}
        {canEdit ? (
          <form
            action={async () => { await toggleAction(!done) }}
            className="shrink-0 mt-0.5"
          >
            <button
              type="submit"
              className={`w-5 h-5 rounded border-2 flex items-center justify-center ${done ? 'bg-green-600 border-green-600 text-white' : 'border-zinc-300 hover:border-green-400'}`}
              title={done ? '未完了に戻す' : '完了にする'}
            >
              {done && <span className="text-xs leading-none">✓</span>}
            </button>
          </form>
        ) : (
          <span className={`mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded border-2 ${done ? 'bg-green-600 border-green-600 text-white' : 'border-zinc-200'}`}>
            {done && <span className="text-xs leading-none">✓</span>}
          </span>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-400 font-mono">#{index + 1}</span>
            {item.work_category && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">{item.work_category}</span>
            )}
            <span className={`text-sm font-medium ${done ? 'line-through text-zinc-400' : 'text-zinc-900'}`}>
              {item.item_name || '(無題)'}
            </span>
            {item.is_excluded && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600">除外</span>
            )}
            {item.state && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700">{item.state}</span>
            )}
          </div>

          <div className="mt-1 grid grid-cols-2 sm:grid-cols-5 gap-x-3 gap-y-1 text-xs text-zinc-600">
            <div>工数: <span className="font-mono">{item.hours ?? '—'}</span></div>
            <div>工賃: <span className="font-mono">¥{labor ? labor.toLocaleString() : '—'}</span></div>
            <div>部品: <span className="font-mono">{item.parts_qty ?? '—'} {item.parts_unit ?? ''}</span></div>
            <div>単価: <span className="font-mono">¥{unit ? unit.toLocaleString() : '—'}</span></div>
            <div>小計: <span className="font-mono font-semibold text-zinc-800">¥{subtotal.toLocaleString()}</span></div>
          </div>

          {item.note && (
            <p className="mt-1 text-xs text-zinc-500 whitespace-pre-wrap">📝 {item.note}</p>
          )}
        </div>

        {canEdit && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onEdit}
              className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
            >
              編集
            </button>
            <form
              action={async () => { await deleteAction() }}
              onSubmit={(e) => {
                if (!confirm(`「${item.item_name ?? '無題'}」を削除しますか？`)) e.preventDefault()
              }}
            >
              <button type="submit" className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50">
                削除
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

function EditRow({
  index, item, action, onCancel,
}: {
  index: number
  item: LineItem
  action: (formData: FormData) => Promise<void>
  onCancel: () => void
}) {
  const [error, dispatch, pending] = useActionState(
    async (_prev: string | null, fd: FormData) => {
      try { await action(fd); onCancel(); return null }
      catch (e) { return (e as Error).message }
    },
    null,
  )

  return (
    <form action={dispatch} className="px-4 py-4 bg-blue-50/40 space-y-3">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-400 font-mono">#{index + 1}</span>
        <span className="text-xs text-zinc-500">編集中</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
        <div className="sm:col-span-3">
          <label className="block text-xs text-zinc-500 mb-0.5">作業区分</label>
          <input name="work_category" defaultValue={item.work_category ?? ''} placeholder="例: 板金 / 塗装 / 一般" className={base} />
        </div>
        <div className="sm:col-span-9">
          <label className="block text-xs text-zinc-500 mb-0.5">作業項目名 <span className="text-red-500">*</span></label>
          <input name="item_name" defaultValue={item.item_name ?? ''} required className={base} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
        <div>
          <label className="block text-xs text-zinc-500 mb-0.5">工数</label>
          <input type="number" name="hours" step="0.1" defaultValue={item.hours ?? ''} className={base} />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-0.5">工賃（税別）</label>
          <input type="number" name="labor_amount" min="0" defaultValue={item.labor_amount ?? ''} className={base} />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-0.5">部品数</label>
          <input type="number" name="parts_qty" step="0.01" defaultValue={item.parts_qty ?? ''} className={base} />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-0.5">単位</label>
          <input name="parts_unit" defaultValue={item.parts_unit ?? ''} placeholder="個 / L" className={base} />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-0.5">部品単価</label>
          <input type="number" name="parts_unit_price" min="0" defaultValue={item.parts_unit_price ?? ''} className={base} />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-0.5">原単価</label>
          <input type="number" name="cost_unit_price" min="0" defaultValue={item.cost_unit_price ?? ''} className={base} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
        <div className="sm:col-span-3">
          <label className="block text-xs text-zinc-500 mb-0.5">状態</label>
          <input name="state" defaultValue={item.state ?? ''} placeholder="例: 部品取置中" className={base} />
        </div>
        <div className="sm:col-span-3">
          <label className="block text-xs text-zinc-500 mb-0.5">作業状況</label>
          <select name="work_status" defaultValue={item.work_status ?? '未完了'} className={`${base} bg-white`}>
            {WORK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="sm:col-span-6">
          <label className="block text-xs text-zinc-500 mb-0.5">備考</label>
          <input name="note" defaultValue={item.note ?? ''} className={base} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
          <input type="checkbox" name="is_excluded" defaultChecked={item.is_excluded} className="w-3.5 h-3.5 rounded" />
          除外（集計対象外）
        </label>
        <div className="flex gap-2">
          <button type="submit" disabled={pending}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50">
            {pending ? '保存中…' : '保存'}
          </button>
          <button type="button" onClick={onCancel}
            className="px-3 py-1.5 border border-zinc-300 text-zinc-600 text-xs font-medium rounded hover:bg-zinc-50">
            キャンセル
          </button>
        </div>
      </div>
    </form>
  )
}
