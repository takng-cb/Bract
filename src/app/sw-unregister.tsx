'use client'

/**
 * 旧 next-pwa の Service Worker をユーザー端末から自動的に unregister するクライアント。
 *
 * 経緯: かつて next-pwa を有効にしており、その SW が Next.js の RSC prefetch
 * (`?_rsc=` 付き fetch) を `pages-rsc-prefetch` キャッシュで横取りすることが判明。
 * 結果として <Link prefetch={true}> の自動 prefetch が一切発火せず、画面遷移が
 * 毎回 2.2 秒以上かかっていた（実測）。
 *
 * 修正:
 *   1. next.config.ts で next-pwa を `disable: true` にし、新規 SW は生成しない
 *   2. 本コンポーネントを root layout に置き、既存 SW を unregister + caches を削除
 *
 * 動作は冪等。何度実行しても安全。SW が既に無ければ no-op。
 */
import { useEffect } from 'react'

export default function SwUnregister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    const cleanup = async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations()
        for (const reg of regs) {
          await reg.unregister()
        }
        if ('caches' in window) {
          const keys = await caches.keys()
          await Promise.all(keys.map((k) => caches.delete(k)))
        }
      } catch {
        // SW unregister はベストエフォート。失敗してもユーザー操作は妨げない。
      }
    }
    cleanup()
  }, [])

  return null
}
