'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import SignOutButton from '@/components/SignOutButton'
import { type NavItem, BOTTOM_NAV_ITEMS, SYSTEM_SETTINGS_ITEM } from '@/lib/navItems'
import { NavIcon } from '@/lib/navIcon'

/** モジュール基準ナビのグループ（#22 / REQ-0015） */
type NavGroup = { id: string; name: string; items: NavItem[] }

type Props = {
  navGroups:     NavGroup[]
  dashboardItem?: NavItem
  companyName:   string
  displayName:   string | null
  isAdmin?:      boolean
  /** AI 機能が有効か（追加料金プラン、env AI_FEATURE_ENABLED で制御） */
  aiEnabled?:    boolean
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

export default function Sidebar({ navGroups, dashboardItem, companyName, displayName, isAdmin = false }: Props) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- localStorage からの初期値復元（クライアント専用・マウント後の1回のみ） */
    const saved = localStorage.getItem('sidebar_collapsed')
    if (saved === 'true') setCollapsed(true)
    const g = localStorage.getItem('sidebar_collapsed_groups')
    if (g) { try { setCollapsedGroups(new Set(JSON.parse(g) as string[])) } catch { /* ignore */ } }
    setMounted(true)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const toggleGroup = (id: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      localStorage.setItem('sidebar_collapsed_groups', JSON.stringify([...next]))
      return next
    })
  }

  const toggle = () => {
    setCollapsed((prev) => {
      localStorage.setItem('sidebar_collapsed', String(!prev))
      return !prev
    })
  }

  // SSR/hydration ちらつき防止：mounted 前は展開状態で描画
  const isCollapsed = mounted && collapsed

  const renderItem = (item: NavItem) => {
    const isActive = pathname.startsWith(item.href)
    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch={true}
        title={isCollapsed ? item.label : undefined}
        className={`flex items-center gap-3 px-2 py-2 rounded-md text-sm font-medium transition-colors ${
          isCollapsed ? 'justify-center' : ''
        } ${
          isActive
            ? 'bg-blue-600 text-white'
            : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
        }`}
      >
        <NavIcon icon={item.icon} className="w-4.5 h-4.5 shrink-0" />
        {!isCollapsed && <span className="truncate">{item.label}</span>}
      </Link>
    )
  }

  // 「設定」(/settings) は厳密一致でアクティブ判定（/settings/system と取り違えないため）
  const settingActive = (href: string) =>
    href === '/settings' ? pathname === '/settings' : pathname.startsWith(href)

  const bottomLink = (item: NavItem, active: boolean) => (
    <Link
      key={item.href}
      href={item.href}
      prefetch={true}
      title={isCollapsed ? item.label : undefined}
      className={`flex items-center gap-3 px-2 py-2 rounded-md text-sm font-medium transition-colors ${
        isCollapsed ? 'justify-center' : ''
      } ${active ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
    >
      <NavIcon icon={item.icon} className="w-4.5 h-4.5 shrink-0" />
      {!isCollapsed && <span className="truncate">{item.label}</span>}
    </Link>
  )

  return (
    <aside
      className={`hidden md:flex md:flex-col shrink-0 bg-zinc-900 text-white sticky top-0 h-screen self-start transition-[width] duration-200 ease-in-out overflow-hidden ${
        isCollapsed ? 'w-14' : 'w-56'
      }`}
    >
      {/* ヘッダー（ロゴ ＋ たたむボタン） */}
      <div className="flex items-center border-b border-zinc-700 h-14 px-2 gap-2">
        <Link
          href="/dashboard"
          prefetch={true}
          title={isCollapsed ? companyName : undefined}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0 flex-1"
        >
          <Image src="/icon.png" alt={companyName} width={24} height={24} className="shrink-0" unoptimized />
          {!isCollapsed && (
            <span className="text-base font-bold tracking-wide truncate">{companyName}</span>
          )}
        </Link>

        <button
          onClick={toggle}
          title={isCollapsed ? 'メニューを展開' : 'メニューをたたむ'}
          className="shrink-0 flex items-center justify-center w-7 h-7 rounded text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
        >
          {isCollapsed ? <ChevronRight /> : <ChevronLeft />}
        </button>
      </div>

      {/* メインナビゲーション（モジュール基準・開閉＋見出しでモジュールDashへ・#22） */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        {dashboardItem && <div className="space-y-0.5">{renderItem(dashboardItem)}</div>}

        {navGroups.map((group) => {
          const isModule = group.id !== '__all' && group.id !== '__other'
          const groupCollapsed = mounted && collapsedGroups.has(group.id)
          const moduleHref = `/modules/${group.id}`
          const headerActive = isModule && pathname === moduleHref
          return (
            <div key={group.id} className="mt-2 first:mt-1">
              {/* 見出し（展開時のみ）：左=モジュールDashへのリンク、右=開閉トグル */}
              {!isCollapsed && group.id !== '__all' && (
                <div className="flex items-center gap-1 px-1 pt-2 pb-1">
                  {isModule ? (
                    <Link
                      href={moduleHref}
                      prefetch={true}
                      className={`flex-1 truncate rounded px-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                        headerActive ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-200'
                      }`}
                      title={`${group.name} のホーム`}
                    >
                      {group.name}
                    </Link>
                  ) : (
                    <span className="flex-1 truncate px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      {group.name}
                    </span>
                  )}
                  <button
                    onClick={() => toggleGroup(group.id)}
                    title={groupCollapsed ? '展開' : '折りたたむ'}
                    className="shrink-0 text-zinc-500 hover:text-white text-xs leading-none w-4 h-4 flex items-center justify-center"
                  >
                    {groupCollapsed ? '▸' : '▾'}
                  </button>
                </div>
              )}
              {isCollapsed && group.id !== '__all' && (
                <div className="my-1 border-t border-zinc-800" />
              )}
              {/* 項目（折りたたみ時は非表示。サイドバー全体が細い時は常に表示=アイコン） */}
              {(!groupCollapsed || isCollapsed) && (
                <div className="space-y-0.5">
                  {group.items.map((item) => renderItem(item))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* ボトムナビ：管理者はシステム設定を別出し、個人設定/使い方はユーザー名メニュー配下 */}
      <div className="px-2 pb-3 border-t border-zinc-800 pt-3 space-y-0.5">
        {/* 管理者のみ：システム設定（別メニュー） */}
        {isAdmin && bottomLink(SYSTEM_SETTINGS_ITEM, pathname.startsWith('/settings/system'))}

        {isCollapsed ? (
          // 細い時：アイコンを直接並べる（展開トグル無し）
          <>
            {BOTTOM_NAV_ITEMS.map((it) => bottomLink(it, settingActive(it.href)))}
            <SignOutButton collapsed={isCollapsed} />
          </>
        ) : (
          // 通常時：ユーザー名をクリックで個人メニュー（設定・使い方・ログアウト）を展開
          <>
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-expanded={userMenuOpen}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors text-zinc-400 hover:bg-zinc-800 hover:text-white"
            >
              <NavIcon icon="👤" className="w-4.5 h-4.5 shrink-0" />
              <span className="flex-1 text-left truncate text-xs">{displayName ?? 'アカウント'}</span>
              <span className="shrink-0 text-xs leading-none">{userMenuOpen ? '▾' : '▸'}</span>
            </button>
            {userMenuOpen && (
              <div className="space-y-0.5">
                {BOTTOM_NAV_ITEMS.map((it) => bottomLink(it, settingActive(it.href)))}
                <SignOutButton collapsed={false} />
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  )
}
