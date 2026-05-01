import Sidebar from '@/components/Sidebar'
import MobileNav from '@/components/MobileNav'
import BottomNav from '@/components/BottomNav'
import { getEffectiveNavOrder } from '@/app/actions/navSettings'
import { applyNavOrder } from '@/lib/navItems'

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const order     = await getEffectiveNavOrder()
  const mainItems = applyNavOrder(order)

  return (
    <div className="flex min-h-screen bg-zinc-50">
      {/* PC: サイドバー */}
      <Sidebar mainItems={mainItems} />

      {/* モバイル: ヘッダー＋ドロワー */}
      <MobileNav mainItems={mainItems} />

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0 pb-16 md:pb-0">
        {children}
      </main>

      {/* モバイル: ボトムナビ */}
      <BottomNav />
    </div>
  )
}
