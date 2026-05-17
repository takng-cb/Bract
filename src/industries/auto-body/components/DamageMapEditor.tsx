'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

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

const SEVERITY_COLOR: Record<string, string> = {
  '軽': '#fbbf24', // amber-400
  '中': '#f97316', // orange-500
  '大': '#dc2626', // red-600
}

export default function DamageMapEditor({ pins, canEdit, createAction, updateAction, deleteAction }: Props) {
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
                active ? 'border-amber-600 text-amber-700' : 'border-transparent text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {v.label}
              {count > 0 && (
                <span className={`ml-1.5 px-1 py-0.5 rounded text-[10px] ${active ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-600'}`}>
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
            <CarSvg view={activeView} />

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
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-amber-50/40 flex items-start gap-2"
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
// 車両 SVG（シンプル線画 4 面 + 俯瞰図）
// 1 viewBox = 200x100。座標は左右に 2 倍スケール（x_pct × 2）で配置。
// ──────────────────────────────────────────────────────────────
function CarSvg({ view }: { view: string }) {
  const stroke = '#94a3b8'  // slate-400
  const fill   = '#f8fafc'  // slate-50
  switch (view) {
    case 'top':
      return (
        <>
          {/* ボディ俯瞰 */}
          <rect x="30" y="20" width="140" height="60" rx="14" fill={fill} stroke={stroke} strokeWidth="0.8" />
          {/* フロントガラス */}
          <path d="M 55 30 L 90 30 L 90 70 L 55 70 Z" fill="#e2e8f0" stroke={stroke} strokeWidth="0.4" />
          {/* リアガラス */}
          <path d="M 110 30 L 145 30 L 145 70 L 110 70 Z" fill="#e2e8f0" stroke={stroke} strokeWidth="0.4" />
          {/* ヘッドライト */}
          <circle cx="37" cy="30" r="2" fill="#fbbf24" stroke={stroke} strokeWidth="0.3" />
          <circle cx="37" cy="70" r="2" fill="#fbbf24" stroke={stroke} strokeWidth="0.3" />
          {/* テールライト */}
          <rect x="158" y="28" width="6" height="4" fill="#dc2626" stroke={stroke} strokeWidth="0.3" />
          <rect x="158" y="68" width="6" height="4" fill="#dc2626" stroke={stroke} strokeWidth="0.3" />
          {/* タイヤ */}
          <rect x="40" y="18" width="14" height="4" fill="#1e293b" rx="1" />
          <rect x="40" y="78" width="14" height="4" fill="#1e293b" rx="1" />
          <rect x="140" y="18" width="14" height="4" fill="#1e293b" rx="1" />
          <rect x="140" y="78" width="14" height="4" fill="#1e293b" rx="1" />
          {/* 表示ラベル */}
          <text x="100" y="50" fontSize="3" fill={stroke} textAnchor="middle">↑ 前</text>
        </>
      )
    case 'front':
      return (
        <>
          {/* フロント */}
          <rect x="50" y="35" width="100" height="50" rx="6" fill={fill} stroke={stroke} strokeWidth="0.8" />
          {/* フロントガラス */}
          <path d="M 70 35 L 130 35 L 125 50 L 75 50 Z" fill="#e2e8f0" stroke={stroke} strokeWidth="0.4" />
          {/* グリル */}
          <rect x="80" y="62" width="40" height="12" fill="#cbd5e1" stroke={stroke} strokeWidth="0.4" />
          {/* ヘッドライト */}
          <ellipse cx="62" cy="60" rx="6" ry="4" fill="#fbbf24" stroke={stroke} strokeWidth="0.4" />
          <ellipse cx="138" cy="60" rx="6" ry="4" fill="#fbbf24" stroke={stroke} strokeWidth="0.4" />
          {/* ナンバープレート */}
          <rect x="90" y="78" width="20" height="6" fill="#fff" stroke={stroke} strokeWidth="0.3" />
          {/* タイヤ */}
          <rect x="46" y="80" width="10" height="8" fill="#1e293b" rx="1" />
          <rect x="144" y="80" width="10" height="8" fill="#1e293b" rx="1" />
        </>
      )
    case 'back':
      return (
        <>
          <rect x="50" y="35" width="100" height="50" rx="6" fill={fill} stroke={stroke} strokeWidth="0.8" />
          <path d="M 70 35 L 130 35 L 125 50 L 75 50 Z" fill="#e2e8f0" stroke={stroke} strokeWidth="0.4" />
          {/* トランク線 */}
          <line x1="60" y1="68" x2="140" y2="68" stroke={stroke} strokeWidth="0.4" />
          {/* テールライト */}
          <rect x="56" y="55" width="12" height="8" fill="#dc2626" stroke={stroke} strokeWidth="0.4" />
          <rect x="132" y="55" width="12" height="8" fill="#dc2626" stroke={stroke} strokeWidth="0.4" />
          {/* ナンバープレート */}
          <rect x="85" y="72" width="30" height="8" fill="#fff" stroke={stroke} strokeWidth="0.3" />
          {/* タイヤ */}
          <rect x="46" y="80" width="10" height="8" fill="#1e293b" rx="1" />
          <rect x="144" y="80" width="10" height="8" fill="#1e293b" rx="1" />
        </>
      )
    case 'left':
    case 'right': {
      const mirror = view === 'right' ? -1 : 1
      return (
        <g transform={mirror === -1 ? 'translate(200, 0) scale(-1, 1)' : undefined}>
          {/* サイドビュー */}
          <path d="M 20 65 L 35 55 Q 50 45 70 45 L 130 45 Q 150 45 165 55 L 180 65 L 180 80 L 20 80 Z"
            fill={fill} stroke={stroke} strokeWidth="0.8" />
          {/* フロントガラス */}
          <path d="M 55 55 L 95 55 L 90 45 L 70 45 Z" fill="#e2e8f0" stroke={stroke} strokeWidth="0.4" />
          {/* リアガラス */}
          <path d="M 105 55 L 145 55 L 130 45 L 110 45 Z" fill="#e2e8f0" stroke={stroke} strokeWidth="0.4" />
          {/* ドア線 */}
          <line x1="95" y1="55" x2="95" y2="80" stroke={stroke} strokeWidth="0.4" />
          <line x1="105" y1="55" x2="105" y2="80" stroke={stroke} strokeWidth="0.4" />
          {/* タイヤ */}
          <circle cx="48" cy="78" r="9" fill="#1e293b" />
          <circle cx="48" cy="78" r="5" fill="#64748b" />
          <circle cx="152" cy="78" r="9" fill="#1e293b" />
          <circle cx="152" cy="78" r="5" fill="#64748b" />
          {/* 進行方向 */}
          <text x="30" y="40" fontSize="3" fill={stroke}>← 前</text>
        </g>
      )
    }
    default:
      return null
  }
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
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-zinc-50"
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
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white text-zinc-700 border-zinc-300 hover:bg-amber-50/40 disabled:opacity-50'
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
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-zinc-50"
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
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 shadow-sm"
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
