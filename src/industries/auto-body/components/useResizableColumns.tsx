'use client'

/**
 * Staged 編集表（作業項目・諸費用・入金）用の列幅リサイズ機構。
 *
 * - 列定義: { key, label, widthRem, flex? } の配列
 * - 各列の幅をユーザーがドラッグして調整可能（flex 列は除く）
 * - localStorage にキーごとに保存し、次回も同じ幅で復元
 * - 列幅から `grid-template-columns` 文字列を生成して各行に同じ値を流す
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'

export type ResizableColumn = {
  /** 一意キー（localStorage 識別、React key 用） */
  key: string
  /** ヘッダー表示 */
  label: ReactNode
  /** 既定の列幅（rem）。flex の場合は無視 */
  widthRem: number
  /** 横方向に伸縮する列の場合 true。リサイズ不可 */
  flex?: boolean
  /** ヘッダーセル追加クラス */
  headerClass?: string
}

const MIN_REM = 2  // 最小 2rem = 32px 程度
const MAX_REM = 40 // 最大 40rem = 640px 程度

export function useResizableColumns(storageKey: string, columns: ResizableColumn[]) {
  const defaults = columns.map((c) => c.widthRem)

  const [widths, setWidths] = useState<number[]>(defaults)

  // クライアントのみ localStorage から復元
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr) && arr.length === defaults.length && arr.every((v) => typeof v === 'number')) {
          setWidths(arr)
        }
      }
    } catch {
      // 破損時は default
    }
    // 初回のみ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  // 変更を保存
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(widths))
    } catch {
      // localStorage 不可（プライバシモード等）はサイレント
    }
  }, [storageKey, widths])

  /** `grid-template-columns` に渡す文字列 */
  const gridTemplate = columns
    .map((c, i) => (c.flex ? 'minmax(0,1fr)' : `${widths[i]}rem`))
    .join(' ')

  function setWidth(idx: number, rem: number) {
    setWidths((ws) => {
      if (idx < 0 || idx >= ws.length) return ws
      const clamped = Math.max(MIN_REM, Math.min(MAX_REM, rem))
      if (ws[idx] === clamped) return ws
      const next = ws.slice()
      next[idx] = clamped
      return next
    })
  }

  function resetWidths() {
    setWidths(defaults)
  }

  return { columns, widths, gridTemplate, setWidth, resetWidths }
}

/**
 * 列ヘッダーセルの右端に置くドラッグハンドル。
 * 親（ヘッダーセル）に `position: relative` が必要。
 */
export function ColResizeHandle({
  currentRem,
  onResize,
}: {
  currentRem: number
  onResize: (rem: number) => void
}) {
  const startXRef = useRef<number>(0)
  const startRemRef = useRef<number>(currentRem)

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    startXRef.current = e.clientX
    startRemRef.current = currentRem

    const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16

    function onMove(ev: MouseEvent) {
      const deltaPx = ev.clientX - startXRef.current
      const deltaRem = deltaPx / remPx
      onResize(startRemRef.current + deltaRem)
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <div
      onMouseDown={onMouseDown}
      title="ドラッグで列幅を調整"
      className="absolute top-0 -right-0.5 w-1 h-full cursor-col-resize hover:bg-blue-400 active:bg-blue-600 z-10"
    />
  )
}
