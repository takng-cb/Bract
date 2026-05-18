'use client'

/**
 * 損傷マップの読み取り専用プレビュー（全体ビュー埋め込み用）。
 *
 * - 俯瞰 / 前 / 後 / 左 / 右 の 5 ビューを横並びで表示
 * - 各ビューに該当 view のピンを重ねる
 * - 各ビューをクリックすると拡大モーダルが開く（読み取り専用、編集不可）
 * - ピン番号は全 view 通し連番（編集モーダル内のリストと一致）
 *
 * 編集は親側の SectionEditModal 経由（DamageMapEditor）で行うため、
 * 本コンポーネントには編集機能を含めない。
 */
import { useEffect, useState } from 'react'
import { CarSvg, SEVERITY_COLOR, DAMAGE_VIEW_KEYS, DAMAGE_VIEW_LABELS, type DamageViewKey } from './damageSvg'

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
}

export default function MaintenanceDamageMapPreview({ pins }: Props) {
  // 全ピン通し連番（拡大表示と一致させる）
  const indexMap = new Map<string, number>()
  pins.forEach((p, i) => indexMap.set(p.id, i + 1))

  const [zoomView, setZoomView] = useState<DamageViewKey | null>(null)

  // ESC で閉じる
  useEffect(() => {
    if (!zoomView) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoomView(null) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [zoomView])

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {DAMAGE_VIEW_KEYS.map((vk) => {
          const viewPins = pins.filter((p) => p.view === vk)
          return (
            <button
              key={vk}
              type="button"
              onClick={() => setZoomView(vk)}
              className="bg-zinc-50 border border-zinc-200 rounded-md p-2 text-left hover:border-amber-400 hover:shadow-sm transition-all group"
              aria-label={`${DAMAGE_VIEW_LABELS[vk]} を拡大表示`}
            >
              <p className="text-[10px] uppercase text-zinc-500 mb-1 flex items-center justify-between">
                <span className="font-medium group-hover:text-amber-700">{DAMAGE_VIEW_LABELS[vk]}</span>
                <span className="flex items-center gap-1.5">
                  {viewPins.length > 0 && (
                    <span className="text-amber-700 font-semibold">{viewPins.length}</span>
                  )}
                  <span className="text-zinc-400 group-hover:text-amber-600">🔍</span>
                </span>
              </p>
              <svg
                viewBox="0 0 200 100"
                className="w-full border border-zinc-200 rounded bg-white"
                style={{ aspectRatio: '2/1' }}
                aria-label={`車両図面 ${DAMAGE_VIEW_LABELS[vk]}`}
              >
                <CarSvg view={vk} />
                {viewPins.map((p) => {
                  const x = Number(p.x_pct)
                  const y = Number(p.y_pct)
                  const color = SEVERITY_COLOR[p.severity] ?? '#f97316'
                  const num = indexMap.get(p.id) ?? '?'
                  return (
                    <g key={p.id}>
                      <circle cx={x * 2} cy={y} r="3.5" fill={color} fillOpacity="0.25" />
                      <circle cx={x * 2} cy={y} r="2.2" fill={color} stroke="#fff" strokeWidth="0.5" />
                      <text x={x * 2} y={y + 0.7} fontSize="2" fill="#fff" textAnchor="middle" fontWeight="bold">{num}</text>
                    </g>
                  )
                })}
              </svg>
            </button>
          )
        })}
      </div>

      {/* 拡大モーダル（読み取り専用） */}
      {zoomView && (
        <ZoomModal
          view={zoomView}
          pins={pins.filter((p) => p.view === zoomView)}
          indexMap={indexMap}
          onClose={() => setZoomView(null)}
        />
      )}
    </>
  )
}

// ─── 拡大モーダル（読み取り専用） ─────────────────────────
function ZoomModal({
  view, pins, indexMap, onClose,
}: {
  view:     DamageViewKey
  pins:     Pin[]
  indexMap: Map<string, number>
  onClose:  () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[95vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${DAMAGE_VIEW_LABELS[view]} 拡大表示`}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200">
          <h2 className="text-base font-semibold text-zinc-800 flex items-center gap-2">
            <span>📍 損傷マップ</span>
            <span className="text-zinc-400">／</span>
            <span className="text-amber-700">{DAMAGE_VIEW_LABELS[view]}</span>
            <span className="text-xs text-zinc-500 font-normal">（読み取り専用 / {pins.length} 件）</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 text-2xl leading-none"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        {/* 本文 */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
            {/* 大きな SVG */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3">
              <svg
                viewBox="0 0 200 100"
                className="w-full"
                style={{ aspectRatio: '2/1' }}
                aria-label={`車両図面 ${DAMAGE_VIEW_LABELS[view]} 拡大`}
              >
                <CarSvg view={view} />
                {pins.map((p) => {
                  const x = Number(p.x_pct)
                  const y = Number(p.y_pct)
                  const color = SEVERITY_COLOR[p.severity] ?? '#f97316'
                  const num = indexMap.get(p.id) ?? '?'
                  return (
                    <g key={p.id}>
                      <circle cx={x * 2} cy={y} r="3.5" fill={color} fillOpacity="0.25" />
                      <circle cx={x * 2} cy={y} r="2.2" fill={color} stroke="#fff" strokeWidth="0.5" />
                      <text x={x * 2} y={y + 0.7} fontSize="2" fill="#fff" textAnchor="middle" fontWeight="bold">{num}</text>
                    </g>
                  )
                })}
              </svg>
            </div>

            {/* このビューのピン詳細 */}
            <div className="bg-white border border-zinc-200 rounded-lg p-3 self-start">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                このビューの損傷一覧
              </h3>
              {pins.length === 0 ? (
                <p className="text-xs text-zinc-400 py-2">記録なし</p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {pins.map((p) => {
                    const num = indexMap.get(p.id) ?? '?'
                    const color = SEVERITY_COLOR[p.severity] ?? '#f97316'
                    return (
                      <li key={p.id} className="flex items-start gap-2 px-2 py-1.5 rounded bg-zinc-50">
                        <span
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] font-bold shrink-0 mt-0.5"
                          style={{ backgroundColor: color }}
                        >
                          {num}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="font-medium text-zinc-800">{p.category}</span>
                          <span className="ml-1 text-zinc-500">[{p.severity}]</span>
                          {p.note && <p className="text-zinc-500 text-[11px] mt-0.5">{p.note}</p>}
                        </span>
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
              <p className="text-[10px] text-zinc-400 mt-2">編集は親画面の「✏️ 図面で編集」から</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
