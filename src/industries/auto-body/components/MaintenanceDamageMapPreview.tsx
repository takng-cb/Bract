/**
 * 損傷マップの読み取り専用プレビュー（全体ビュー埋め込み用）。
 *
 * - 俯瞰 / 前 / 後 / 左 / 右 の 5 ビューを横並びで表示
 * - 各ビューに該当 view のピンを重ねる
 * - ピン番号は全 view 通し連番（編集モーダル内のリストと一致）
 *
 * 編集は親側の SectionEditModal 経由で行うため、本コンポーネントには
 * クリック/ドラッグ等のインタラクションを持たせない。
 */
import { CarSvg, SEVERITY_COLOR, DAMAGE_VIEW_KEYS, DAMAGE_VIEW_LABELS } from './damageSvg'

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
  // 全ピン通し連番
  const indexMap = new Map<string, number>()
  pins.forEach((p, i) => indexMap.set(p.id, i + 1))

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      {DAMAGE_VIEW_KEYS.map((vk) => {
        const viewPins = pins.filter((p) => p.view === vk)
        return (
          <div key={vk} className="bg-zinc-50 border border-zinc-200 rounded-md p-2">
            <p className="text-[10px] uppercase text-zinc-500 mb-1 flex items-center justify-between">
              <span className="font-medium">{DAMAGE_VIEW_LABELS[vk]}</span>
              {viewPins.length > 0 && (
                <span className="text-amber-700 font-semibold">{viewPins.length}</span>
              )}
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
                    <text
                      x={x * 2}
                      y={y + 0.7}
                      fontSize="2"
                      fill="#fff"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {num}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        )
      })}
    </div>
  )
}
