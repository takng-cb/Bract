/**
 * Badge / Status pill 共通プリミティブ（REQ-0020 / ADR-0021）
 *
 * 色を直書きせず tone を受け取り、semantic トークン（bg-{tone}-bg / text-{tone}）を当てる。
 * 各画面のステータス色は `*_TONE` マップで tone に正規化してここへ渡す。
 */
import type { ReactNode } from 'react'

export type Tone = 'neutral' | 'brand' | 'danger' | 'warning' | 'positive' | 'info' | 'ai'

/** tone → ユーティリティクラス（tint 背景＋濃色文字） */
export const TONE_CLASS: Record<Tone, string> = {
  neutral:  'bg-n-100 text-n-600',
  brand:    'bg-brand-50 text-brand-700',
  danger:   'bg-danger-bg text-danger',
  warning:  'bg-warning-bg text-warning',
  positive: 'bg-positive-bg text-positive',
  info:     'bg-info-bg text-info',
  ai:       'bg-ai-bg text-ai',
}

export default function Badge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-semibold ${TONE_CLASS[tone]} ${className}`}>
      {children}
    </span>
  )
}

// ── ステータス → tone マップ（design_handoff/README.md「Status Tones」準拠） ──
export const STAGE_TONE: Record<string, Tone> = {
  prospecting: 'neutral', qualification: 'info', proposal: 'ai',
  negotiation: 'warning', closed_won: 'positive', closed_lost: 'neutral',
}
export const PRIORITY_TONE: Record<string, Tone> = {
  high: 'danger', medium: 'warning', low: 'neutral',
}
