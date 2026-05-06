'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import SignOutButton from '@/components/SignOutButton'
import { type NavItem, BOTTOM_NAV_ITEMS } from '@/lib/navItems'

/** 管理者のみ表示するボトムナビの href */
const ADMIN_ONLY_HREFS = new Set(['/tags', '/admin/objects', '/admin/relationships', '/admin/users', '/admin/import-logs'])

type Props = {
  mainItems:   NavItem[]
  companyName: string
  displayName: string | null
  isAdmin?:    boolean
}

const ChevronLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
)

const ChevronRight = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
  </svg>
)

export default function Sidebar({ mainItems, companyName, displayName, isAdmin = false }: Props) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed')
    if (saved === 'true') setCollapsed(true)
    setMounted(true)
  }, [])

  const toggle = () => {
    setCollapsed((prev) => {
      localStorage.setItem('sidebar_collapsed', String(!prev))
      return !prev
    })
  }

  // SSR/hydration ちらつき防止：mounted 前は展開状態で描画
  const isCollapsed = mounted && collapsed

  return (
    <aside
      className={`hidden md:flex md:flex-col shrink-0 bg-zinc-900 text-white min-h-screen transition-[width] duration-200 ease-in-out overflow-hidden ${
        isCollapsed ? 'w-14' : 'w-56'
      }`}
    >
      {/* ヘッダー（ロゴ ＋ たたむボタン） */}
      <div className="flex items-center border-b border-zinc-700 h-14 px-2 gap-2">
        {/* ロゴ */}
        <Link
          href="/dashboard"
          title={isCollapsed ? companyName : undefined}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0 flex-1"
        >
          <Image src="/icon.png" alt={companyName} width={24} height={24} className="shrink-0" unoptimized />
          {!isCollapsed && (
            <span className="text-base font-bold tracking-wide truncate">{companyName}</span>
          )}
        </Link>

        {/* たたむ / 展開ボタン */}
        <button
          onClick={toggle}
          title={isCollapsed ? 'メニューを展開' : 'メニューをたたむ'}
          className="shrink-0 flex items-center justify-center w-7 h-7 rounded text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
        >
          {isCollapsed ? <ChevronRight /> : <ChevronLeft />}
        </button>
      </div>

      {/* メインナビゲーション */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {mainItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-2 py-2 rounded-md text-sm font-medium transition-colors ${
                isCollapsed ? 'justify-center' : ''
              } ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <span className="text-base leading-none shrink-0">{item.icon}</span>
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* ボトムナビ */}
      <div className="px-2 pb-3 border-t border-zinc-800 pt-3 space-y-0.5">
        {BOTTOM_NAV_ITEMS.filter((item) => !ADMIN_ONLY_HREFS.has(item.href) || isAdmin).map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-2 py-2 rounded-md text-sm font-medium transition-colors ${
                isCollapsed ? 'justify-center' : ''
              } ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <span className="text-base leading-none shrink-0">{item.icon}</span>
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}

        {/* ユーザー名 */}
        {displayName && (
          <div
            title={isCollapsed ? displayName : undefined}
            className={`flex items-center gap-3 px-2 py-2 ${isCollapsed ? 'justify-center' : ''}`}
          >
            <span className="text-base leading-none shrink-0">👤</span>
            {!isCollapsed && (
              <p className="text-xs text-zinc-500 truncate">{displayName}</p>
            )}
          </div>
        )}

        <SignOutButton collapsed={isCollapsed} />
      </div>
    </aside>
  )
}
