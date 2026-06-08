'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { signOut } from '@/app/actions/auth'
import { type NavItem, BOTTOM_NAV_ITEMS } from '@/lib/navItems'
import { NavIcon } from '@/lib/navIcon'

const ADMIN_ONLY_HREFS = new Set(['/tags', '/admin/modules', '/admin/objects', '/admin/relationships', '/admin/users', '/admin/import-logs', '/admin/audit-log', '/admin/ai', '/admin/license', '/admin/notifications'])
/** AI 機能フラグが false の時に隠す href */
const AI_GATED_HREFS = new Set(['/admin/ai'])

type Props = {
  mainItems:   NavItem[]
  companyName: string
  isAdmin?:    boolean
  /** AI 機能が有効か（追加料金プラン、env AI_FEATURE_ENABLED で制御） */
  aiEnabled?:  boolean
}

export default function MobileNav({ mainItems, companyName, isAdmin = false, aiEnabled = false }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const bottomItems = BOTTOM_NAV_ITEMS
    .filter((item) => !ADMIN_ONLY_HREFS.has(item.href) || isAdmin)
    .filter((item) => !AI_GATED_HREFS.has(item.href) || aiEnabled)
  const allItems = [...mainItems, ...bottomItems]

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
          <Image src="/icon.png" alt={companyName} width={20} height={20} unoptimized />
          <span className="font-bold text-sm tracking-wide">{companyName}</span>
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
          <Image src="/icon.png" alt={companyName} width={24} height={24} unoptimized />
          <span className="text-lg font-bold tracking-wide truncate">{companyName}</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {allItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <NavIcon icon={item.icon} className="w-5 h-5 shrink-0" />
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
