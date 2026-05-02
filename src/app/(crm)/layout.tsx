import Sidebar from '@/components/Sidebar'
import MobileNav from '@/components/MobileNav'
import BottomNav from '@/components/BottomNav'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import { getEffectiveNavOrder } from '@/app/actions/navSettings'
import { applyNavOrder } from '@/lib/navItems'
import { getSystemSetting } from '@/lib/systemSettings'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { user_preferences } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const [order, companyName, supabase, cookieStore] = await Promise.all([
    getEffectiveNavOrder(),
    getSystemSetting('company_name'),
    createSupabaseServerClient(),
    cookies(),
  ])

  const mainItems = applyNavOrder(order)

  // ログインユーザーの表示名を取得
  const { data: { user } } = await supabase.auth.getUser()
  let displayName: string | null = null
  if (user) {
    const pref = await db.select({ display_name: user_preferences.display_name })
      .from(user_preferences)
      .where(eq(user_preferences.user_id, user.id))
      .then((r) => r[0] ?? null)
    displayName = pref?.display_name ?? user.email ?? null
  }

  // なりすまし中かどうか確認
  const adminSessionRaw = cookieStore.get('crm_admin_session')?.value
  const impersonation   = adminSessionRaw
    ? (() => {
        try {
          const { adminEmail } = JSON.parse(adminSessionRaw) as { adminEmail: string }
          return { adminEmail, targetEmail: user?.email ?? '' }
        } catch { return null }
      })()
    : null

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <Sidebar mainItems={mainItems} companyName={companyName} displayName={displayName} />
      <MobileNav mainItems={mainItems} companyName={companyName} />
      <main className={`flex-1 overflow-auto pt-14 md:pt-0 ${impersonation ? 'pb-16' : 'pb-16 md:pb-0'}`}>
        {children}
      </main>
      <BottomNav />
      {impersonation && (
        <ImpersonationBanner
          adminEmail={impersonation.adminEmail}
          targetEmail={impersonation.targetEmail}
        />
      )}
    </div>
  )
}
