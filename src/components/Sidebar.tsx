'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import SignOutButton from '@/components/SignOutButton'
import { type NavItem, BOTTOM_NAV_ITEMS } from '@/lib/navItems'

type Props = {
  mainItems:   NavItem[]
  companyName: string
  displayName: string | null
}

export default function Sidebar({ mainItems, companyName, displayName }: Props) {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex md:flex-col w-56 shrink-0 bg-zinc-900 text-white min-h-screen">
      {/* ロゴ */}
      <div className="px-6 py-5 border-b border-zinc-700">
        <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Image src="/icon.png" alt={companyName} width={24} height={24} className="shrink-0" unoptimized />
          <span className="text-lg font-bold tracking-wide truncate">{companyName}</span>
        </Link>
      </div>

      {/* メインナビゲーション */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {mainItems.map((item) => {
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

      {/* ボトムナビ（固定） */}
      <div className="px-3 pb-4 border-t border-zinc-800 pt-3">
        {BOTTOM_NAV_ITEMS.map((item) => {
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

        {/* ユーザー名表示 */}
        {displayName && (
          <div className="px-3 py-2 mt-1">
            <p className="text-xs text-zinc-500 truncate" title={displayName}>👤 {displayName}</p>
          </div>
        )}
        <SignOutButton />
      </div>
    </aside>
  )
}
