'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export type StageConfig = {
  value: string
  label: string
  /** active時の背景色 (hex) */
  activeColor: string
  /** past時の背景色 (hex) */
  pastColor?: string
}

type StageBarProps = {
  stages: StageConfig[]
  currentStage: string
  /**
   * Server Action: ステージ値を受け取り更新する。
   * 承認ゲート（REQ-0037）に掛かった場合は { approvalRequested: true } を返す
   * （変更は適用されず、承認完了時に自動反映される）。
   */
  updateAction: (stage: string) => Promise<void | { approvalRequested?: boolean }>
}

const FUTURE_LINE = '#e4e4e7'  // zinc-200
const FUTURE_RING = '#d4d4d8'  // zinc-300（未来の丸の枠）

export default function StageBar({ stages, currentStage, updateAction }: StageBarProps) {
  const [isPending, startTransition] = useTransition()
  // クリックでは即保存せず、選択中(pending)にする。「変更」ボタンで確定する。
  const [pending, setPending] = useState<string | null>(null)
  // 承認ゲートに掛かった時の案内（承認待ちが作られた・エラー）
  const [notice, setNotice] = useState<string | null>(null)
  const router = useRouter()

  // 表示は選択中があればそれをプレビュー（進行も pending に追従）
  const displayStage = pending ?? currentStage
  const currentIndex = stages.findIndex(s => s.value === displayStage)
  const hasPending = pending !== null && pending !== currentStage

  const currentLabel = stages.find(s => s.value === currentStage)?.label ?? currentStage
  const pendingLabel = stages.find(s => s.value === pending)?.label ?? pending

  // 完了トラックの色＝現在ステージの active 色（進捗ラインを現ステータス色で表現）
  const doneLine = stages[currentIndex]?.activeColor ?? '#2563eb'

  const select = (value: string) => {
    if (isPending) return
    // 現在ステージを選んだら選択解除（取消）。それ以外は pending にして確定待ち。
    setPending(value === currentStage ? null : value)
  }

  const apply = () => {
    if (!pending || isPending) return
    startTransition(async () => {
      try {
        const res = await updateAction(pending)
        setNotice(res && 'approvalRequested' in res && res.approvalRequested
          ? '承認待ちを作成しました。承認されるとステータスが変わります。'
          : null)
      } catch (e) {
        setNotice((e as Error)?.message ?? 'ステータスを変更できませんでした')
      }
      setPending(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      <div className={`flex w-full select-none transition-opacity ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
        {stages.map((stage, index) => {
          const isCurrent = index === currentIndex
          const isPast    = index < currentIndex
          const isPendingNode = stage.value === pending && pending !== currentStage

          // 丸のスタイル
          const circleStyle: React.CSSProperties = isPast
            ? { backgroundColor: stage.pastColor ?? '#93c5fd', color: '#fff', borderColor: 'transparent' }
            : isCurrent
            ? { backgroundColor: stage.activeColor, color: '#fff', borderColor: 'transparent', boxShadow: `0 0 0 3px ${stage.activeColor}33` }
            : { backgroundColor: '#fff', color: '#a1a1aa', borderColor: FUTURE_RING }

          // 未確定（pending）はアンバーのリングで強調
          if (isPendingNode) circleStyle.boxShadow = '0 0 0 3px rgba(245,158,11,0.45)'

          const labelColor = isCurrent ? 'text-zinc-900 font-semibold' : isPast ? 'text-zinc-600' : 'text-zinc-400'

          return (
            <button
              key={stage.value}
              onClick={() => select(stage.value)}
              disabled={isPending}
              title={stage.value === currentStage ? `現在: ${stage.label}` : `${stage.label} に変更（「変更」ボタンで確定）`}
              className={`flex-1 flex flex-col items-center min-w-0 ${stage.value === currentStage ? 'cursor-default' : 'cursor-pointer group'}`}
            >
              {/* 丸＋接続線 */}
              <div className="relative flex items-center justify-center w-full h-7">
                {index > 0 && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-0.75 w-1/2 rounded-full"
                    style={{ backgroundColor: index <= currentIndex ? doneLine : FUTURE_LINE }}
                  />
                )}
                {index < stages.length - 1 && (
                  <span
                    className="absolute right-0 top-1/2 -translate-y-1/2 h-0.75 w-1/2 rounded-full"
                    style={{ backgroundColor: index < currentIndex ? doneLine : FUTURE_LINE }}
                  />
                )}
                <span
                  className="relative z-10 grid place-items-center w-7 h-7 rounded-full border-2 text-[12px] font-bold transition-transform group-hover:scale-105"
                  style={circleStyle}
                >
                  {isPast ? '✓' : isCurrent ? '✓' : ''}
                </span>
              </div>
              {/* ラベル */}
              <span className={`mt-1.5 text-[11px] leading-tight text-center truncate w-full px-0.5 ${labelColor}`}>
                {stage.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* 承認ゲートの案内（承認待ち作成 / エラー） */}
      {notice && !hasPending && (
        <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="ml-auto rounded px-1.5 py-0.5 text-blue-400 hover:bg-blue-100" aria-label="閉じる">✕</button>
        </div>
      )}

      {/* 未確定の変更：確定/取消（即保存しない） */}
      {hasPending && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs">
          <span className="text-amber-800">
            未保存の変更：<b>{currentLabel}</b> → <b>{pendingLabel}</b>
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={apply}
              disabled={isPending}
              className="rounded bg-brand-600 px-3 py-1 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {isPending ? '変更中…' : '変更'}
            </button>
            <button
              onClick={() => setPending(null)}
              disabled={isPending}
              className="rounded border border-zinc-300 bg-white px-3 py-1 text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
