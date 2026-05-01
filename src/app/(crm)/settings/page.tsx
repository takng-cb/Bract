import PasswordForm from '@/components/PasswordForm'
import NavOrderEditor from '@/components/NavOrderEditor'
import { getNavOrderSettings } from '@/app/actions/navSettings'

export default async function SettingsPage() {
  const { userOrder, systemOrder } = await getNavOrderSettings()

  return (
    <div className="p-4 md:p-8 max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">ユーザー設定</h1>

      {/* ナビゲーション順序 */}
      <NavOrderEditor userOrder={userOrder} systemOrder={systemOrder} />

      {/* パスワード変更 */}
      <PasswordForm />
    </div>
  )
}
