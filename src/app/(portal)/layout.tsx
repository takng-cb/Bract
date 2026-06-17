/**
 * 外部ポータル（/portal）の最小レイアウト（REQ-0084 / ADR-0029・Phase2）。
 * 社内 (crm) のサイドバー等は一切含まない独立シェル。外部ユーザーはここだけを見る。
 * 認証必須（未ログインは /login へ）。
 */
import { redirect } from 'next/navigation'
import { getSupabaseUser } from '@/lib/auth'
import { signOut } from '@/app/actions/auth'
import { ShieldCheck, LogOut } from 'lucide-react'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getSupabaseUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="h-5 w-5 shrink-0 text-brand-600" strokeWidth={2} aria-hidden />
            <span className="font-semibold text-zinc-800">共有ポータル</span>
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <span className="truncate text-xs text-zinc-400">{user.email}</span>
            <form action={signOut}>
              <button type="submit" className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-50">
                <LogOut className="h-3.5 w-3.5" aria-hidden /> ログアウト
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl p-4 md:p-8">{children}</main>
    </div>
  )
}
