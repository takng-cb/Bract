'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import SignOutButton from '@/components/SignOutButton'

const navItems = [
  { href: '/dashboard',    label: 'ダッシュボード', icon: '🏠' },
  { href: '/accounts',     label: '取引先',        icon: '🏢' },
  { href: '/contacts',     label: '担当者',        icon: '👤' },
  { href: '/opportunities',label: '商談',          icon: '💼' },
  { href: '/forecast',     label: '売上予測',      icon: '📊' },
  { href: '/activities',   label: '活動履歴',      icon: '📋' },
  { href: '/tasks',        label: 'ToDo',          icon: '✅' },
  { href: '/expenses',     label: '経費管理',      icon: '💰' },
]

const bottomItems = [
  { href: '/tags',  label: 'タグ管理', icon: '🏷️' },
  { href: '/about', label: '使い方',   icon: '💡' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 shrink-0 bg-zinc-900 text-white flex flex-col min-h-screen">
      {/* ロゴ */}
      <div className="px-6 py-5 border-b border-zinc-700">
        <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Image src="/icon.png" alt="Bract" width={24} height={24} className="shrink-0" unoptimized />
          <span className="text-lg font-bold tracking-wide">Bract</span>
        </Link>
      </div>

      {/* メインナビゲーション */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
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

      {/* ボトムナビ */}
      <div className="px-3 pb-4 border-t border-zinc-800 pt-3">
        {bottomItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
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
        <SignOutButton />
      </div>
    </aside>
  )
}
