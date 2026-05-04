import { canEdit, isAdmin } from '@/lib/auth'

type Props = {
  /** 'editor' = admin/editor のみ表示, 'admin' = admin のみ表示 */
  minRole?: 'editor' | 'admin'
  children: React.ReactNode
  /** 権限なし時の代替表示（省略時は何も表示しない） */
  fallback?: React.ReactNode
}

/**
 * サーバーコンポーネント。
 * minRole を満たさないユーザーには children を表示しない。
 *
 * 使い方:
 *   <AuthGuard minRole="editor">
 *     <Link href="/accounts/new">新規登録</Link>
 *   </AuthGuard>
 */
export default async function AuthGuard({ minRole = 'editor', children, fallback = null }: Props) {
  const allowed = minRole === 'admin' ? await isAdmin() : await canEdit()
  if (!allowed) return <>{fallback}</>
  return <>{children}</>
}
