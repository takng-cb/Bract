'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/dashboard',     label: 'ホーム',  icon: '🏠' },
  { href: '/accounts',      label: '取引先',  icon: '🏢' },
  { href: '/contacts',      label: '人物',    icon: '👤' },
  { href: '/tasks',         label: 'ToDo',    icon: '✅' },
  { href: '/activities',    label: '活動',    icon: '📋' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-zinc-200 flex items-stretch z-30 safe-area-pb">
      {tabs.map((item) => {
        const isActive = pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
              isActive ? 'text-blue-600' : 'text-zinc-500'
            }`}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
