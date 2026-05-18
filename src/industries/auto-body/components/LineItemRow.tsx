'use client'

/**
 * 作業項目テーブルの 1 行（既存行）。
 *
 * 表組みのセルに直接 input を埋め込み、フォーカスを外す（blur）か
 * Enter 押下で 自動保存。Excel ライクな編集体験。
 *
 * - 完了チェック / 除外チェック は変更即保存
 * - 入力フィールド変更は blur で保存（変更があった場合のみ送信）
 * - 削除ボタンは確認ダイアログ付き
 */
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

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

const cellInput = 'w-full bg-transparent border border-transparent rounded px-2 py-1 text-sm focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200/50 focus:outline-none'
const cellInputNum = cellInput + ' text-right font-mono'

function yen(n: number | string | null | undefined): string {
  const v = Number(n ?? 0)
  if (!Number.isFinite(v)) return '—'
  return `¥${Math.round(v).toLocaleString()}`
}

export default function LineItemRow({
  index, item, canEdit, updateAction, deleteAction, toggleAction,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [snapshot, setSnapshot] = useState<string>(() => serializeRow(item))
  const router = useRouter()

  // input change → snapshot で dirty 判定
  function maybeSave() {
    if (!canEdit || !formRef.current) return
    const current = serializeRowFromForm(formRef.current)
    if (current === snapshot) return  // 変更なし
    const fd = new FormData(formRef.current)
    setSaving(true)
    startTransition(async () => {
      try {
        await updateAction(fd)
        setSnapshot(current)
        router.refresh()
      } finally {
        setSaving(false)
      }
    })
  }

  const labor = Number(item.labor_amount ?? 0)
  const qty   = Number(item.parts_qty ?? 0)
  const unit  = Number(item.parts_unit_price ?? 0)
  const sub = (Number.isFinite(labor) ? labor : 0) + (Number.isFinite(qty) && Number.isFinite(unit) ? qty * unit : 0)

  return (
    <form
      ref={formRef}
      onBlur={maybeSave}
      onKeyDown={(e) => { if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); maybeSave() } }}
      className={`grid grid-cols-[2rem_5rem_minmax(0,1fr)_4rem_6rem_4rem_4rem_6rem_6rem_5rem_6rem] items-center gap-1 px-2 py-1 border-b border-zinc-100 hover:bg-amber-50/20 ${item.is_excluded ? 'opacity-60 bg-zinc-50' : ''}`}
    >
      {/* # */}
      <div className="text-xs text-zinc-400 font-mono text-center">{index + 1}</div>

      {/* 区分 */}
      <input
        name="work_category"
        defaultValue={item.work_category ?? ''}
        placeholder="区分"
        disabled={!canEdit}
        className={cellInput}
      />

      {/* 作業項目名 */}
      <input
        name="item_name"
        defaultValue={item.item_name ?? ''}
        required
        placeholder="作業項目名"
        disabled={!canEdit}
        className={cellInput}
      />

      {/* 工数 */}
      <input
        type="number"
        name="hours"
        step="0.1"
        defaultValue={item.hours ?? ''}
        disabled={!canEdit}
        className={cellInputNum}
      />

      {/* 工賃 */}
      <input
        type="number"
        name="labor_amount"
        min="0"
        defaultValue={item.labor_amount ?? ''}
        disabled={!canEdit}
        className={cellInputNum}
      />

      {/* 部品数 */}
      <input
        type="number"
        name="parts_qty"
        step="0.01"
        defaultValue={item.parts_qty ?? ''}
        disabled={!canEdit}
        className={cellInputNum}
      />

      {/* 単位 */}
      <input
        name="parts_unit"
        defaultValue={item.parts_unit ?? ''}
        placeholder="単位"
        disabled={!canEdit}
        className={cellInput}
      />

      {/* 部品単価 */}
      <input
        type="number"
        name="parts_unit_price"
        min="0"
        defaultValue={item.parts_unit_price ?? ''}
        disabled={!canEdit}
        className={cellInputNum}
      />

      {/* 小計（自動計算・read-only） */}
      <div className="text-right font-mono text-sm font-semibold text-zinc-800 px-2">
        {yen(sub)}
      </div>

      {/* 状況 — checkbox 即保存 */}
      <div className="flex items-center justify-center gap-1">
        {canEdit ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              const newDone = item.work_status !== '完了'
              startTransition(async () => { await toggleAction(newDone); router.refresh() })
            }}
            className={`w-6 h-6 rounded border-2 flex items-center justify-center text-xs ${
              item.work_status === '完了'
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'border-zinc-300 hover:border-emerald-400'
            }`}
            title={item.work_status === '完了' ? '完了 → 未完了に戻す' : '完了にする'}
          >
            {item.work_status === '完了' ? '✓' : ''}
          </button>
        ) : (
          <span className={`w-6 h-6 inline-flex items-center justify-center rounded border-2 ${item.work_status === '完了' ? 'bg-emerald-600 border-emerald-600 text-white text-xs' : 'border-zinc-200'}`}>
            {item.work_status === '完了' ? '✓' : ''}
          </span>
        )}
      </div>

      {/* 操作 */}
      <div className="flex items-center justify-end gap-1 text-xs">
        {saving && <span className="text-amber-700 text-[10px]">保存中…</span>}
        {/* 除外チェック */}
        <label className="flex items-center gap-1 cursor-pointer" title="集計対象外にする">
          <input
            type="checkbox"
            name="is_excluded"
            defaultChecked={item.is_excluded}
            disabled={!canEdit}
            onChange={maybeSave}
            className="w-3 h-3"
          />
          <span className="text-[10px] text-zinc-500">除外</span>
        </label>
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              if (!confirm(`「${item.item_name ?? '無題'}」を削除しますか？`)) return
              startTransition(async () => { await deleteAction(); router.refresh() })
            }}
            className="text-rose-500 hover:text-rose-700 px-1 py-0.5 rounded hover:bg-rose-50"
            title="削除"
          >
            🗑
          </button>
        )}
      </div>

      {/* hidden: work_status を保持（toggleAction で別途更新するが、行 update でも送る） */}
      <input type="hidden" name="work_status" value={item.work_status} />
      {/* hidden: state / note も保持（テーブル外に出すと幅取りすぎるので隠す。簡易編集のため触らない値） */}
      <input type="hidden" name="state" defaultValue={item.state ?? ''} />
      <input type="hidden" name="note" defaultValue={item.note ?? ''} />
      <input type="hidden" name="cost_unit_price" defaultValue={item.cost_unit_price ?? ''} />
    </form>
  )
}

// ── helpers ──────────────────────────────────────────────
function serializeRow(item: LineItem): string {
  return [
    item.work_category ?? '', item.item_name ?? '', item.hours ?? '',
    item.labor_amount ?? '', item.parts_qty ?? '', item.parts_unit ?? '',
    item.parts_unit_price ?? '', item.is_excluded ? '1' : '0',
  ].join('\x1f')
}

function serializeRowFromForm(form: HTMLFormElement): string {
  const get = (name: string): string => {
    const el = form.querySelector(`[name="${name}"]`) as HTMLInputElement | null
    if (!el) return ''
    if (el.type === 'checkbox') return el.checked ? '1' : '0'
    return el.value
  }
  return [
    get('work_category'), get('item_name'), get('hours'),
    get('labor_amount'), get('parts_qty'), get('parts_unit'),
    get('parts_unit_price'), get('is_excluded'),
  ].join('\x1f')
}
