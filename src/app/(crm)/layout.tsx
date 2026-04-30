import Sidebar from '@/components/Sidebar'
import MobileNav from '@/components/MobileNav'
import BottomNav from '@/components/BottomNav'

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-50">
      {/* PC: サイドバー */}
      <Sidebar />

      {/* モバイル: ヘッダー＋ドロワー */}
      <MobileNav />

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0 pb-16 md:pb-0">
        {children}
      </main>

      {/* モバイル: ボトムナビ */}
      <BottomNav />
    </div>
  )
}
