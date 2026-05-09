'use client'

/**
 * 売上予測ページの 2 つのチャート（Recharts）。
 *
 * 1. 折れ線: 期間内の close_date 時系列で、想定売上 (確度加重) と
 *    受注済を 月（または週）粒度で集計
 * 2. 積み上げ棒: 期間内の商談をステージ別に積み上げ（想定売上ベース）
 */
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'

export type TimeBucket = {
  /** ラベル（例: "2026-05" or "2026/W19"） */
  label: string
  /** 想定売上（確度加重） */
  weighted: number
  /** 受注済（実績） */
  closedWon: number
}

export type StageBucket = {
  /** ラベル（例: "2026-05"） */
  label: string
  /** ステージ別 想定売上（確度加重） */
  prospecting:   number
  qualification: number
  proposal:      number
  negotiation:   number
  closed_won:    number
}

const STAGE_COLORS: Record<keyof Omit<StageBucket, 'label'>, string> = {
  prospecting:   '#a1a1aa',  // zinc-400
  qualification: '#2563eb',  // blue-600
  proposal:      '#d97706',  // amber-600
  negotiation:   '#ea580c',  // orange-600
  closed_won:    '#16a34a',  // green-600
}

const STAGE_LABELS: Record<keyof Omit<StageBucket, 'label'>, string> = {
  prospecting:   '見込み',
  qualification: '要件確認',
  proposal:      '提案',
  negotiation:   '交渉',
  closed_won:    '受注',
}

const yenFmt = (v: number) => `¥${Math.round(v).toLocaleString('ja-JP')}`

export function ForecastTimeSeriesChart({ data }: { data: TimeBucket[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-zinc-400 text-center py-12">期間内のデータがありません</p>
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1_000_000 ? `${Math.round(v / 1_000_000)}M` : v >= 1000 ? `${Math.round(v / 1000)}K` : `${v}`} />
        <Tooltip formatter={(v) => yenFmt(Number(v ?? 0))} contentStyle={{ fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="weighted"  name="想定売上"    stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="closedWon" name="受注済"      stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function ForecastStageStackedChart({ data }: { data: StageBucket[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-zinc-400 text-center py-12">期間内のデータがありません</p>
  }
  const stageKeys = Object.keys(STAGE_COLORS) as (keyof Omit<StageBucket, 'label'>)[]
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1_000_000 ? `${Math.round(v / 1_000_000)}M` : v >= 1000 ? `${Math.round(v / 1000)}K` : `${v}`} />
        <Tooltip formatter={(v) => yenFmt(Number(v ?? 0))} contentStyle={{ fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {stageKeys.map((k) => (
          <Bar key={k} dataKey={k} stackId="a" name={STAGE_LABELS[k]} fill={STAGE_COLORS[k]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export type OwnerBucket = {
  /** 担当者名（または "未設定"） */
  ownerName: string
  /** 想定売上（確度加重） */
  weighted: number
  /** 商談件数 */
  count: number
}

export function ForecastOwnerBarChart({ data }: { data: OwnerBucket[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-zinc-400 text-center py-12">期間内のデータがありません</p>
  }
  // 想定売上の降順で並び替え
  const sorted = [...data].sort((a, b) => b.weighted - a.weighted)
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, sorted.length * 36 + 40)}>
      <BarChart data={sorted} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1_000_000 ? `${Math.round(v / 1_000_000)}M` : v >= 1000 ? `${Math.round(v / 1000)}K` : `${v}`} />
        <YAxis type="category" dataKey="ownerName" width={100} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => yenFmt(Number(v ?? 0))} contentStyle={{ fontSize: 12 }} />
        <Bar dataKey="weighted" name="想定売上" fill="#2563eb" />
      </BarChart>
    </ResponsiveContainer>
  )
}
