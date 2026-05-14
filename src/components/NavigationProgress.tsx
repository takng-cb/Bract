'use client'

/**
 * ページ遷移時に画面上部に表示する細い進捗バー。
 *
 * 動作:
 *   - <a> / <Link> クリック時に即 表示開始（クリックから 0ms で「動いた」感）
 *   - 90% まで自動アニメ（実際のロード時間にあわせて緩やかに進む）
 *   - usePathname() が変わったタイミングで 100% にして 300ms 後に消える
 *   - クリックされたリンクが同一 URL / 外部リンク / target=_blank の場合は出さない
 *
 * 目的: コードでの実速度改善とは別に「クリック → 何も起きない」体感を消す。
 * Phase A perceived performance 改善 (#40 Sprint 3+)。
 */
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function NavigationProgress() {
  const pathname = usePathname()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const animTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigatingRef = useRef(false)

  // 1. <a> / <Link> クリックを documentレベルで補足
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // 修飾キー押下時はブラウザの新規タブ等を尊重して何もしない
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return

      const target = e.target as Element | null
      const a = target?.closest('a')
      if (!a) return
      const href = a.getAttribute('href')
      if (!href) return

      // hash / mailto / tel 系は遷移しないので無視
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return

      // _blank / download は別タブ・別動作で遷移検知できないので無視
      if (a.target === '_blank' || a.hasAttribute('download')) return

      // 同一 URL（pathname + search が完全一致）は遷移ではないので無視
      try {
        const url = new URL(a.href, window.location.origin)
        if (url.origin !== window.location.origin) return  // 外部リンク
        const samePath = url.pathname === window.location.pathname && url.search === window.location.search
        if (samePath) return
      } catch {
        return
      }

      // 遷移開始 — 即時に小さい進捗から表示
      navigatingRef.current = true
      setVisible(true)
      setProgress(15)
    }
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [])

  // 2. progress 表示中は 90% まで緩やかに自動進行
  useEffect(() => {
    if (!visible) return
    if (animTimerRef.current) clearInterval(animTimerRef.current)
    animTimerRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p
        // 残量に応じて少しずつ進む（指数的に減速）
        const remaining = 90 - p
        return p + Math.max(0.5, remaining * 0.08)
      })
    }, 150)
    return () => {
      if (animTimerRef.current) clearInterval(animTimerRef.current)
    }
  }, [visible])

  // 3. usePathname() の変化を navigation 完了とみなす
  useEffect(() => {
    if (!navigatingRef.current) return
    // 100% まで進めて、300ms 後にバーを消す
    setProgress(100)
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    fadeTimerRef.current = setTimeout(() => {
      setVisible(false)
      setProgress(0)
      navigatingRef.current = false
    }, 300)
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    }
  }, [pathname])

  if (!visible && progress === 0) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] h-0.5 pointer-events-none"
      aria-hidden="true"
    >
      <div
        className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"
        style={{
          width: `${progress}%`,
          opacity: progress >= 100 ? 0 : 1,
          transition: progress >= 100
            ? 'opacity 200ms ease-out 100ms, width 200ms ease-out'
            : 'width 150ms ease-out',
        }}
      />
    </div>
  )
}
