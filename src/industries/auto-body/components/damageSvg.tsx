/**
 * 損傷マップの SVG プリミティブ。
 *
 * - 車両 5 ビュー（俯瞰・前面・後面・左側面・右側面）の線画
 * - 損傷ピンの色（程度別）
 * - 車体の形状 (body_shape) ごとにシルエットを切り替える
 *
 * 編集 UI (`DamageMapEditor`) と読み取り専用ビュー (`MaintenanceDamageMapPreview`)
 * の双方から使う想定。'use client' を付けない（純粋な JSX）ことでサーバー
 * コンポーネントからも直接呼べる。
 */
import { bodyShapeFamily, type BodySvgFamily } from '@/industries/auto-body/lib/bodyShapes'

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

// ─── 共通カラー（線・面）───
const STROKE      = '#64748b'   // slate-500
const BODY        = '#cbd5e1'   // slate-300（ボディ色）
const GLASS       = '#bae6fd'   // sky-200
const TIRE        = '#1e293b'   // slate-800
const WHEEL_HUB   = '#64748b'   // slate-500
const HEADLIGHT   = '#fde68a'   // amber-200
const TAILLIGHT   = '#ef4444'   // red-500
const GRILL       = '#94a3b8'   // slate-400
const PLATE       = '#f8fafc'   // slate-50

type CarSvgProps = {
  view: string
  /** 車体の形状（VEHICLE_BODY_SHAPES の値）または直接 family を渡す */
  shape?: string | BodySvgFamily
}

/**
 * 車両 SVG。viewBox は 0 0 200 100。
 * ピン側は x = x_pct × 2、y = y_pct で配置する。
 */
export function CarSvg({ view, shape }: CarSvgProps) {
  const family = isFamily(shape) ? shape : bodyShapeFamily(shape)
  switch (family) {
    case 'sedan':  return <SedanSvg  view={view} />
    case 'wagon':  return <WagonSvg  view={view} />
    case 'open':   return <OpenSvg   view={view} />
    case 'pickup': return <PickupSvg view={view} />
    case 'van':    return <VanSvg    view={view} />
    case 'bus':    return <BusSvg    view={view} />
    default:       return <SedanSvg  view={view} />
  }
}

function isFamily(s: string | undefined): s is BodySvgFamily {
  return s === 'sedan' || s === 'wagon' || s === 'open' || s === 'pickup' || s === 'van' || s === 'bus'
}

// ─────────────────────────────────────────────────
// 共通パーツ
// ─────────────────────────────────────────────────

function Tire({ cx, cy, r = 8 }: { cx: number; cy: number; r?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={TIRE} />
      <circle cx={cx} cy={cy} r={r * 0.55} fill={WHEEL_HUB} />
      <circle cx={cx} cy={cy} r={r * 0.25} fill={TIRE} />
    </g>
  )
}

function TopTire({ x, y, w = 14, h = 5 }: { x: number; y: number; w?: number; h?: number }) {
  return <rect x={x} y={y} width={w} height={h} rx="1" fill={TIRE} />
}

// ─────────────────────────────────────────────────
// セダン・クーペ・軽自動車：基本のセダン形
// ─────────────────────────────────────────────────
function SedanSvg({ view }: { view: string }) {
  switch (view) {
    case 'top':
      return (
        <>
          {/* タイヤ（4 つ・ボディの下に描画） */}
          <TopTire x={40} y={17} />
          <TopTire x={40} y={78} />
          <TopTire x={140} y={17} />
          <TopTire x={140} y={78} />
          {/* ボディ（角丸長方形） */}
          <rect x="22" y="22" width="156" height="56" rx="22" ry="14" fill={BODY} stroke={STROKE} strokeWidth="0.9" />
          {/* ルーフ（やや細め） */}
          <rect x="52" y="34" width="98" height="32" rx="6" fill={GLASS} stroke={STROKE} strokeWidth="0.5" />
          {/* フロント／リアの境界線 */}
          <line x1="100" y1="34" x2="100" y2="66" stroke={STROKE} strokeWidth="0.4" />
          {/* ボンネット・トランク模様 */}
          <line x1="38" y1="40" x2="52" y2="40" stroke={STROKE} strokeWidth="0.4" />
          <line x1="38" y1="60" x2="52" y2="60" stroke={STROKE} strokeWidth="0.4" />
          <line x1="150" y1="40" x2="164" y2="40" stroke={STROKE} strokeWidth="0.4" />
          <line x1="150" y1="60" x2="164" y2="60" stroke={STROKE} strokeWidth="0.4" />
          {/* ヘッドライト */}
          <ellipse cx="25" cy="32" rx="3" ry="2" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.3" />
          <ellipse cx="25" cy="68" rx="3" ry="2" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.3" />
          {/* テールライト */}
          <rect x="171" y="29" width="5" height="5" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.3" />
          <rect x="171" y="66" width="5" height="5" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.3" />
          {/* 進行方向 */}
          <text x="100" y="50" fontSize="3" fill={STROKE} textAnchor="middle">↑ 前</text>
        </>
      )
    case 'front':
      return (
        <>
          {/* タイヤ（車体下に隠れて下半分だけ覗く） */}
          <rect x="48" y="82" width="20" height="14" rx="2" fill={TIRE} />
          <rect x="132" y="82" width="20" height="14" rx="2" fill={TIRE} />
          {/* 下部ボディ（中央寄せ・幅 120） */}
          <path d="M 42 88 L 42 56 Q 44 48 56 46 L 144 46 Q 156 48 158 56 L 158 88 Z" fill={BODY} stroke={STROKE} strokeWidth="0.9" />
          {/* ルーフ */}
          <path d="M 60 46 L 70 22 Q 74 18 82 18 L 118 18 Q 126 18 130 22 L 140 46 Z" fill={BODY} stroke={STROKE} strokeWidth="0.6" />
          {/* フロントガラス */}
          <path d="M 64 45 L 73 26 Q 76 23 82 23 L 118 23 Q 124 23 127 26 L 136 45 Z" fill={GLASS} stroke={STROKE} strokeWidth="0.3" />
          {/* ボンネット線 */}
          <line x1="44" y1="58" x2="156" y2="58" stroke={STROKE} strokeWidth="0.4" />
          {/* グリル */}
          <rect x="84" y="64" width="32" height="10" rx="1" fill={GRILL} stroke={STROKE} strokeWidth="0.4" />
          {/* ヘッドライト */}
          <ellipse cx="58" cy="66" rx="9" ry="5" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.4" />
          <ellipse cx="142" cy="66" rx="9" ry="5" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.4" />
          {/* ナンバープレート（車体内） */}
          <rect x="88" y="80" width="24" height="6" fill={PLATE} stroke={STROKE} strokeWidth="0.3" />
        </>
      )
    case 'back':
      return (
        <>
          <rect x="48" y="82" width="20" height="14" rx="2" fill={TIRE} />
          <rect x="132" y="82" width="20" height="14" rx="2" fill={TIRE} />
          <path d="M 42 88 L 42 56 Q 44 48 56 46 L 144 46 Q 156 48 158 56 L 158 88 Z" fill={BODY} stroke={STROKE} strokeWidth="0.9" />
          <path d="M 64 46 L 70 22 Q 74 18 82 18 L 118 18 Q 126 18 130 22 L 136 46 Z" fill={BODY} stroke={STROKE} strokeWidth="0.6" />
          {/* リアウィンドウ */}
          <path d="M 68 45 L 73 26 Q 76 23 82 23 L 118 23 Q 124 23 127 26 L 132 45 Z" fill={GLASS} stroke={STROKE} strokeWidth="0.3" />
          {/* リアトランク段差 */}
          <line x1="44" y1="60" x2="156" y2="60" stroke={STROKE} strokeWidth="0.4" />
          {/* テールライト */}
          <rect x="46" y="62" width="20" height="10" rx="1" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.4" />
          <rect x="134" y="62" width="20" height="10" rx="1" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.4" />
          {/* ナンバープレート */}
          <rect x="80" y="76" width="40" height="8" fill={PLATE} stroke={STROKE} strokeWidth="0.3" />
        </>
      )
    case 'left':
    case 'right':
      return <SideSilhouette view={view} variant="sedan" />
    default: return null
  }
}

// ─────────────────────────────────────────────────
// ワゴン / SUV / ミニバン：ルーフが長く高い
// ─────────────────────────────────────────────────
function WagonSvg({ view }: { view: string }) {
  switch (view) {
    case 'top':
      return (
        <>
          <TopTire x={38} y={17} />
          <TopTire x={38} y={78} />
          <TopTire x={148} y={17} />
          <TopTire x={148} y={78} />
          {/* ボディ：長方形に近い角丸 */}
          <rect x="20" y="22" width="160" height="56" rx="14" ry="10" fill={BODY} stroke={STROKE} strokeWidth="0.9" />
          {/* ルーフが大きい */}
          <rect x="45" y="32" width="120" height="36" rx="4" fill={GLASS} stroke={STROKE} strokeWidth="0.5" />
          {/* ピラー */}
          <line x1="78" y1="32" x2="78" y2="68" stroke={STROKE} strokeWidth="0.4" />
          <line x1="128" y1="32" x2="128" y2="68" stroke={STROKE} strokeWidth="0.4" />
          {/* ヘッドライト */}
          <ellipse cx="23" cy="32" rx="3" ry="2" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.3" />
          <ellipse cx="23" cy="68" rx="3" ry="2" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.3" />
          <rect x="173" y="29" width="5" height="5" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.3" />
          <rect x="173" y="66" width="5" height="5" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.3" />
          <text x="100" y="50" fontSize="3" fill={STROKE} textAnchor="middle">↑ 前</text>
        </>
      )
    case 'front':
      return (
        <>
          <rect x="48" y="82" width="20" height="14" rx="2" fill={TIRE} />
          <rect x="132" y="82" width="20" height="14" rx="2" fill={TIRE} />
          {/* ボディ（中央寄せ・幅 120） */}
          <path d="M 42 88 L 42 46 Q 44 38 56 36 L 144 36 Q 156 38 158 46 L 158 88 Z" fill={BODY} stroke={STROKE} strokeWidth="0.9" />
          {/* ルーフ：低めの台形（SUV 風） */}
          <path d="M 56 36 L 64 14 L 136 14 L 144 36 Z" fill={BODY} stroke={STROKE} strokeWidth="0.6" />
          <path d="M 60 35 L 67 18 L 133 18 L 140 35 Z" fill={GLASS} stroke={STROKE} strokeWidth="0.3" />
          <line x1="44" y1="54" x2="156" y2="54" stroke={STROKE} strokeWidth="0.4" />
          <rect x="82" y="62" width="36" height="12" rx="1" fill={GRILL} stroke={STROKE} strokeWidth="0.4" />
          <rect x="48" y="58" width="22" height="10" rx="1" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.4" />
          <rect x="130" y="58" width="22" height="10" rx="1" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.4" />
          <rect x="86" y="80" width="28" height="6" fill={PLATE} stroke={STROKE} strokeWidth="0.3" />
        </>
      )
    case 'back':
      return (
        <>
          <rect x="48" y="82" width="20" height="14" rx="2" fill={TIRE} />
          <rect x="132" y="82" width="20" height="14" rx="2" fill={TIRE} />
          <path d="M 42 88 L 42 46 Q 44 38 56 36 L 144 36 Q 156 38 158 46 L 158 88 Z" fill={BODY} stroke={STROKE} strokeWidth="0.9" />
          <path d="M 56 36 L 64 14 L 136 14 L 144 36 Z" fill={BODY} stroke={STROKE} strokeWidth="0.6" />
          {/* リアウィンドウ大 */}
          <path d="M 58 35 L 64 16 L 136 16 L 142 35 Z" fill={GLASS} stroke={STROKE} strokeWidth="0.3" />
          <line x1="44" y1="54" x2="156" y2="54" stroke={STROKE} strokeWidth="0.4" />
          {/* リフトゲート割れ目 */}
          <line x1="100" y1="36" x2="100" y2="80" stroke={STROKE} strokeWidth="0.3" />
          <rect x="46" y="58" width="22" height="16" rx="1" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.4" />
          <rect x="132" y="58" width="22" height="16" rx="1" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.4" />
          <rect x="84" y="76" width="32" height="8" fill={PLATE} stroke={STROKE} strokeWidth="0.3" />
        </>
      )
    case 'left':
    case 'right':
      return <SideSilhouette view={view} variant="wagon" />
    default: return null
  }
}

// ─────────────────────────────────────────────────
// オープンカー：ルーフなしのセダン
// ─────────────────────────────────────────────────
function OpenSvg({ view }: { view: string }) {
  if (view === 'top') {
    return (
      <>
        <TopTire x={40} y={17} />
        <TopTire x={40} y={78} />
        <TopTire x={140} y={17} />
        <TopTire x={140} y={78} />
        <rect x="22" y="22" width="156" height="56" rx="22" ry="14" fill={BODY} stroke={STROKE} strokeWidth="0.9" />
        {/* 開口部（座席） */}
        <rect x="78" y="38" width="44" height="24" rx="3" fill="#1e293b" fillOpacity="0.15" stroke={STROKE} strokeWidth="0.4" />
        {/* フロントガラス */}
        <path d="M 72 35 Q 78 33 84 33 L 116 33 Q 122 33 128 35 L 124 38 L 76 38 Z" fill={GLASS} stroke={STROKE} strokeWidth="0.4" />
        <ellipse cx="25" cy="32" rx="3" ry="2" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.3" />
        <ellipse cx="25" cy="68" rx="3" ry="2" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.3" />
        <rect x="171" y="29" width="5" height="5" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.3" />
        <rect x="171" y="66" width="5" height="5" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.3" />
        <text x="100" y="50" fontSize="3" fill={STROKE} textAnchor="middle">↑ 前</text>
      </>
    )
  }
  if (view === 'front') {
    return (
      <>
        <rect x="48" y="82" width="20" height="14" rx="2" fill={TIRE} />
        <rect x="132" y="82" width="20" height="14" rx="2" fill={TIRE} />
        <path d="M 42 88 L 42 52 Q 44 44 56 42 L 144 42 Q 156 44 158 52 L 158 88 Z" fill={BODY} stroke={STROKE} strokeWidth="0.9" />
        {/* ルーフなし: フロントガラスだけ */}
        <path d="M 70 42 L 76 20 L 124 20 L 130 42 Z" fill={GLASS} stroke={STROKE} strokeWidth="0.4" />
        <line x1="44" y1="58" x2="156" y2="58" stroke={STROKE} strokeWidth="0.4" />
        <rect x="84" y="64" width="32" height="10" rx="1" fill={GRILL} stroke={STROKE} strokeWidth="0.4" />
        <ellipse cx="58" cy="66" rx="9" ry="5" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.4" />
        <ellipse cx="142" cy="66" rx="9" ry="5" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.4" />
        <rect x="88" y="80" width="24" height="6" fill={PLATE} stroke={STROKE} strokeWidth="0.3" />
      </>
    )
  }
  if (view === 'back') {
    return <SedanSvg view="back" />
  }
  return <SideSilhouette view={view} variant="open" />
}

// ─────────────────────────────────────────────────
// ピックアップ：軽トラ・平ボディ・ダンプ
// ─────────────────────────────────────────────────
function PickupSvg({ view }: { view: string }) {
  if (view === 'top') {
    return (
      <>
        <TopTire x={38} y={17} />
        <TopTire x={38} y={78} />
        <TopTire x={150} y={17} />
        <TopTire x={150} y={78} />
        {/* キャブ */}
        <rect x="22" y="24" width="50" height="52" rx="4" fill={BODY} stroke={STROKE} strokeWidth="0.9" />
        <rect x="30" y="30" width="36" height="40" rx="2" fill={GLASS} stroke={STROKE} strokeWidth="0.4" />
        {/* 荷台（平床） */}
        <rect x="74" y="22" width="104" height="56" rx="2" fill="#94a3b8" stroke={STROKE} strokeWidth="0.9" />
        <rect x="78" y="26" width="96" height="48" rx="1" fill="#e2e8f0" stroke={STROKE} strokeWidth="0.4" />
        {/* キャブとの境 */}
        <line x1="72" y1="24" x2="72" y2="76" stroke={STROKE} strokeWidth="0.6" />
        {/* ヘッドライト */}
        <ellipse cx="25" cy="32" rx="3" ry="2" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.3" />
        <ellipse cx="25" cy="68" rx="3" ry="2" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.3" />
        <rect x="173" y="29" width="5" height="5" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.3" />
        <rect x="173" y="66" width="5" height="5" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.3" />
        <text x="50" y="52" fontSize="3" fill={STROKE} textAnchor="middle">↑ 前</text>
      </>
    )
  }
  if (view === 'front') {
    return (
      <>
        <rect x="48" y="82" width="20" height="14" rx="2" fill={TIRE} />
        <rect x="132" y="82" width="20" height="14" rx="2" fill={TIRE} />
        {/* 縦長のキャブ（トラックは背が高い） */}
        <path d="M 42 88 L 42 22 Q 44 14 56 12 L 144 12 Q 156 14 158 22 L 158 88 Z" fill={BODY} stroke={STROKE} strokeWidth="0.9" />
        {/* キャブ窓 */}
        <rect x="54" y="20" width="92" height="32" rx="2" fill={GLASS} stroke={STROKE} strokeWidth="0.4" />
        <line x1="100" y1="20" x2="100" y2="52" stroke={STROKE} strokeWidth="0.4" />
        <line x1="44" y1="58" x2="156" y2="58" stroke={STROKE} strokeWidth="0.4" />
        <rect x="82" y="64" width="36" height="12" rx="1" fill={GRILL} stroke={STROKE} strokeWidth="0.4" />
        <rect x="48" y="62" width="20" height="10" rx="1" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.4" />
        <rect x="132" y="62" width="20" height="10" rx="1" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.4" />
        <rect x="88" y="80" width="24" height="6" fill={PLATE} stroke={STROKE} strokeWidth="0.3" />
      </>
    )
  }
  if (view === 'back') {
    return (
      <>
        <rect x="48" y="82" width="20" height="14" rx="2" fill={TIRE} />
        <rect x="132" y="82" width="20" height="14" rx="2" fill={TIRE} />
        {/* 荷台後面（フラットな板・縦長） */}
        <rect x="42" y="16" width="116" height="72" rx="2" fill={BODY} stroke={STROKE} strokeWidth="0.9" />
        <rect x="48" y="22" width="104" height="50" rx="1" fill="#e2e8f0" stroke={STROKE} strokeWidth="0.4" />
        {/* テールゲート開閉ヒンジ */}
        <line x1="42" y1="74" x2="158" y2="74" stroke={STROKE} strokeWidth="0.4" />
        {/* ライト */}
        <rect x="46" y="76" width="14" height="8" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.3" />
        <rect x="140" y="76" width="14" height="8" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.3" />
        <rect x="84" y="78" width="32" height="6" fill={PLATE} stroke={STROKE} strokeWidth="0.3" />
      </>
    )
  }
  return <SideSilhouette view={view} variant="pickup" />
}

// ─────────────────────────────────────────────────
// バントラック：キャブ + 箱型荷台
// ─────────────────────────────────────────────────
function VanSvg({ view }: { view: string }) {
  if (view === 'top') {
    return (
      <>
        <TopTire x={38} y={17} />
        <TopTire x={38} y={78} />
        <TopTire x={150} y={17} />
        <TopTire x={150} y={78} />
        {/* キャブ */}
        <rect x="22" y="24" width="44" height="52" rx="4" fill={BODY} stroke={STROKE} strokeWidth="0.9" />
        <rect x="30" y="30" width="30" height="40" rx="2" fill={GLASS} stroke={STROKE} strokeWidth="0.4" />
        {/* 箱型荷室 */}
        <rect x="68" y="20" width="110" height="60" rx="2" fill={BODY} stroke={STROKE} strokeWidth="0.9" />
        {/* 箱の上面パネル割 */}
        <line x1="100" y1="20" x2="100" y2="80" stroke={STROKE} strokeWidth="0.4" />
        <line x1="135" y1="20" x2="135" y2="80" stroke={STROKE} strokeWidth="0.4" />
        <ellipse cx="25" cy="32" rx="3" ry="2" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.3" />
        <ellipse cx="25" cy="68" rx="3" ry="2" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.3" />
        <text x="44" y="52" fontSize="3" fill={STROKE} textAnchor="middle">↑ 前</text>
      </>
    )
  }
  if (view === 'front') {
    return <PickupSvg view="front" />
  }
  if (view === 'back') {
    return (
      <>
        <rect x="48" y="82" width="20" height="14" rx="2" fill={TIRE} />
        <rect x="132" y="82" width="20" height="14" rx="2" fill={TIRE} />
        {/* 箱の後扉（縦長） */}
        <rect x="42" y="12" width="116" height="76" rx="2" fill={BODY} stroke={STROKE} strokeWidth="0.9" />
        {/* 観音開きライン */}
        <line x1="100" y1="12" x2="100" y2="88" stroke={STROKE} strokeWidth="0.6" />
        {/* ヒンジ */}
        <rect x="46" y="22" width="3" height="4" fill={STROKE} />
        <rect x="46" y="74" width="3" height="4" fill={STROKE} />
        <rect x="151" y="22" width="3" height="4" fill={STROKE} />
        <rect x="151" y="74" width="3" height="4" fill={STROKE} />
        {/* ハンドル */}
        <rect x="94" y="48" width="3" height="10" fill={STROKE} />
        <rect x="103" y="48" width="3" height="10" fill={STROKE} />
        <rect x="84" y="82" width="32" height="6" fill={PLATE} stroke={STROKE} strokeWidth="0.3" />
      </>
    )
  }
  return <SideSilhouette view={view} variant="van" />
}

// ─────────────────────────────────────────────────
// バス：長い箱型 + 多窓
// ─────────────────────────────────────────────────
function BusSvg({ view }: { view: string }) {
  if (view === 'top') {
    return (
      <>
        <TopTire x={32} y={17} />
        <TopTire x={32} y={78} />
        <TopTire x={156} y={17} />
        <TopTire x={156} y={78} />
        <rect x="16" y="22" width="168" height="56" rx="6" fill={BODY} stroke={STROKE} strokeWidth="0.9" />
        {/* 屋根（明色） */}
        <rect x="22" y="28" width="156" height="44" rx="3" fill="#e2e8f0" stroke={STROKE} strokeWidth="0.4" />
        <ellipse cx="19" cy="32" rx="3" ry="2" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.3" />
        <ellipse cx="19" cy="68" rx="3" ry="2" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.3" />
        <text x="100" y="50" fontSize="3" fill={STROKE} textAnchor="middle">↑ 前</text>
      </>
    )
  }
  if (view === 'front' || view === 'back') {
    const isFront = view === 'front'
    return (
      <>
        {/* タイヤ（車体下に隠す） */}
        <rect x="48" y="82" width="20" height="14" rx="2" fill={TIRE} />
        <rect x="132" y="82" width="20" height="14" rx="2" fill={TIRE} />
        {/* バスの正方形に近い前面 / 後面 */}
        <rect x="42" y="10" width="116" height="78" rx="3" fill={BODY} stroke={STROKE} strokeWidth="0.9" />
        {/* 大きな前/後窓 */}
        <rect x="50" y="18" width="100" height="40" rx="2" fill={GLASS} stroke={STROKE} strokeWidth="0.4" />
        {isFront ? (
          <>
            <rect x="48" y="62" width="22" height="10" rx="1" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.4" />
            <rect x="130" y="62" width="22" height="10" rx="1" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.4" />
            <rect x="78" y="64" width="44" height="8" fill={GRILL} stroke={STROKE} strokeWidth="0.4" />
          </>
        ) : (
          <>
            <rect x="48" y="62" width="22" height="14" rx="1" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.4" />
            <rect x="130" y="62" width="22" height="14" rx="1" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.4" />
          </>
        )}
        <rect x="84" y="80" width="32" height="6" fill={PLATE} stroke={STROKE} strokeWidth="0.3" />
      </>
    )
  }
  return <SideSilhouette view={view} variant="bus" />
}

// ─────────────────────────────────────────────────
// 側面シルエット（共通: variant 毎にプロポーションを変える）
//   - canvas 200x100 をなるべく縦方向にも使い、車らしさを向上
//   - 車輪は r=10、cy=88 で大きめに
//   - 屋根は y=14〜20 付近、ガラスは y=24〜36 付近
//   - 「← 前」テキストは右側面ビューでは反転して読めなくなるので、
//      非ミラー時 (= 左 / その他) のみ表示する
//   - バスのドアは日本では助手席側 (左側面) にのみ存在するため
//      view==='left' のときだけ描画
// ─────────────────────────────────────────────────
function SideSilhouette({ view, variant }: { view: string; variant: 'sedan' | 'wagon' | 'open' | 'pickup' | 'van' | 'bus' }) {
  const mirror = view === 'right' ? -1 : 1
  const transform = mirror === -1 ? 'translate(200, 0) scale(-1, 1)' : undefined
  const isLeftView = view !== 'right'  // 左側面 (mirror なし) のとき true

  switch (variant) {
    case 'sedan':
      return (
        <g transform={transform}>
          {/* 下部ボディ（拡大版） */}
          <path d="M 10 88 L 10 66 Q 14 60 24 56 L 64 52 Q 72 30 88 26 L 122 26 Q 138 30 144 52 L 184 56 Q 192 60 192 70 L 192 88 Z"
            fill={BODY} stroke={STROKE} strokeWidth="0.9" />
          {/* ウィンドウ */}
          <path d="M 70 52 Q 76 34 90 30 L 120 30 Q 134 34 140 52 Z" fill={GLASS} stroke={STROKE} strokeWidth="0.4" />
          <line x1="105" y1="30" x2="105" y2="52" stroke={STROKE} strokeWidth="0.4" />
          {/* ドア線 */}
          <line x1="62" y1="52" x2="62" y2="88" stroke={STROKE} strokeWidth="0.4" />
          <line x1="105" y1="52" x2="105" y2="88" stroke={STROKE} strokeWidth="0.4" />
          <line x1="144" y1="52" x2="144" y2="88" stroke={STROKE} strokeWidth="0.4" />
          {/* ハンドル */}
          <rect x="82" y="64" width="8" height="2.5" fill={STROKE} />
          <rect x="120" y="64" width="8" height="2.5" fill={STROKE} />
          <Tire cx={48} cy={88} r={10} />
          <Tire cx={152} cy={88} r={10} />
          {/* ライト */}
          <rect x="10" y="62" width="8" height="6" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.3" />
          <rect x="182" y="62" width="8" height="6" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.3" />
          {isLeftView && <text x="20" y="22" fontSize="4" fill={STROKE}>← 前</text>}
        </g>
      )
    case 'wagon':
      return (
        <g transform={transform}>
          {/* SUV/ミニバン: 背の高い箱型 */}
          <path d="M 10 88 L 10 64 Q 14 56 28 52 L 46 48 Q 52 18 70 14 L 150 14 Q 162 18 164 48 L 184 52 Q 192 58 192 70 L 192 88 Z"
            fill={BODY} stroke={STROKE} strokeWidth="0.9" />
          {/* 大きなサイドウィンドウ */}
          <path d="M 50 48 Q 54 22 72 18 L 148 18 Q 160 22 162 48 Z" fill={GLASS} stroke={STROKE} strokeWidth="0.4" />
          {/* ピラー */}
          <line x1="76" y1="18" x2="76" y2="48" stroke={STROKE} strokeWidth="0.4" />
          <line x1="105" y1="18" x2="105" y2="48" stroke={STROKE} strokeWidth="0.4" />
          <line x1="135" y1="18" x2="135" y2="48" stroke={STROKE} strokeWidth="0.4" />
          {/* ドア線 */}
          <line x1="60" y1="48" x2="60" y2="88" stroke={STROKE} strokeWidth="0.4" />
          <line x1="105" y1="48" x2="105" y2="88" stroke={STROKE} strokeWidth="0.4" />
          <line x1="148" y1="48" x2="148" y2="88" stroke={STROKE} strokeWidth="0.4" />
          {/* ハンドル */}
          <rect x="82" y="62" width="8" height="2.5" fill={STROKE} />
          <rect x="122" y="62" width="8" height="2.5" fill={STROKE} />
          <Tire cx={48} cy={88} r={10} />
          <Tire cx={152} cy={88} r={10} />
          <rect x="10" y="60" width="8" height="8" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.3" />
          <rect x="182" y="58" width="8" height="10" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.3" />
          {isLeftView && <text x="20" y="12" fontSize="4" fill={STROKE}>← 前</text>}
        </g>
      )
    case 'open':
      return (
        <g transform={transform}>
          {/* 低めセダン（ルーフなし） */}
          <path d="M 10 88 L 10 66 Q 14 60 24 56 L 70 52 L 130 52 L 184 56 Q 192 60 192 70 L 192 88 Z"
            fill={BODY} stroke={STROKE} strokeWidth="0.9" />
          {/* フロントガラスのみ */}
          <path d="M 76 52 L 80 32 L 96 32 L 100 52 Z" fill={GLASS} stroke={STROKE} strokeWidth="0.4" />
          {/* 座席 */}
          <rect x="100" y="44" width="44" height="8" fill="#1e293b" fillOpacity="0.25" stroke={STROKE} strokeWidth="0.3" />
          <line x1="62" y1="52" x2="62" y2="88" stroke={STROKE} strokeWidth="0.4" />
          <line x1="144" y1="52" x2="144" y2="88" stroke={STROKE} strokeWidth="0.4" />
          <Tire cx={48} cy={88} r={10} />
          <Tire cx={152} cy={88} r={10} />
          <rect x="10" y="62" width="8" height="6" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.3" />
          <rect x="182" y="62" width="8" height="6" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.3" />
          {isLeftView && <text x="20" y="22" fontSize="4" fill={STROKE}>← 前</text>}
        </g>
      )
    case 'pickup':
      return (
        <g transform={transform}>
          {/* キャブ */}
          <path d="M 10 88 L 10 66 Q 14 56 28 52 L 46 48 Q 52 18 72 14 L 96 14 Q 104 18 106 48 L 106 88 Z"
            fill={BODY} stroke={STROKE} strokeWidth="0.9" />
          {/* キャブ窓 */}
          <path d="M 50 48 Q 54 22 74 18 L 94 18 Q 102 22 104 48 Z" fill={GLASS} stroke={STROKE} strokeWidth="0.4" />
          <line x1="78" y1="18" x2="78" y2="48" stroke={STROKE} strokeWidth="0.4" />
          {/* 荷台（開放） */}
          <rect x="106" y="42" width="84" height="46" fill={BODY} stroke={STROKE} strokeWidth="0.9" />
          {/* 荷台床 */}
          <rect x="110" y="50" width="76" height="34" fill="#e2e8f0" stroke={STROKE} strokeWidth="0.4" />
          {/* 荷台の壁段差 */}
          <line x1="106" y1="50" x2="190" y2="50" stroke={STROKE} strokeWidth="0.4" />
          <Tire cx={46} cy={88} r={10} />
          <Tire cx={156} cy={88} r={10} />
          <rect x="10" y="62" width="8" height="6" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.3" />
          <rect x="182" y="62" width="8" height="6" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.3" />
          {isLeftView && <text x="20" y="12" fontSize="4" fill={STROKE}>← 前</text>}
        </g>
      )
    case 'van':
      return (
        <g transform={transform}>
          {/* キャブ */}
          <path d="M 10 88 L 10 66 Q 14 58 28 54 L 48 50 Q 52 22 70 18 L 92 18 Q 98 22 100 50 L 100 88 Z"
            fill={BODY} stroke={STROKE} strokeWidth="0.9" />
          <path d="M 52 50 Q 56 26 72 22 L 90 22 Q 96 26 98 50 Z" fill={GLASS} stroke={STROKE} strokeWidth="0.4" />
          {/* 箱型荷室 */}
          <rect x="100" y="12" width="90" height="76" fill={BODY} stroke={STROKE} strokeWidth="0.9" />
          {/* パネル割 */}
          <line x1="140" y1="12" x2="140" y2="88" stroke={STROKE} strokeWidth="0.4" />
          <line x1="170" y1="12" x2="170" y2="88" stroke={STROKE} strokeWidth="0.4" />
          {/* 荷室の小窓 */}
          <rect x="106" y="20" width="28" height="14" rx="1" fill={GLASS} stroke={STROKE} strokeWidth="0.3" />
          <Tire cx={46} cy={88} r={10} />
          <Tire cx={158} cy={88} r={10} />
          <rect x="10" y="62" width="8" height="6" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.3" />
          <rect x="186" y="58" width="4" height="8" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.3" />
          {isLeftView && <text x="20" y="12" fontSize="4" fill={STROKE}>← 前</text>}
        </g>
      )
    case 'bus':
      return (
        <g transform={transform}>
          {/* 長い箱型ボディ（縦方向に大きく） */}
          <rect x="6" y="20" width="188" height="68" rx="4" fill={BODY} stroke={STROKE} strokeWidth="0.9" />
          {/* 等間隔の側面窓 */}
          {[14, 38, 62, 86, 110, 134, 158, 178].map((x) => (
            <rect key={x} x={x} y="28" width="18" height="22" rx="1" fill={GLASS} stroke={STROKE} strokeWidth="0.3" />
          ))}
          {/* 床ライン */}
          <line x1="6" y1="58" x2="194" y2="58" stroke={STROKE} strokeWidth="0.4" />
          {/* 乗降ドアは日本では助手席側 (左側面) のみ → mirror なし時のみ描画
              左側面において車体の「前寄り」(canvas 左寄り)、運転席後ろ位置 */}
          {isLeftView && (
            <>
              <rect x="20" y="58" width="14" height="30" fill="#94a3b8" stroke={STROKE} strokeWidth="0.4" />
              {/* ドア中央の縦線（観音開き） */}
              <line x1="27" y1="58" x2="27" y2="88" stroke={STROKE} strokeWidth="0.4" />
            </>
          )}
          <Tire cx={34} cy={88} r={10} />
          <Tire cx={166} cy={88} r={10} />
          {/* ヘッドライト・テールライト */}
          <rect x="6" y="62" width="6" height="8" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.3" />
          <rect x="188" y="62" width="6" height="8" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.3" />
          {isLeftView && <text x="18" y="16" fontSize="4" fill={STROKE}>← 前</text>}
        </g>
      )
  }
}
