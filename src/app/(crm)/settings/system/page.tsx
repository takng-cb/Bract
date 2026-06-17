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
import { db } from '@/lib/db'
import { roles } from '@/lib/schema'
import { isAdminUser } from '@/lib/userRole'
import { isProvider } from '@/lib/auth'
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

  const [userList, roleRows, aiEnabled, providerFlag] = await Promise.all([
    listUsers(),
    db.select({ id: roles.id, name: roles.name, is_system: roles.is_system }).from(roles),
    isAIFeatureEnabled(),
    isProvider(),
  ])

  // permissions.ts と同じ解決順（role_id 優先 → role テキスト）で実効ロールを表示する（#144）。
  // assignUserRole はカスタムロール割当時 users.role を editor/viewer に近似するため、
  // テキストだけだとカスタムロール名（例「外部閲覧者」）が出ない。role_id から実名を解決する。
  const rolesById = new Map(roleRows.map((r) => [r.id, r]))
  const SYS_LABEL: Record<string, string> = { admin: '管理者', editor: '編集者', viewer: '閲覧者' }
  const usersWithRole = userList.map((u) => {
    const byId = u.role_id ? rolesById.get(u.role_id) : null
    if (byId && !byId.is_system) {
      return { id: u.id, email: u.email, created_at: u.created_at, roleLabel: byId.name, roleTone: 'custom' as const }
    }
    const sysName = byId?.name ?? u.role
    const tone = (['admin', 'editor', 'viewer'] as const).find((t) => t === sysName) ?? 'viewer'
    return { id: u.id, email: u.email, created_at: u.created_at, roleLabel: SYS_LABEL[tone], roleTone: tone }
  })
  const visibleLinks = ADMIN_LINKS.filter((l) => !l.aiGated || aiEnabled)
  const tenantLinks   = visibleLinks.filter((l) => !l.provider)
  // コンテナ（契約・プラン）設定は運営者にのみ表示（REQ-0046）
  const providerLinks = providerFlag ? visibleLinks.filter((l) => l.provider) : []

  const linkCard = (l: (typeof visibleLinks)[number]) => (
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
  )

  return (
    <div className="mx-auto max-w-lg p-4 md:p-8 space-y-6">
      <PageHeader
        icon="🛠️"
        title="システム設定"
        description="テナント全体の設定・管理（管理者のみ）"
      />

      {/* テナントの管理（このシステムの管理者が日常的に使う設定） */}
      <div className="bg-white border border-zinc-200 rounded-xl shadow-xs p-6">
        <h3 className="text-sm font-bold text-zinc-700 mb-1">テナントの管理</h3>
        <p className="text-xs text-zinc-400 mb-4">このシステムの管理者が行う日常の設定・管理です。</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {tenantLinks.map(linkCard)}
        </div>
      </div>

      {/* ユーザー管理（追加・ロール変更・代理ログイン。パスワード再発行/削除は「ユーザー管理」画面へ） */}
      <UserManagement users={usersWithRole} currentUserId={user?.id ?? ''} />

      {/* サービス提供者（運営）向け：契約・プラン・利用上限 */}
      {providerLinks.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-xl shadow-xs p-6">
          <h3 className="text-sm font-bold text-amber-800 mb-1">サービス提供者（運営）向け</h3>
          <p className="text-xs text-amber-700/80 mb-4">
            契約・プラン・利用上限の設定です。通常はサービス提供者が変更します。テナント側での変更は推奨しません。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {providerLinks.map(linkCard)}
          </div>
        </div>
      )}
    </div>
  )
}
