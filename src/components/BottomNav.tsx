'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Building2, Users, SquareCheckBig, CalendarClock } from 'lucide-react'

const tabs = [
  { href: '/dashboard',  label: 'ホーム', Icon: LayoutDashboard },
  { href: '/accounts',   label: '取引先', Icon: Building2 },
  { href: '/contacts',   label: '人物',   Icon: Users },
  { href: '/tasks',      label: 'ToDo',   Icon: SquareCheckBig },
  { href: '/activities', label: '活動',   Icon: CalendarClock },
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
            prefetch={true}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
              isActive ? 'text-blue-600' : 'text-zinc-500'
            }`}
          >
            <item.Icon className="w-6 h-6" strokeWidth={2.25} aria-hidden />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
