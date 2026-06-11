'use client'

/**
 * モバイル下部タブ（Claude Design モックアップ再現 / REQ-0020）
 * 4タブ＋中央の浮き FAB（クイック操作）。FAB は QuickLauncher を開く。
 *
 * タブの中身はシステム設定 `mobile_bottom_nav`（/admin/books で管理者が変更）から
 * layout.tsx が解決して渡す（REQ-0041）。アイコンは NavIcon（絵文字キー→Lucide）。
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sprout } from 'lucide-react'
import { NavIcon } from '@/lib/navIcon'
import type { NavItem } from '@/lib/navItems'

type Props = {
  /** 表示するタブ（4つ。前半2つ=左、後半2つ=右） */
  items: NavItem[]
}

export default function BottomNav({ items }: Props) {
  const pathname = usePathname()
  const openQuick = () => window.dispatchEvent(new CustomEvent('bract:quick-open'))

  const tab = (item: NavItem) => {
    const isActive = item.href === '/dashboard' ? pathname.startsWith('/dashboard') : pathname.startsWith(item.href)
    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch={true}
        className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors min-w-0 ${isActive ? 'text-blue-600' : 'text-zinc-500'}`}
      >
        <NavIcon icon={item.icon} className="w-6 h-6" />
        <span className="text-[10px] font-medium truncate max-w-full px-0.5">{item.label}</span>
      </Link>
    )
  }

  const left  = items.slice(0, 2)
  const right = items.slice(2, 4)

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-zinc-200 flex items-stretch z-30 safe-area-pb">
      {left.map(tab)}
      {/* 中央 FAB（クイック操作。Bract/Foliage の植物コンセプトに合わせ Sprout、AIの Sparkles と区別） */}
      <div className="flex-1 flex items-start justify-center">
        <button onClick={openQuick} aria-label="クイック操作" className="ds-fab -mt-5">
          <Sprout className="w-6 h-6" strokeWidth={2.25} aria-hidden />
        </button>
      </div>
      {right.map(tab)}
    </nav>
  )
}
