/**
 * /settings/system — システム設定ハブ（管理者のみ）
 *
 * テナント全体の設定・管理画面への入口を集約。個人設定（/settings）とは別メニュー。
 */
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { isAdminUser } from '@/lib/userRole'
import { listUsers } from '@/app/actions/userManagement'
import { isAIFeatureEnabled } from '@/lib/ai/featureFlag'
import { ADMIN_LINKS } from '@/lib/navItems'
import { NavIcon } from '@/lib/navIcon'
import PageHeader from '@/components/ui/PageHeader'
import UserManagement from '@/components/UserManagement'

export default async function SystemSettingsPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminFlag = user ? await isAdminUser(user.id) : false
  if (!adminFlag) redirect('/settings')

  const [userList, aiEnabled] = await Promise.all([listUsers(), isAIFeatureEnabled()])
  const adminLinks = ADMIN_LINKS.filter((l) => !l.aiGated || aiEnabled)

  return (
    <div className="mx-auto max-w-lg p-4 md:p-8 space-y-6">
      <PageHeader
        icon="🛠️"
        title="システム設定"
        description="テナント全体の設定・管理（管理者のみ）"
      />

      {/* 管理画面（各設定の入口） */}
      <div className="bg-white border border-zinc-200 rounded-xl shadow-xs p-6">
        <h3 className="text-sm font-bold text-zinc-700 mb-1">管理画面</h3>
        <p className="text-xs text-zinc-400 mb-4">各設定・管理画面へ移動します。</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {adminLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center justify-between gap-2 px-4 py-3 rounded-lg border border-zinc-200 hover:border-brand-300 hover:bg-brand-50 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600 group-hover:bg-white">
                  <NavIcon icon={l.icon} className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-800 truncate">{l.label}</p>
                  <p className="text-xs text-zinc-400 truncate">{l.desc}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 shrink-0 text-zinc-300 group-hover:text-brand-600" />
            </Link>
          ))}
        </div>
      </div>

      {/* ユーザー管理（追加・ロール変更・代理ログイン。パスワード再発行/削除は「ユーザー管理」画面へ） */}
      <UserManagement users={userList} currentUserId={user?.id ?? ''} />
    </div>
  )
}
