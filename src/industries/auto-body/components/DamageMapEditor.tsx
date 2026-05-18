'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CarSvg, SEVERITY_COLOR } from './damageSvg'

type Pin = {
  id:        string
  view:      string  // 'top' | 'front' | 'back' | 'left' | 'right'
  x_pct:     string
  y_pct:     string
  category:  string
  severity:  string
  note:      string | null
}

type Props = {
  pins: Pin[]
  canEdit: boolean
  /** 車両の body_shape を渡すと SVG シルエットが切り替わる */
  bodyShape?: string | null
  createAction: (data: { view: string; x_pct: number; y_pct: number; category: string; severity: string; note: string | null }) => Promise<void>
  updateAction: (pinId: string, data: { category: string; severity: string; note: string | null }) => Promise<void>
  deleteAction: (pinId: string) => Promise<void>
}

const VIEWS: { key: string; label: string }[] = [
  { key: 'top',   label: '俯瞰図（上面）' },
  { key: 'front', label: '前面' },
  { key: 'back',  label: '後面' },
  { key: 'left',  label: '左側面' },
  { key: 'right', label: '右側面' },
]

const CATEGORIES = ['凹み', '擦り傷', '塗装剥がれ', '破損', 'サビ', 'その他']
const SEVERITIES = ['軽', '中', '大']

export default function DamageMapEditor({ pins, canEdit, bodyShape, createAction, updateAction, deleteAction }: Props) {
  const [activeView, setActiveView] = useState<string>('top')
  const [pendingPin, setPendingPin] = useState<{ view: string; x: number; y: number } | null>(null)
  const [editingPin, setEditingPin] = useState<Pin | null>(null)
  const [, startTransition] = useTransition()
  const router = useRouter()

  const viewPins = pins.filter((p) => p.view === activeView)
  // 各 view に通し番号を付与
  const indexMap = new Map<string, number>()
  pins.forEach((p, i) => indexMap.set(p.id, i + 1))

  function handleSvgClick(evt: React.MouseEvent<SVGSVGElement>) {
    if (!canEdit) return
    const svg = evt.currentTarget
    const rect = svg.getBoundingClientRect()
    const x = ((evt.clientX - rect.left) / rect.width) * 100
    const y = ((evt.clientY - rect.top) / rect.height) * 100
    setPendingPin({ view: activeView, x, y })
  }

  return (
    <div className="space-y-4">
      {/* View 切替タブ */}
      <div className="flex flex-wrap gap-1 border-b border-zinc-200">
        {VIEWS.map((v) => {
          const count = pins.filter((p) => p.view === v.key).length
          const active = activeView === v.key
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => setActiveView(v.key)}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                active ? 'border-blue-600 text-blue-600' : 'border-transparent text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {v.label}
              {count > 0 && (
                <span className={`ml-1.5 px-1 py-0.5 rounded text-[10px] ${active ? 'bg-zinc-100 text-blue-600' : 'bg-zinc-100 text-zinc-600'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 図面 + ピン */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 bg-white border border-zinc-200 rounded-lg p-4">
          <p className="text-xs text-zinc-500 mb-2">
            {canEdit ? '🖱️ 図面の損傷箇所をクリックしてピンを追加' : '🔍 図面上のピンが損傷箇所です'}
          </p>
          <svg
            viewBox="0 0 200 100"
            className={`w-full border border-zinc-200 rounded bg-zinc-50 ${canEdit ? 'cursor-crosshair' : ''}`}
            onClick={handleSvgClick}
            style={{ aspectRatio: '2/1' }}
          >
            {/* 車両図面 (シンプル線画) */}
            <CarSvg view={activeView} shape={bodyShape ?? undefined} />

            {/* ピン描画 */}
            {viewPins.map((p) => {
              const x = Number(p.x_pct)
              const y = Number(p.y_pct)
              const color = SEVERITY_COLOR[p.severity] ?? '#f97316'
              const num = indexMap.get(p.id) ?? '?'
              return (
                <g key={p.id}
                  className="cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); setEditingPin(p) }}
                >
                  {/* halo */}
                  <circle cx={x * 2} cy={y} r="3.5" fill={color} fillOpacity="0.25" />
                  {/* main pin */}
                  <circle cx={x * 2} cy={y} r="2.2" fill={color} stroke="#fff" strokeWidth="0.5" />
                  <text x={x * 2} y={y + 0.7} fontSize="2" fill="#fff" textAnchor="middle" fontWeight="bold">{num}</text>
                </g>
              )
            })}

            {/* 一時ピン（クリック直後・確定前） */}
            {pendingPin && pendingPin.view === activeView && (
              <g>
                <circle cx={pendingPin.x * 2} cy={pendingPin.y} r="3" fill="#3b82f6" fillOpacity="0.5" />
                <circle cx={pendingPin.x * 2} cy={pendingPin.y} r="2" fill="#3b82f6" />
              </g>
            )}
          </svg>
        </div>

        {/* ピンリスト */}
        <div className="lg:w-72 bg-white border border-zinc-200 rounded-lg p-3 self-start">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">この面の損傷一覧</h3>
          {viewPins.length === 0 ? (
            <p className="text-xs text-zinc-400 py-2">記録なし</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {viewPins.map((p) => {
                const num = indexMap.get(p.id) ?? '?'
                const color = SEVERITY_COLOR[p.severity] ?? '#f97316'
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setEditingPin(p)}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-zinc-50/40 flex items-start gap-2"
                    >
                      <span
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] font-bold shrink-0 mt-0.5"
                        style={{ backgroundColor: color }}
                      >
                        {num}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="font-medium text-zinc-800">{p.category}</span>
                        <span className="ml-1 text-zinc-500">[{p.severity}]</span>
                        {p.note && <p className="text-zinc-500 text-[11px] truncate">{p.note}</p>}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="text-[10px] text-zinc-400 mt-3 pt-2 border-t border-zinc-100">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1"></span>軽
            <span className="inline-block w-2 h-2 rounded-full bg-orange-500 ml-2 mr-1"></span>中
            <span className="inline-block w-2 h-2 rounded-full bg-red-600 ml-2 mr-1"></span>大
          </p>
        </div>
      </div>

      {/* 新規ピンモーダル */}
      {pendingPin && (
        <PinEditModal
          mode="create"
          initial={{ category: '凹み', severity: '中', note: '' }}
          onSubmit={(data) => {
            startTransition(async () => {
              await createAction({
                view: pendingPin.view,
                x_pct: pendingPin.x,
                y_pct: pendingPin.y,
                ...data,
                note: data.note || null,
              })
              setPendingPin(null)
              router.refresh()
            })
          }}
          onCancel={() => setPendingPin(null)}
        />
      )}

      {/* 既存ピン編集モーダル */}
      {editingPin && (
        <PinEditModal
          mode="edit"
          initial={{ category: editingPin.category, severity: editingPin.severity, note: editingPin.note ?? '' }}
          canDelete={canEdit}
          canEdit={canEdit}
          onSubmit={(data) => {
            if (!canEdit) return
            startTransition(async () => {
              await updateAction(editingPin.id, { ...data, note: data.note || null })
              setEditingPin(null)
              router.refresh()
            })
          }}
          onDelete={() => {
            if (!confirm('このピンを削除しますか？')) return
            startTransition(async () => {
              await deleteAction(editingPin.id)
              setEditingPin(null)
              router.refresh()
            })
          }}
          onCancel={() => setEditingPin(null)}
        />
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// ピン編集モーダル（新規 / 編集 共通）
// ──────────────────────────────────────────────────────────────
function PinEditModal({
  mode, initial, canEdit = true, canDelete = false,
  onSubmit, onDelete, onCancel,
}: {
  mode: 'create' | 'edit'
  initial: { category: string; severity: string; note: string }
  canEdit?: boolean
  canDelete?: boolean
  onSubmit: (data: { category: string; severity: string; note: string }) => void
  onDelete?: () => void
  onCancel: () => void
}) {
  const [category, setCategory] = useState(initial.category)
  const [severity, setSeverity] = useState(initial.severity)
  const [note, setNote] = useState(initial.note)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md bg-white rounded-lg shadow-xl p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-zinc-800">
          {mode === 'create' ? '📍 損傷箇所を追加' : '📍 損傷箇所を編集'}
        </h3>

        <div>
          <label className="block text-xs text-zinc-500 mb-1">区分</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={!canEdit}
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-zinc-50"
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs text-zinc-500 mb-1">程度</label>
          <div className="flex gap-2">
            {SEVERITIES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => canEdit && setSeverity(s)}
                disabled={!canEdit}
                className={`flex-1 py-2 text-sm rounded-md border transition-colors ${
                  severity === s
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50/40 disabled:opacity-50'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-zinc-500 mb-1">メモ</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={!canEdit}
            rows={2}
            placeholder="例: 直径 3cm、パテ補修可"
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-zinc-50"
          />
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          <div>
            {canDelete && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="px-3 py-1.5 text-xs text-rose-600 border border-rose-200 rounded-md hover:bg-rose-50"
              >
                削除
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm border border-zinc-300 rounded-md hover:bg-zinc-50"
            >
              キャンセル
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={() => onSubmit({ category, severity, note })}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm"
              >
                {mode === 'create' ? '追加' : '保存'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
