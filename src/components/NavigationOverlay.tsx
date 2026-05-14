'use client'

/**
 * 画面遷移中に中央に表示する「読み込み中…」スピナーカード。
 *
 * NavigationProgress（細いバー）が「クリックは反応した」だけを伝えるのに対し、
 * 本コンポーネントは「今ページ遷移中で、新ページが描画されるまで待ち」という
 * 強い視覚フィードバックを出す。Vercel SSR が完了するまでの 1〜3 秒のラグを
 * 体感的に短く感じさせる。
 *
 * 動作:
 *   - <a> / <Link> クリック直後に即時表示開始（遅延なし）
 *   - usePathname() 変化後 GRACE_MS 経ってから消える
 *     （pathname 変化と実コンテンツ paint の間の白フラッシュを覆い隠す）
 *   - pointer-events-none で表示中もユーザー操作を阻害しない
 *   - 修飾キー押下 / 外部リンク / 同一 URL / target=_blank は無視（NavigationProgress と同じロジック）
 *
 * Phase A+ perceived performance 改善 (#40 Sprint 3+)。
 */
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

/**
 * pathname 変化後 spinner を残す時間（ms）。
 * 0 だと pathname 変化 = spinner 消失だが、新ページの実コンテンツ paint まで
 * 数百 ms ラグがあり、その間白フラッシュが見える。GRACE_MS 滞留させて隠す。
 *
 * 350ms → 700ms に延長 (Sprint 3+ 2nd iteration): 350ms では loading.tsx
 * Suspense fallback が描画される程度で、実コンテンツ paint には届かない
 * ケースが多かったため。長すぎる場合は値を下げる、または MutationObserver
 * ベースの「実コンテンツ検知」に切り替える。
 */
const GRACE_MS = 700

export default function NavigationOverlay() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const navigatingRef = useRef(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 1. <a> / <Link> クリックを document レベルで補足
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
      const target = e.target as Element | null
      const a = target?.closest('a')
      if (!a) return
      const href = a.getAttribute('href')
      if (!href) return
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
      if (a.target === '_blank' || a.hasAttribute('download')) return
      try {
        const url = new URL(a.href, window.location.origin)
        if (url.origin !== window.location.origin) return
        const samePath = url.pathname === window.location.pathname && url.search === window.location.search
        if (samePath) return
      } catch {
        return
      }

      // クリック直後に即時表示（遅延なし）
      // 前回 navigation の hide タイマーが動いていればキャンセル
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
      navigatingRef.current = true
      setVisible(true)
    }
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [])

  // 2. pathname 変化 = navigation 完了。GRACE_MS 滞留させてから消す。
  useEffect(() => {
    if (!navigatingRef.current) return
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      setVisible(false)
      navigatingRef.current = false
      hideTimerRef.current = null
    }, GRACE_MS)
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
    }
  }, [pathname])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-white/40 backdrop-blur-[2px] pointer-events-none"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="bg-white rounded-lg shadow-xl border border-zinc-200 px-5 py-4 flex items-center gap-3">
        {/* スピナー */}
        <div
          className="w-6 h-6 rounded-full border-[3px] border-zinc-200 border-t-blue-500 animate-spin"
          aria-hidden="true"
        />
        <span className="text-sm font-medium text-zinc-700">読み込み中…</span>
      </div>
    </div>
  )
}
