import { redirect } from 'next/navigation'

/**
 * /admin/modules — ブック/モジュール管理（/admin/books）へ統合済み（#21）。
 * 旧 URL 互換のためリダイレクトのみ残す。
 */
export default function ModulesAdminPage() {
  redirect('/admin/books')
}
