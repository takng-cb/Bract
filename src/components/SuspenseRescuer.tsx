'use client'

/**
 * Suspense ストリーミングが完了しないケースの防御的 rescue — Issue #20
 *
 * 症状（本番のみ）:
 *   - loading.tsx を持つ list ページで Suspense fallback (skeleton) が
 *     表示され続け、実コンテンツが見えない
 *   - SSR は完了しており <div hidden id="S:N"> に実コンテンツが入っている
 *   - <template id="B:N"> がそのまま残っており、React 19 streaming SSR の
 *     completeBoundary ($RC 関数) が呼ばれていない
 *   - コンソールエラー無し、ネットワーク全 200、SW 起因ではない
 *
 * 想定される原因（不確定）:
 *   - 何らかの理由で $RC を呼び出す inline script が実行されない
 *   - Vercel エッジ / Cloudflare / プロキシでのバッファリングでスクリプト
 *     チャンクが届かない
 *   - React 19 streaming SSR と App Router の組み合わせのエッジケース
 *
 * このコンポーネントは hydration 完了後に DOM を polling し、
 * <div id="S:N"> と <template id="B:N"> の組が残っていれば
 * React の $RC と同等の swap を手動で実行する。
 *
 * 動作:
 *   - mount から HYDRATION_DEADLINE_MS 経過しても未 swap な boundary があれば実行
 *   - 1 回 swap して終了（無限ループ防止）
 *   - 通常時は何もしない（no-op）
 *
 * 既存の $RC が走っている場合は <template id="B:N"> と <div id="S:N"> は
 * 既に DOM から除去済みなので、本コンポーネントは何も検出せず終了する。
 */
import { useEffect } from 'react'

/** React 19 streaming SSR が完了するまでの想定上限。これを超えても残っていれば rescue */
const HYDRATION_DEADLINE_MS = 1500

/** ポーリング間隔 */
const POLL_INTERVAL_MS = 250

/**
 * 残っている Suspense boundary を手動で完了させる。
 * React の completeBoundary ($RC) 実装と等価な処理:
 *   1. <template id="B:N"> の前に <div id="S:N"> の子要素を挿入
 *   2. <template id="B:N"> と <div id="S:N"> を DOM から削除
 *   3. animate-pulse 付きの skeleton 要素も除去
 *
 * @returns 救済した boundary 数
 */
function rescuePendingBoundaries(): number {
  let rescued = 0
  const templates = Array.from(document.querySelectorAll<HTMLTemplateElement>('template[id^="B:"]'))
  for (const tmpl of templates) {
    const id = tmpl.id  // 例: "B:0"
    const num = id.slice(2)
    const source = document.getElementById(`S:${num}`)
    if (!source || !tmpl.parentNode) continue

    // S:N の子要素を B:N の直前に移動
    while (source.firstChild) {
      tmpl.parentNode.insertBefore(source.firstChild, tmpl)
    }
    // template と source を除去
    tmpl.remove()
    source.remove()
    rescued++
  }

  // skeleton（animate-pulse の root）が <main> 配下に残っていれば除去
  // 既存コードでは `<div class="p-4 md:p-8 animate-pulse">` のような形
  if (rescued > 0) {
    const skeletons = document.querySelectorAll('main .animate-pulse')
    for (const sk of skeletons) {
      // skeleton 直下に実コンテンツが描画されたかチェック（兄弟に同 class なし要素があれば skeleton と判断）
      const siblings = sk.parentElement
        ? Array.from(sk.parentElement.children).filter((el) => el !== sk)
        : []
      if (siblings.length > 0) sk.remove()
    }
  }

  return rescued
}

export default function SuspenseRescuer() {
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let pollTimer: ReturnType<typeof setInterval> | null = null

    // DEADLINE 経過後に 1 度だけ rescue を試みる
    timer = setTimeout(() => {
      if (cancelled) return
      const rescued = rescuePendingBoundaries()
      if (rescued > 0) {
        // 計測用に console.warn を残す（ユーザーには見えるが Error ではないので
        // 警告ベルや破損表示は出ない）。Sentry / LogRocket 等で観測可能。
        console.warn(`[SuspenseRescuer] ${rescued} stuck Suspense boundar${rescued === 1 ? 'y' : 'ies'} rescued (Issue #20 defensive fallback)`)
      }

      // それでも残っているなら短い間隔で再試行（streaming chunk が遅延到達した場合）
      pollTimer = setInterval(() => {
        if (cancelled) {
          if (pollTimer) clearInterval(pollTimer)
          return
        }
        const remaining = document.querySelectorAll('template[id^="B:"]').length
        if (remaining === 0) {
          if (pollTimer) clearInterval(pollTimer)
          return
        }
        const r = rescuePendingBoundaries()
        if (r > 0) {
          console.warn(`[SuspenseRescuer] ${r} late-arrival Suspense boundar${r === 1 ? 'y' : 'ies'} rescued`)
        }
      }, POLL_INTERVAL_MS)

      // 過度なポーリング防止: HYDRATION_DEADLINE_MS の 6 倍で完全停止
      setTimeout(() => {
        if (pollTimer) clearInterval(pollTimer)
      }, HYDRATION_DEADLINE_MS * 5)
    }, HYDRATION_DEADLINE_MS)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [])

  return null
}
