'use client'

import { useTransition } from 'react'
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
  const router = useRouter()

  const currentIndex = stages.findIndex(s => s.value === currentStage)

  const handleClick = (value: string) => {
    if (value === currentStage || isPending) return
    startTransition(async () => {
      await updateAction(value)
      router.refresh()
    })
  }

  return (
    <div
      className={`flex w-full select-none transition-opacity ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
      style={{ height: '40px' }}
    >
      {stages.map((stage, index) => {
        const pos = index === 0 ? 'first' : index === stages.length - 1 ? 'last' : 'middle'
        const isCurrent = stage.value === currentStage
        const isPast = index < currentIndex

        const bgColor = isCurrent
          ? stage.activeColor
          : isPast
          ? (stage.pastColor ?? '#93c5fd') // blue-300 をデフォルト
          : FUTURE_BG

        const textColor = isCurrent
          ? '#fff'
          : isPast
          ? PAST_TEXT
          : FUTURE_TEXT

        const pl = pos === 'first' ? 10 : ARROW + 8
        const pr = pos === 'last'  ? 10 : ARROW + 8

        return (
          <button
            key={stage.value}
            onClick={() => handleClick(stage.value)}
            disabled={isPending}
            title={isCurrent ? `現在: ${stage.label}` : `${stage.label} に変更`}
            style={{
              clipPath: getClipPath(pos),
              marginLeft: index > 0 ? `${-ARROW}px` : 0,
              zIndex: stages.length - index,
              backgroundColor: bgColor,
              color: textColor,
              paddingLeft: `${pl}px`,
              paddingRight: `${pr}px`,
              position: 'relative',
            }}
            className={`
              flex-1 flex items-center justify-center gap-1
              text-xs font-medium whitespace-nowrap overflow-hidden
              transition-[filter]
              ${isCurrent ? 'cursor-default' : 'cursor-pointer hover:brightness-90'}
            `}
          >
            {isCurrent && <span className="shrink-0">✓</span>}
            <span className="truncate">{stage.label}</span>
          </button>
        )
      })}
    </div>
  )
}
