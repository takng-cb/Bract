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
 *   - usePathname() 変化を navigation 完了とみなし、即時消える
 *   - pointer-events-none で表示中もユーザー操作を阻害しない
 *   - 修飾キー押下 / 外部リンク / 同一 URL / target=_blank は無視（NavigationProgress と同じロジック）
 *
 * 注: 以前は 200ms 遅延後に表示していたが、Phase A+ Sprint 3+ で「常時表示」に変更。
 * 瞬間的なナビでも一瞬チラつくが、必ずフィードバックが出る方をユーザーが希望したため。
 *
 * Phase A+ perceived performance 改善 (#40 Sprint 3+)。
 */
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function NavigationOverlay() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const navigatingRef = useRef(false)

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
      navigatingRef.current = true
      setVisible(true)
    }
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [])

  // 2. pathname 変化 = navigation 完了
  useEffect(() => {
    if (!navigatingRef.current) return
    setVisible(false)
    navigatingRef.current = false
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
