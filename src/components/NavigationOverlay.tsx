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
 *   - pathname 変化後、<main> の DOM ミューテーションが SETTLE_MS 止まったら消える
 *     （loading.tsx Suspense fallback → 実コンテンツ paint まで spinner を持続）
 *   - mutation が全く来なければ SETTLE_MS 経過で消える（即着替えケース）
 *   - 4 秒の hard cap で必ず消える（無限スピナー防止）
 *   - pointer-events-none で表示中もユーザー操作を阻害しない
 *   - 修飾キー押下 / 外部リンク / 同一 URL / target=_blank は無視（NavigationProgress と同じロジック）
 *
 * Phase A+ perceived performance 改善 (#40 Sprint 3+)。
 */
import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/** mutation が SETTLE_MS 間無ければ「実コンテンツ paint 完了」とみなす */
const SETTLE_MS = 200

/** 念のための上限。これを超えたら強制的に spinner を消す */
const HARD_CAP_MS = 4000

/** <main> が見つからなかった時のフォールバック表示時間 */
const FALLBACK_MS = 700

export default function NavigationOverlay() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // 検索文字列を 1 つの key にまとめて effect の依存にする
  const searchKey = searchParams?.toString() ?? ''
  const [visible, setVisible] = useState(false)
  const navigatingRef = useRef(false)
  const obsRef = useRef<MutationObserver | null>(null)
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hardCapRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

      // 前回 navigation の hide 処理が動いていれば全部キャンセル
      if (obsRef.current) { obsRef.current.disconnect(); obsRef.current = null }
      if (settleTimerRef.current) { clearTimeout(settleTimerRef.current); settleTimerRef.current = null }
      if (hardCapRef.current) { clearTimeout(hardCapRef.current); hardCapRef.current = null }

      navigatingRef.current = true
      setVisible(true)

      // 防御線: pathname / searchParams が一度も変わらない（=React の effect が
      // 走らない）異常ケースに備え、click 時点でも hard cap を仕掛けておく。
      // この timer は通常 useEffect 側で先にクリアされる。
      hardCapRef.current = setTimeout(() => {
        setVisible(false)
        navigatingRef.current = false
      }, HARD_CAP_MS)
    }
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [])

  // 2. pathname or searchParams 変化 = navigation 完了の最初のシグナル
  //    実コンテンツ paint まで MutationObserver で待つ
  //    同一 pathname で ?tab=foo&sub=bar だけ変わるケース（タブ切替）も
  //    必ず spinner を消すため、searchParams も依存に含める。
  useEffect(() => {
    if (!navigatingRef.current) return

    const settle = () => {
      setVisible(false)
      navigatingRef.current = false
      if (obsRef.current) { obsRef.current.disconnect(); obsRef.current = null }
      if (settleTimerRef.current) { clearTimeout(settleTimerRef.current); settleTimerRef.current = null }
      if (hardCapRef.current) { clearTimeout(hardCapRef.current); hardCapRef.current = null }
    }

    const main = document.querySelector('main')
    if (!main) {
      // <main> が見つからない場合は単純な timer フォールバック
      settleTimerRef.current = setTimeout(settle, FALLBACK_MS)
      return () => {
        if (settleTimerRef.current) { clearTimeout(settleTimerRef.current); settleTimerRef.current = null }
      }
    }

    // 初期 settle timer（mutation が一度も来なくても消えるように）
    settleTimerRef.current = setTimeout(settle, SETTLE_MS)

    // <main> 配下の子要素変化を監視。mutation が来たら settle timer をリセット。
    // loading.tsx skeleton → 実コンテンツの差し替えも含めて待つ。
    const obs = new MutationObserver(() => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current)
      settleTimerRef.current = setTimeout(settle, SETTLE_MS)
    })
    obs.observe(main, { childList: true, subtree: true })
    obsRef.current = obs

    // 念のための hard cap
    hardCapRef.current = setTimeout(settle, HARD_CAP_MS)

    return () => {
      if (obsRef.current) { obsRef.current.disconnect(); obsRef.current = null }
      if (settleTimerRef.current) { clearTimeout(settleTimerRef.current); settleTimerRef.current = null }
      if (hardCapRef.current) { clearTimeout(hardCapRef.current); hardCapRef.current = null }
    }
  // searchKey は string なので primitive で比較されて安定
  }, [pathname, searchKey])

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
