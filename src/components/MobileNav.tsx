'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { Menu, LogOut } from 'lucide-react'
import { signOut } from '@/app/actions/auth'
import { type NavItem, BOTTOM_NAV_ITEMS, SYSTEM_SETTINGS_ITEM } from '@/lib/navItems'
import { NavIcon } from '@/lib/navIcon'

type NavGroup = { id: string; name: string; items: NavItem[] }

type Props = {
  navGroups:     NavGroup[]
  dashboardItem?: NavItem
  companyName:   string
  displayName:   string | null
  isAdmin?:      boolean
  aiEnabled?:    boolean
}

export default function MobileNav({ navGroups, dashboardItem, companyName, displayName, isAdmin = false }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // 個人設定/使い方 ＋（管理者のみ）システム設定を別エントリで
  const bottomItems = isAdmin ? [...BOTTOM_NAV_ITEMS, SYSTEM_SETTINGS_ITEM] : BOTTOM_NAV_ITEMS

  const avatarChar = (displayName?.trim()?.[0] ?? '👤').toUpperCase()

  const renderItem = (item: NavItem) => {
    const isActive = pathname.startsWith(item.href)
    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch={true}
        onClick={() => setOpen(false)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
          isActive ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
        }`}
      >
        <NavIcon icon={item.icon} className="w-[18px] h-[18px] shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    )
  }

  return (
    <>
      {/* モバイル上部バー（ライト・タイトル＋アバター。モックアップ .mtop 準拠） */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-zinc-200 text-zinc-900 flex items-center px-3 z-40 gap-2">
        <button onClick={() => setOpen(true)} className="p-2 -ml-1 rounded-md text-zinc-700 hover:bg-zinc-100 shrink-0" aria-label="メニューを開く">
          <Menu className="w-[22px] h-[22px]" strokeWidth={2.25} />
        </button>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Image src="/icon.png" alt={companyName} width={20} height={20} unoptimized />
          <span className="font-bold text-sm tracking-wide truncate">{companyName}</span>
        </div>
        <span className="grid place-items-center w-8 h-8 rounded-full bg-brand-600 text-white text-sm font-bold shrink-0" style={{ background: 'var(--brand-600)' }} aria-hidden>
          {avatarChar}
        </span>
      </header>

      {/* オーバーレイ */}
      {open && (
        <div data-testid="mobile-drawer-overlay" className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setOpen(false)} />
      )}

      {/* スライドインドロワー（＝モバイルのサイドバー。デスクトップと同じモジュール基準・暗warm） */}
      <div
        className={`md:hidden fixed top-0 left-0 h-full w-64 z-50 flex flex-col transform transition-transform duration-200 ease-in-out ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'var(--side-bg)', color: '#fff' }}
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b shrink-0" style={{ borderColor: 'var(--side-border)' }}>
          <Image src="/icon.png" alt={companyName} width={24} height={24} unoptimized />
          <span className="text-base font-bold tracking-wide truncate">{companyName}</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {dashboardItem && <div className="space-y-0.5">{renderItem(dashboardItem)}</div>}
          {navGroups.map((group) => (
            <div key={group.id} className="mt-3 first:mt-1">
              {group.id !== '__all' && (
                <p className="px-2 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--side-heading)' }}>
                  {group.name}
                </p>
              )}
              <div className="space-y-0.5">{group.items.map(renderItem)}</div>
            </div>
          ))}
          {/* 設定・管理（ボトムナビ項目） */}
          <div className="mt-3 pt-2 border-t" style={{ borderColor: 'var(--side-border)' }}>
            {bottomItems.map(renderItem)}
          </div>
        </nav>

        <div className="px-2 pb-6 pt-3 border-t shrink-0" style={{ borderColor: 'var(--side-border)' }}>
          {displayName && (
            <div className="flex items-center gap-2.5 px-2 py-1.5">
              <span className="grid place-items-center w-7 h-7 rounded-md text-white text-xs font-bold shrink-0" style={{ background: 'var(--brand-600)' }} aria-hidden>{avatarChar}</span>
              <p className="text-xs text-zinc-400 truncate">{displayName}</p>
            </div>
          )}
          <form action={signOut}>
            <button type="submit" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-zinc-400 hover:bg-zinc-800 hover:text-white w-full text-left">
              <LogOut className="w-[18px] h-[18px] shrink-0" strokeWidth={2.25} />
              <span>ログアウト</span>
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
