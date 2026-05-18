/**
 * 損傷マップの SVG プリミティブ。
 *
 * - 車両 5 ビュー（俯瞰・前面・後面・左側面・右側面）の線画
 * - 損傷ピンの色（程度別）
 *
 * 編集 UI (`DamageMapEditor`) と読み取り専用ビュー (`MaintenanceDamageMapPreview`)
 * の双方から使う想定。'use client' を付けない（純粋な JSX）ことでサーバー
 * コンポーネントからも直接呼べる。
 */

export const DAMAGE_VIEW_KEYS = ['top', 'front', 'back', 'left', 'right'] as const
export type DamageViewKey = (typeof DAMAGE_VIEW_KEYS)[number]

export const DAMAGE_VIEW_LABELS: Record<DamageViewKey, string> = {
  top:   '俯瞰',
  front: '前面',
  back:  '後面',
  left:  '左側面',
  right: '右側面',
}

/** 程度別ピン色 */
export const SEVERITY_COLOR: Record<string, string> = {
  '軽': '#fbbf24', // amber-400
  '中': '#f97316', // orange-500
  '大': '#dc2626', // red-600
}

/**
 * 車両 SVG（シンプル線画 4 面 + 俯瞰図）
 * viewBox は 0 0 200 100。
 * ピン側は x = x_pct × 2、y = y_pct で配置する。
 */
export function CarSvg({ view }: { view: string }) {
  const stroke = '#94a3b8'  // slate-400
  const fill   = '#f8fafc'  // slate-50
  switch (view) {
    case 'top':
      return (
        <>
          <rect x="30" y="20" width="140" height="60" rx="14" fill={fill} stroke={stroke} strokeWidth="0.8" />
          <path d="M 55 30 L 90 30 L 90 70 L 55 70 Z" fill="#e2e8f0" stroke={stroke} strokeWidth="0.4" />
          <path d="M 110 30 L 145 30 L 145 70 L 110 70 Z" fill="#e2e8f0" stroke={stroke} strokeWidth="0.4" />
          <circle cx="37" cy="30" r="2" fill="#fbbf24" stroke={stroke} strokeWidth="0.3" />
          <circle cx="37" cy="70" r="2" fill="#fbbf24" stroke={stroke} strokeWidth="0.3" />
          <rect x="158" y="28" width="6" height="4" fill="#dc2626" stroke={stroke} strokeWidth="0.3" />
          <rect x="158" y="68" width="6" height="4" fill="#dc2626" stroke={stroke} strokeWidth="0.3" />
          <rect x="40" y="18" width="14" height="4" fill="#1e293b" rx="1" />
          <rect x="40" y="78" width="14" height="4" fill="#1e293b" rx="1" />
          <rect x="140" y="18" width="14" height="4" fill="#1e293b" rx="1" />
          <rect x="140" y="78" width="14" height="4" fill="#1e293b" rx="1" />
          <text x="100" y="50" fontSize="3" fill={stroke} textAnchor="middle">↑ 前</text>
        </>
      )
    case 'front':
      return (
        <>
          <rect x="50" y="35" width="100" height="50" rx="6" fill={fill} stroke={stroke} strokeWidth="0.8" />
          <path d="M 70 35 L 130 35 L 125 50 L 75 50 Z" fill="#e2e8f0" stroke={stroke} strokeWidth="0.4" />
          <rect x="80" y="62" width="40" height="12" fill="#cbd5e1" stroke={stroke} strokeWidth="0.4" />
          <ellipse cx="62" cy="60" rx="6" ry="4" fill="#fbbf24" stroke={stroke} strokeWidth="0.4" />
          <ellipse cx="138" cy="60" rx="6" ry="4" fill="#fbbf24" stroke={stroke} strokeWidth="0.4" />
          <rect x="90" y="78" width="20" height="6" fill="#fff" stroke={stroke} strokeWidth="0.3" />
          <rect x="46" y="80" width="10" height="8" fill="#1e293b" rx="1" />
          <rect x="144" y="80" width="10" height="8" fill="#1e293b" rx="1" />
        </>
      )
    case 'back':
      return (
        <>
          <rect x="50" y="35" width="100" height="50" rx="6" fill={fill} stroke={stroke} strokeWidth="0.8" />
          <path d="M 70 35 L 130 35 L 125 50 L 75 50 Z" fill="#e2e8f0" stroke={stroke} strokeWidth="0.4" />
          <line x1="60" y1="68" x2="140" y2="68" stroke={stroke} strokeWidth="0.4" />
          <rect x="56" y="55" width="12" height="8" fill="#dc2626" stroke={stroke} strokeWidth="0.4" />
          <rect x="132" y="55" width="12" height="8" fill="#dc2626" stroke={stroke} strokeWidth="0.4" />
          <rect x="85" y="72" width="30" height="8" fill="#fff" stroke={stroke} strokeWidth="0.3" />
          <rect x="46" y="80" width="10" height="8" fill="#1e293b" rx="1" />
          <rect x="144" y="80" width="10" height="8" fill="#1e293b" rx="1" />
        </>
      )
    case 'left':
    case 'right': {
      const mirror = view === 'right' ? -1 : 1
      return (
        <g transform={mirror === -1 ? 'translate(200, 0) scale(-1, 1)' : undefined}>
          <path d="M 20 65 L 35 55 Q 50 45 70 45 L 130 45 Q 150 45 165 55 L 180 65 L 180 80 L 20 80 Z"
            fill={fill} stroke={stroke} strokeWidth="0.8" />
          <path d="M 55 55 L 95 55 L 90 45 L 70 45 Z" fill="#e2e8f0" stroke={stroke} strokeWidth="0.4" />
          <path d="M 105 55 L 145 55 L 130 45 L 110 45 Z" fill="#e2e8f0" stroke={stroke} strokeWidth="0.4" />
          <line x1="95" y1="55" x2="95" y2="80" stroke={stroke} strokeWidth="0.4" />
          <line x1="105" y1="55" x2="105" y2="80" stroke={stroke} strokeWidth="0.4" />
          <circle cx="48" cy="78" r="9" fill="#1e293b" />
          <circle cx="48" cy="78" r="5" fill="#64748b" />
          <circle cx="152" cy="78" r="9" fill="#1e293b" />
          <circle cx="152" cy="78" r="5" fill="#64748b" />
          <text x="30" y="40" fontSize="3" fill={stroke}>← 前</text>
        </g>
      )
    }
    default:
      return null
  }
}
