'use client'

/**
 * レコード詳細ページの 3 タブ切替 UI。
 *
 * 用途: accounts/contacts/opportunities/custom 等の詳細ページで、概要・
 * 活動 ToDo 経費・履歴を切り替えて表示する。
 *
 * 設計:
 *   - サーバー側で **全タブの content を一度にレンダー** して props で渡す
 *   - クライアント側で active タブだけ表示、他は CSS hidden
 *   - タブ切替時に window.history.replaceState で URL に `?tab=<id>` を反映
 *     （Next.js の router.push と違ってサーバー再フェッチが起きないので瞬時）
 *   - 直接 URL を開いた場合は初期 active タブをクエリから読む
 *
 * 親コンポーネント例:
 *   <RecordTabs defaultTab="overview" tabs={[
 *     { id: 'overview', label: '概要', content: <OverviewSection /> },
 *     { id: 'interactions', label: '活動・ToDo・経費', badge: 15, content: <Interactions /> },
 *     { id: 'history', label: '履歴', badge: 8, content: <ChangeLogs /> },
 *   ]} />
 *
 * tab が空 (badge=0 など) の場合は親側で配列から除外する想定。本コンポーネントは
 * 受け取った tabs を素直に表示するだけ。
 */
import { useEffect, useRef, useState } from 'react'

export type TabDef = {
  id:       string
  label:    string
  badge?:   number          // 件数バッジ（0 は表示しない）
  content:  React.ReactNode  // タブの中身（サーバー側でレンダー済み）
}

type Props = {
  defaultTab: string
  tabs:       TabDef[]
  /** URL クエリのキー名（既定 'tab'）。複数の RecordTabs を同一ページに置く場合に変更 */
  paramName?: string
}

export default function RecordTabs({ defaultTab, tabs, paramName = 'tab' }: Props) {
  // 初期 active タブ: URL クエリ > defaultTab
  const [active, setActive] = useState<string>(() => {
    if (typeof window === 'undefined') return defaultTab
    const params = new URLSearchParams(window.location.search)
    const t = params.get(paramName)
    return tabs.find((x) => x.id === t)?.id ?? defaultTab
  })

  // クライアントマウント後に URL を読み直して同期（hydration ズレ対策）
  const isMountedRef = useRef(false)
  useEffect(() => {
    if (isMountedRef.current) return
    isMountedRef.current = true
    const params = new URLSearchParams(window.location.search)
    const t = params.get(paramName)
    const found = tabs.find((x) => x.id === t)?.id
    if (found && found !== active) setActive(found)
  }, [active, paramName, tabs])

  function handleClick(id: string) {
    if (id === active) return
    setActive(id)
    // URL に反映（履歴に積まずに置換）
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set(paramName, id)
      window.history.replaceState({}, '', url.toString())
    }
  }

  return (
    <div>
      {/* タブヘッダー */}
      <div className="border-b border-zinc-200 flex gap-1 mb-4 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = active === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleClick(tab.id)}
              className={`shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-zinc-600 hover:text-zinc-900'
              }`}
              aria-current={isActive ? 'true' : 'false'}
            >
              {tab.label}
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
                  isActive ? 'bg-blue-100 text-blue-700' : 'bg-zinc-100 text-zinc-600'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* タブコンテンツ（全部レンダーして visibility 切替） */}
      {tabs.map((tab) => (
        <div key={tab.id} className={active === tab.id ? '' : 'hidden'} aria-hidden={active !== tab.id}>
          {tab.content}
        </div>
      ))}
    </div>
  )
}
