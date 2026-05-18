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
          {/* タイヤ */}
          <rect x="38" y="76" width="20" height="12" rx="2" fill={TIRE} />
          <rect x="142" y="76" width="20" height="12" rx="2" fill={TIRE} />
          {/* ボディ（やや低めのセダン正面） */}
          <path d="M 30 78 L 30 60 Q 30 50 42 48 L 158 48 Q 170 50 170 60 L 170 78 Z" fill={BODY} stroke={STROKE} strokeWidth="0.9" />
          {/* ルーフ／ウィンドウ */}
          <path d="M 55 48 L 65 32 Q 70 28 80 28 L 120 28 Q 130 28 135 32 L 145 48 Z" fill={BODY} stroke={STROKE} strokeWidth="0.6" />
          <path d="M 62 47 L 70 35 Q 73 32 80 32 L 120 32 Q 127 32 130 35 L 138 47 Z" fill={GLASS} stroke={STROKE} strokeWidth="0.3" />
          {/* ボンネット線 */}
          <line x1="36" y1="56" x2="164" y2="56" stroke={STROKE} strokeWidth="0.4" />
          {/* グリル */}
          <rect x="80" y="62" width="40" height="10" rx="1" fill={GRILL} stroke={STROKE} strokeWidth="0.4" />
          {/* ヘッドライト */}
          <ellipse cx="50" cy="62" rx="8" ry="4.5" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.4" />
          <ellipse cx="150" cy="62" rx="8" ry="4.5" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.4" />
          {/* ナンバープレート */}
          <rect x="88" y="76" width="24" height="7" fill={PLATE} stroke={STROKE} strokeWidth="0.3" />
        </>
      )
    case 'back':
      return (
        <>
          <rect x="38" y="76" width="20" height="12" rx="2" fill={TIRE} />
          <rect x="142" y="76" width="20" height="12" rx="2" fill={TIRE} />
          <path d="M 30 78 L 30 58 Q 30 50 42 48 L 158 48 Q 170 50 170 58 L 170 78 Z" fill={BODY} stroke={STROKE} strokeWidth="0.9" />
          <path d="M 60 48 L 65 32 Q 70 28 80 28 L 120 28 Q 130 28 135 32 L 140 48 Z" fill={BODY} stroke={STROKE} strokeWidth="0.6" />
          <path d="M 65 47 L 70 35 Q 73 32 80 32 L 120 32 Q 127 32 130 35 L 135 47 Z" fill={GLASS} stroke={STROKE} strokeWidth="0.3" />
          {/* リアウィンドウからのトランク段差 */}
          <line x1="32" y1="58" x2="168" y2="58" stroke={STROKE} strokeWidth="0.4" />
          {/* テールライト */}
          <rect x="36" y="60" width="20" height="10" rx="1" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.4" />
          <rect x="144" y="60" width="20" height="10" rx="1" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.4" />
          {/* ナンバープレート */}
          <rect x="80" y="68" width="40" height="9" fill={PLATE} stroke={STROKE} strokeWidth="0.3" />
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
          <rect x="38" y="76" width="20" height="12" rx="2" fill={TIRE} />
          <rect x="142" y="76" width="20" height="12" rx="2" fill={TIRE} />
          {/* ボディ：高さがある正面 */}
          <path d="M 30 78 L 30 52 Q 30 42 42 40 L 158 40 Q 170 42 170 52 L 170 78 Z" fill={BODY} stroke={STROKE} strokeWidth="0.9" />
          {/* ルーフ：低めの台形（SUV 風） */}
          <path d="M 48 40 L 56 22 L 144 22 L 152 40 Z" fill={BODY} stroke={STROKE} strokeWidth="0.6" />
          <path d="M 54 39 L 61 26 L 139 26 L 146 39 Z" fill={GLASS} stroke={STROKE} strokeWidth="0.3" />
          <line x1="32" y1="56" x2="168" y2="56" stroke={STROKE} strokeWidth="0.4" />
          <rect x="78" y="62" width="44" height="10" rx="1" fill={GRILL} stroke={STROKE} strokeWidth="0.4" />
          <rect x="38" y="58" width="20" height="8" rx="1" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.4" />
          <rect x="142" y="58" width="20" height="8" rx="1" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.4" />
          <rect x="86" y="76" width="28" height="7" fill={PLATE} stroke={STROKE} strokeWidth="0.3" />
        </>
      )
    case 'back':
      return (
        <>
          <rect x="38" y="76" width="20" height="12" rx="2" fill={TIRE} />
          <rect x="142" y="76" width="20" height="12" rx="2" fill={TIRE} />
          <path d="M 30 78 L 30 52 Q 30 42 42 40 L 158 40 Q 170 42 170 52 L 170 78 Z" fill={BODY} stroke={STROKE} strokeWidth="0.9" />
          <path d="M 48 40 L 56 22 L 144 22 L 152 40 Z" fill={BODY} stroke={STROKE} strokeWidth="0.6" />
          {/* リアウィンドウ大 */}
          <path d="M 50 39 L 56 24 L 144 24 L 150 39 Z" fill={GLASS} stroke={STROKE} strokeWidth="0.3" />
          <line x1="32" y1="56" x2="168" y2="56" stroke={STROKE} strokeWidth="0.4" />
          {/* リフトゲート割れ目 */}
          <line x1="100" y1="40" x2="100" y2="74" stroke={STROKE} strokeWidth="0.3" />
          <rect x="36" y="58" width="22" height="14" rx="1" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.4" />
          <rect x="142" y="58" width="22" height="14" rx="1" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.4" />
          <rect x="84" y="68" width="32" height="9" fill={PLATE} stroke={STROKE} strokeWidth="0.3" />
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
        <rect x="38" y="76" width="20" height="12" rx="2" fill={TIRE} />
        <rect x="142" y="76" width="20" height="12" rx="2" fill={TIRE} />
        <path d="M 30 78 L 30 56 Q 30 46 42 44 L 158 44 Q 170 46 170 56 L 170 78 Z" fill={BODY} stroke={STROKE} strokeWidth="0.9" />
        {/* ルーフなし: フロントガラスだけ */}
        <path d="M 65 44 L 70 28 L 130 28 L 135 44 Z" fill={GLASS} stroke={STROKE} strokeWidth="0.4" />
        <line x1="36" y1="56" x2="164" y2="56" stroke={STROKE} strokeWidth="0.4" />
        <rect x="80" y="62" width="40" height="10" rx="1" fill={GRILL} stroke={STROKE} strokeWidth="0.4" />
        <ellipse cx="50" cy="62" rx="8" ry="4.5" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.4" />
        <ellipse cx="150" cy="62" rx="8" ry="4.5" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.4" />
        <rect x="88" y="76" width="24" height="7" fill={PLATE} stroke={STROKE} strokeWidth="0.3" />
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
        <rect x="38" y="76" width="20" height="12" rx="2" fill={TIRE} />
        <rect x="142" y="76" width="20" height="12" rx="2" fill={TIRE} />
        <path d="M 32 78 L 32 36 Q 32 28 42 28 L 158 28 Q 168 28 168 36 L 168 78 Z" fill={BODY} stroke={STROKE} strokeWidth="0.9" />
        {/* キャブ窓（大型） */}
        <rect x="48" y="34" width="104" height="22" rx="2" fill={GLASS} stroke={STROKE} strokeWidth="0.4" />
        <line x1="100" y1="34" x2="100" y2="56" stroke={STROKE} strokeWidth="0.4" />
        <line x1="32" y1="60" x2="168" y2="60" stroke={STROKE} strokeWidth="0.4" />
        <rect x="80" y="64" width="40" height="10" rx="1" fill={GRILL} stroke={STROKE} strokeWidth="0.4" />
        <rect x="40" y="62" width="16" height="8" rx="1" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.4" />
        <rect x="144" y="62" width="16" height="8" rx="1" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.4" />
        <rect x="88" y="76" width="24" height="7" fill={PLATE} stroke={STROKE} strokeWidth="0.3" />
      </>
    )
  }
  if (view === 'back') {
    return (
      <>
        <rect x="38" y="76" width="20" height="12" rx="2" fill={TIRE} />
        <rect x="142" y="76" width="20" height="12" rx="2" fill={TIRE} />
        {/* 荷台後面（フラットな板） */}
        <rect x="28" y="34" width="144" height="44" rx="2" fill={BODY} stroke={STROKE} strokeWidth="0.9" />
        <rect x="34" y="38" width="132" height="32" rx="1" fill="#e2e8f0" stroke={STROKE} strokeWidth="0.4" />
        {/* テールゲート開閉ヒンジ */}
        <line x1="28" y1="70" x2="172" y2="70" stroke={STROKE} strokeWidth="0.4" />
        {/* ライト */}
        <rect x="30" y="62" width="12" height="6" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.3" />
        <rect x="158" y="62" width="12" height="6" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.3" />
        <rect x="80" y="74" width="40" height="6" fill={PLATE} stroke={STROKE} strokeWidth="0.3" />
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
        <rect x="38" y="76" width="20" height="12" rx="2" fill={TIRE} />
        <rect x="142" y="76" width="20" height="12" rx="2" fill={TIRE} />
        {/* 箱の後扉 */}
        <rect x="26" y="20" width="148" height="58" rx="2" fill={BODY} stroke={STROKE} strokeWidth="0.9" />
        {/* 観音開きライン */}
        <line x1="100" y1="20" x2="100" y2="78" stroke={STROKE} strokeWidth="0.6" />
        {/* ヒンジ */}
        <rect x="40" y="30" width="3" height="4" fill={STROKE} />
        <rect x="40" y="60" width="3" height="4" fill={STROKE} />
        <rect x="157" y="30" width="3" height="4" fill={STROKE} />
        <rect x="157" y="60" width="3" height="4" fill={STROKE} />
        {/* ハンドル */}
        <rect x="94" y="45" width="3" height="8" fill={STROKE} />
        <rect x="103" y="45" width="3" height="8" fill={STROKE} />
        <rect x="80" y="80" width="40" height="6" fill={PLATE} stroke={STROKE} strokeWidth="0.3" />
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
        <rect x="38" y="76" width="20" height="12" rx="2" fill={TIRE} />
        <rect x="142" y="76" width="20" height="12" rx="2" fill={TIRE} />
        <rect x="22" y="20" width="156" height="58" rx="3" fill={BODY} stroke={STROKE} strokeWidth="0.9" />
        {/* 大きな前/後窓 */}
        <rect x="32" y="26" width="136" height="28" rx="2" fill={GLASS} stroke={STROKE} strokeWidth="0.4" />
        {isFront ? (
          <>
            <rect x="40" y="58" width="20" height="10" rx="1" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.4" />
            <rect x="140" y="58" width="20" height="10" rx="1" fill={HEADLIGHT} stroke={STROKE} strokeWidth="0.4" />
            <rect x="80" y="62" width="40" height="8" fill={GRILL} stroke={STROKE} strokeWidth="0.4" />
          </>
        ) : (
          <>
            <rect x="32" y="58" width="24" height="14" rx="1" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.4" />
            <rect x="144" y="58" width="24" height="14" rx="1" fill={TAILLIGHT} stroke={STROKE} strokeWidth="0.4" />
          </>
        )}
        <rect x="84" y="76" width="32" height="6" fill={PLATE} stroke={STROKE} strokeWidth="0.3" />
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
