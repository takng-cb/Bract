'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { signOut } from '@/app/actions/auth'

const navItems = [
  { href: '/dashboard',     label: 'ダッシュボード', icon: '🏠' },
  { href: '/accounts',      label: '取引先',        icon: '🏢' },
  { href: '/contacts',      label: '担当者',        icon: '👤' },
  { href: '/opportunities', label: '商談',          icon: '💼' },
  { href: '/forecast',      label: '売上予測',      icon: '📊' },
  { href: '/activities',    label: '活動履歴',      icon: '📋' },
  { href: '/tasks',         label: 'ToDo',          icon: '✅' },
  { href: '/expenses',      label: '経費管理',      icon: '💰' },
  { href: '/tags',          label: 'タグ管理',      icon: '🏷️' },
  { href: '/settings',      label: '設定',          icon: '⚙️' },
  { href: '/about',         label: '使い方',        icon: '💡' },
]

export default function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      {/* モバイルヘッダー */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-zinc-900 text-white flex items-center px-4 z-40 gap-3">
        <button
          onClick={() => setOpen(true)}
          className="p-2 -ml-2 rounded-md hover:bg-zinc-800 shrink-0"
          aria-label="メニューを開く"
        >
          <div className="w-5 space-y-1">
            <span className="block h-0.5 bg-white" />
            <span className="block h-0.5 bg-white" />
            <span className="block h-0.5 bg-white" />
          </div>
        </button>
        <div className="flex items-center gap-2">
          <Image src="/icon.png" alt="Bract" width={20} height={20} unoptimized />
          <span className="font-bold text-sm tracking-wide">Bract CRM</span>
        </div>
      </header>

      {/* オーバーレイ */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* スライドインドロワー */}
      <div
        className={`md:hidden fixed top-0 left-0 h-full w-64 bg-zinc-900 text-white z-50 flex flex-col transform transition-transform duration-250 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2 px-6 py-5 border-b border-zinc-700 shrink-0">
          <Image src="/icon.png" alt="Bract" width={24} height={24} unoptimized />
          <span className="text-lg font-bold tracking-wide">Bract CRM</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="px-3 pb-6 pt-3 border-t border-zinc-800 shrink-0">
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-zinc-400 hover:bg-zinc-800 hover:text-white w-full text-left"
            >
              <span>🚪</span>
              <span>ログアウト</span>
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
