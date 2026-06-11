'use server'


import { db } from '@/lib/db'
import { trashRecord } from '@/lib/trash'
import { accounts } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { logChanges } from '@/lib/changeLog'
import { cleanupRelatedRecordsForParent } from '@/lib/relatedRecords'
import { requirePermission } from '@/lib/permissions'

export async function updateAccountStatus(id: string, status: string) {
  await requirePermission('accounts', 'update')
  const [before] = await db.select({ status: accounts.status })
    .from(accounts).where(eq(accounts.id, id))

  await db.update(accounts)
    .set({ status, updated_at: new Date() })
    .where(eq(accounts.id, id))

  await logChanges('account', id,
    { status: { label: 'ステータス', value: before?.status } },
    { status: { label: 'ステータス', value: status } },
  )
  revalidatePath(`/accounts/${id}`)
}

export async function createAccount(formData: FormData): Promise<string> {
  await requirePermission('accounts', 'create')
  const name = formData.get('name') as string
  if (!name?.trim()) throw new Error('会社名は必須です')

  const annual_revenue = formData.get('annual_revenue') as string
  const employee_count = formData.get('employee_count') as string

  const [row] = await db.insert(accounts).values({
    name:           name.trim(),
    type:           (formData.get('type') as string) || null,
    industry:       (formData.get('industry') as string) || null,
    phone:          (formData.get('phone') as string) || null,
    website:        (formData.get('website') as string) || null,
    address:        (formData.get('address') as string) || null,
    annual_revenue: annual_revenue ? String(Number(annual_revenue)) : null,
    employee_count: employee_count ? Number(employee_count) : null,
    description:    (formData.get('description') as string) || null,
    status:         (formData.get('status') as string) || 'active',
    owner_id:       (formData.get('owner_id') as string) || null,
  }).returning({ id: accounts.id })

  return row.id
}

export async function updateAccount(id: string, formData: FormData) {
  await requirePermission('accounts', 'update')
  const name = formData.get('name') as string
  if (!name?.trim()) throw new Error('会社名は必須です')

  const annual_revenue = formData.get('annual_revenue') as string
  const employee_count = formData.get('employee_count') as string
  const status         = (formData.get('status') as string) || 'active'
  const type           = (formData.get('type') as string) || null

  const [before] = await db.select({
    name: accounts.name, status: accounts.status, type: accounts.type,
    industry: accounts.industry, annual_revenue: accounts.annual_revenue,
    employee_count: accounts.employee_count,
  }).from(accounts).where(eq(accounts.id, id))

  await db.update(accounts).set({
    name:           name.trim(),
    type,
    industry:       (formData.get('industry') as string) || null,
    phone:          (formData.get('phone') as string) || null,
    website:        (formData.get('website') as string) || null,
    address:        (formData.get('address') as string) || null,
    annual_revenue: annual_revenue ? String(Number(annual_revenue)) : null,
    employee_count: employee_count ? Number(employee_count) : null,
    description:    (formData.get('description') as string) || null,
    status,
    owner_id:       (formData.get('owner_id') as string) || null,
    updated_at:     new Date(),
  }).where(eq(accounts.id, id))

  if (before) {
    await logChanges('account', id,
      {
        name:           { label: '会社名',     value: before.name },
        status:         { label: 'ステータス', value: before.status },
        type:           { label: '種別',       value: before.type },
        industry:       { label: '業種',       value: before.industry },
        annual_revenue: { label: '年間売上',   value: before.annual_revenue },
        employee_count: { label: '従業員数',   value: before.employee_count },
      },
      {
        name:           { label: '会社名',     value: name.trim() },
        status:         { label: 'ステータス', value: status },
        type:           { label: '種別',       value: type },
        industry:       { label: '業種',       value: (formData.get('industry') as string) || null },
        annual_revenue: { label: '年間売上',   value: annual_revenue ? Number(annual_revenue) : null },
        employee_count: { label: '従業員数',   value: employee_count ? Number(employee_count) : null },
      },
    )
  }

  redirect(`/accounts/${id}`)
}

/** 連絡先のみ部分更新（右レールのインライン編集用） */
export async function updateAccountContact(id: string, formData: FormData) {
  await requirePermission('accounts', 'update')
  await db.update(accounts).set({
    phone:      (formData.get('phone') as string) || null,
    website:    (formData.get('website') as string) || null,
    address:    (formData.get('address') as string) || null,
    updated_at: new Date(),
  }).where(eq(accounts.id, id))
  redirect(`/accounts/${id}`)
}

export async function deleteAccount(id: string) {
  await requirePermission('accounts', 'delete')
  await trashRecord('accounts', id)  // 実削除の前にゴミ箱へ退避（REQ-0047）
  // Phase 2: FK 列削除に伴い、DB 側 ON DELETE CASCADE が無くなる。
  // 関連活動・ToDo・経費の junction 行を明示削除する（活動・ToDo・経費の
  // 本体は他の関連先があれば残存する新仕様）。
  await cleanupRelatedRecordsForParent('account', id)
  await db.delete(accounts).where(eq(accounts.id, id))
  redirect('/accounts')
}
