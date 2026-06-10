'use client'

/**
 * モバイル下部タブ（Claude Design モックアップ再現 / REQ-0020）
 * 4タブ＋中央の浮き FAB（AI/クイック登録）。FAB は QuickLauncher を開く。
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Building2, SquareCheckBig, CalendarClock, Sprout } from 'lucide-react'

type Tab = { href: string; label: string; Icon: typeof LayoutDashboard }
const LEFT: Tab[] = [
  { href: '/dashboard', label: 'ホーム', Icon: LayoutDashboard },
  { href: '/accounts',  label: '取引先', Icon: Building2 },
]
const RIGHT: Tab[] = [
  { href: '/tasks',      label: 'ToDo', Icon: SquareCheckBig },
  { href: '/activities', label: '活動', Icon: CalendarClock },
]

export default function BottomNav() {
  const pathname = usePathname()
  const openQuick = () => window.dispatchEvent(new CustomEvent('bract:quick-open'))

  const tab = (item: Tab) => {
    const isActive = pathname.startsWith(item.href)
    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch={true}
        className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${isActive ? 'text-blue-600' : 'text-zinc-500'}`}
      >
        <item.Icon className="w-6 h-6" strokeWidth={2.25} aria-hidden />
        <span className="text-[10px] font-medium">{item.label}</span>
      </Link>
    )
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-zinc-200 flex items-stretch z-30 safe-area-pb">
      {LEFT.map(tab)}
      {/* 中央 FAB（クイック操作。Bract/Foliage の植物コンセプトに合わせ Sprout、AIの Sparkles と区別） */}
      <div className="flex-1 flex items-start justify-center">
        <button onClick={openQuick} aria-label="クイック操作" className="ds-fab -mt-5">
          <Sprout className="w-6 h-6" strokeWidth={2.25} aria-hidden />
        </button>
      </div>
      {RIGHT.map(tab)}
    </nav>
  )
}
