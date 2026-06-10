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
  /** Server Action: ステージ値を受け取り更新する */
  updateAction: (stage: string) => Promise<void>
}

const ARROW = 13 // 矢羽の突き出しサイズ(px)
const FUTURE_BG = '#e4e4e7'  // zinc-200
const FUTURE_TEXT = '#71717a' // zinc-500
const PAST_TEXT = '#fff'

function getClipPath(pos: 'first' | 'middle' | 'last') {
  if (pos === 'first')
    return `polygon(0 0, calc(100% - ${ARROW}px) 0, 100% 50%, calc(100% - ${ARROW}px) 100%, 0 100%)`
  if (pos === 'last')
    return `polygon(${ARROW}px 0, 100% 0, 100% 100%, ${ARROW}px 100%, 0 50%)`
  return `polygon(${ARROW}px 0, calc(100% - ${ARROW}px) 0, 100% 50%, calc(100% - ${ARROW}px) 100%, ${ARROW}px 100%, 0 50%)`
}

export default function StageBar({ stages, currentStage, updateAction }: StageBarProps) {
  const [isPending, startTransition] = useTransition()
  // クリックでは即保存せず、選択中(pending)にする。「変更」ボタンで確定する。
  const [pending, setPending] = useState<string | null>(null)
  const router = useRouter()

  // 表示は選択中があればそれをプレビュー（矢羽の進行も pending に追従）
  const displayStage = pending ?? currentStage
  const currentIndex = stages.findIndex(s => s.value === displayStage)
  const hasPending = pending !== null && pending !== currentStage

  const currentLabel = stages.find(s => s.value === currentStage)?.label ?? currentStage
  const pendingLabel = stages.find(s => s.value === pending)?.label ?? pending

  const select = (value: string) => {
    if (isPending) return
    // 現在ステージを選んだら選択解除（取消）。それ以外は pending にして確定待ち。
    setPending(value === currentStage ? null : value)
  }

  const apply = () => {
    if (!pending || isPending) return
    startTransition(async () => {
      await updateAction(pending)
      setPending(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      <div
        className={`flex w-full select-none transition-opacity ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
        style={{ height: '40px' }}
      >
        {stages.map((stage, index) => {
          const pos = index === 0 ? 'first' : index === stages.length - 1 ? 'last' : 'middle'
          const isCurrent = stage.value === displayStage
          const isPast = index < currentIndex

          const bgColor = isCurrent
            ? stage.activeColor
            : isPast
            ? (stage.pastColor ?? '#93c5fd') // blue-300 をデフォルト
            : FUTURE_BG

          const textColor = isCurrent ? '#fff' : isPast ? PAST_TEXT : FUTURE_TEXT

          const pl = pos === 'first' ? 10 : ARROW + 8
          const pr = pos === 'last'  ? 10 : ARROW + 8

          // 選択中（未確定）のステージは破線リングっぽさを内側シャドウで表現
          const pendingRing = stage.value === pending ? 'inset 0 0 0 2px rgba(255,255,255,0.9), inset 0 0 0 4px rgba(0,0,0,0.15)' : undefined

          return (
            <button
              key={stage.value}
              onClick={() => select(stage.value)}
              disabled={isPending}
              title={stage.value === currentStage ? `現在: ${stage.label}` : `${stage.label} に変更（「変更」ボタンで確定）`}
              style={{
                clipPath: getClipPath(pos),
                marginLeft: index > 0 ? `${-ARROW}px` : 0,
                zIndex: stages.length - index,
                backgroundColor: bgColor,
                color: textColor,
                paddingLeft: `${pl}px`,
                paddingRight: `${pr}px`,
                position: 'relative',
                boxShadow: pendingRing,
              }}
              className={`
                flex-1 flex items-center justify-center gap-1
                text-xs font-medium whitespace-nowrap overflow-hidden
                transition-[filter]
                ${stage.value === currentStage ? 'cursor-default' : 'cursor-pointer hover:brightness-90'}
              `}
            >
              {isCurrent && <span className="shrink-0">✓</span>}
              <span className="truncate">{stage.label}</span>
            </button>
          )
        })}
      </div>

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
