/**
 * /assignments/new — 案件 新規作成 (Issue #69 Phase 1)
 *
 * 簡易フォーム。詳細編集は /assignments/[id]/edit で行う。
 */
import { notFound, redirect } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import { requireEditor } from '@/lib/auth'
import { db } from '@/lib/db'
import { accounts } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import Breadcrumbs from '@/components/Breadcrumbs'
import { createAssignment } from '@/industries/staffing/actions/assignments'

export default async function NewAssignmentPage() {
  if (!(await isModuleEnabled('staffing'))) notFound()
  await requireEditor()

  const clientAccounts = await db.select({ id: accounts.id, name: accounts.name })
    .from(accounts)
    .where(eq(accounts.status, 'active'))
    .orderBy(asc(accounts.name))

  async function action(formData: FormData) {
    'use server'
    const id = await createAssignment(formData)
    redirect(`/assignments/${id}`)
  }

  const FIELD_CLS = 'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <Breadcrumbs items={[
        { label: '案件',     href: '/assignments' },
        { label: '新規追加' },
      ]} />
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">案件を新規追加</h1>

      <form action={action} className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs text-zinc-500 mb-1">派遣先（取引先）*</label>
            <select name="client_account_id" required className={`${FIELD_CLS} bg-white`}>
              <option value="">— 選択してください —</option>
              {clientAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1">業務日</label>
            <input type="date" name="service_date" className={FIELD_CLS} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">募集人数</label>
            <input type="number" name="staff_count_required" min="1" className={FIELD_CLS} />
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1">開始時間</label>
            <input type="time" name="service_start_time" className={FIELD_CLS} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">終了時間</label>
            <input type="time" name="service_end_time" className={FIELD_CLS} />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs text-zinc-500 mb-1">業務区分</label>
            <input name="service_type" placeholder="例: 接客 / 介護補助 / レセプション" className={FIELD_CLS} />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs text-zinc-500 mb-1">場所</label>
            <input name="service_location" placeholder="例: 〇〇病院 3階" className={FIELD_CLS} />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs text-zinc-500 mb-1">業務内容</label>
            <textarea name="service_description" rows={3} className={`${FIELD_CLS} resize-y`} />
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1">請求総額（派遣先からの受取）</label>
            <input type="number" name="client_total_fee" min="0" className={FIELD_CLS} />
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1">ステータス</label>
            <select name="status" defaultValue="予約" className={`${FIELD_CLS} bg-white`}>
              <option value="予約">予約</option>
              <option value="確定">確定</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs text-zinc-500 mb-1">内部メモ</label>
            <textarea name="internal_memo" rows={2} className={`${FIELD_CLS} resize-y`} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
          <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700">
            登録
          </button>
        </div>
      </form>
    </div>
  )
}
