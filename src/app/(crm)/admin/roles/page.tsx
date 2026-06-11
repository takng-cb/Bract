/**
 * /admin/roles — ロール管理（RBAC: REQ-0031 / ADR-0023）
 *
 * ロールの作成・削除、ブック×CRUD の権限マトリクス編集、ユーザーへのロール割当。
 * system ロール（admin/editor/viewer）は閲覧のみ（権限固定・削除不可）。
 */
export const dynamic = 'force-dynamic'

import { requireAdmin } from '@/lib/auth'
import { getAllObjectDefs } from '@/lib/objectMetadata'
import { listRolesWithPermissions, assignUserRole } from '@/app/actions/roles'
import { listUsers } from '@/app/actions/userManagement'
import PageHeader from '@/components/ui/PageHeader'
import RoleManager from '@/components/admin/RoleManager'

export default async function AdminRolesPage() {
  await requireAdmin()

  const [rolesList, books, userList] = await Promise.all([
    listRolesWithPermissions(),
    getAllObjectDefs(),
    listUsers(),
  ])

  async function assignAction(userId: string, roleId: string) {
    'use server'
    await assignUserRole(userId, roleId)
  }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8 space-y-8">
      <PageHeader
        icon="🛡️"
        title="ロール管理"
        description="ロールごとに「ブック単位の作成・閲覧・更新・削除」を設定し、ユーザーに割り当てます"
        className="mb-0"
      />

      <RoleManager
        roles={rolesList.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          is_system: r.is_system,
          assignedUsers: r.assignedUsers,
          permissions: r.permissions.map((p) => ({
            book_api: p.book_api,
            can_create: p.can_create,
            can_read: p.can_read,
            can_update: p.can_update,
            can_delete: p.can_delete,
          })),
        }))}
        books={books.map((b) => ({ api: b.api_name, label: b.label_plural }))}
        users={userList.map((u) => ({ id: u.id, email: u.email, role: u.role, role_id: u.role_id ?? null }))}
        assignAction={assignAction}
      />
    </div>
  )
}
