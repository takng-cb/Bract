'use client'

import { useEffect, useState } from 'react'

/**
 * Android Chrome が beforeinstallprompt イベントを発火したとき（＝PWAインストール可能な状態）に
 * 画面下部にインストール誘導バナーを表示するコンポーネント。
 *
 * Chrome のエンゲージメント要件（複数回訪問 + 5分以上の間隔）を満たすまでは
 * イベントが発火しないため、その間は何も表示されない。
 */
export default function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // すでに非表示にした場合はセッション中は再表示しない
    if (dismissed) return

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [dismissed])

  useEffect(() => {
    // インストール完了後はバナーを閉じる
    function handleAppInstalled() {
      setDeferredPrompt(null)
    }
    window.addEventListener('appinstalled', handleAppInstalled)
    return () => window.removeEventListener('appinstalled', handleAppInstalled)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  function handleDismiss() {
    setDismissed(true)
    setDeferredPrompt(null)
  }

  if (!deferredPrompt) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 md:bottom-4 md:left-auto md:right-4 md:w-80">
      <div className="bg-white rounded-xl shadow-lg border border-zinc-200 px-4 py-3 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" className="w-10 h-10 rounded-lg shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-900">Bract CRM をインストール</p>
          <p className="text-xs text-zinc-500">ホーム画面から素早くアクセス</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDismiss}
            className="text-xs text-zinc-400 hover:text-zinc-600 px-1"
            aria-label="閉じる"
          >
            ✕
          </button>
          <button
            onClick={handleInstall}
            className="text-xs font-medium bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 active:bg-blue-800 transition-colors"
          >
            インストール
          </button>
        </div>
      </div>
    </div>
  )
}

// TypeScript 型定義（標準 lib に含まれていない場合）
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
