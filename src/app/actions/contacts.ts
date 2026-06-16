'use server'


import { db } from '@/lib/db'
import { trashRecord } from '@/lib/trash'
import { contacts } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { withSaveToast } from '@/lib/saveToast'
import { logChanges } from '@/lib/changeLog'
import { cleanupRelatedRecordsForParent } from '@/lib/relatedRecords'
import { cleanupRecordLinksForParent } from '@/lib/recordLinks'
import { requirePermission } from '@/lib/permissions'
import { assertNotPendingApproval } from '@/app/actions/approvals'

export async function createContact(formData: FormData): Promise<string> {
  await requirePermission('contacts', 'create')
  const full_name    = formData.get('full_name') as string
  const contact_type = (formData.get('contact_type') as string) || 'business'
  if (!full_name?.trim()) throw new Error('氏名は必須です')

  const [row] = await db.insert(contacts).values({
    contact_type,
    full_name:   full_name.trim(),
    email:       (formData.get('email') as string) || null,
    phone:       (formData.get('phone') as string) || null,
    title:       contact_type === 'business' ? ((formData.get('title') as string) || null) : null,
    department:  contact_type === 'business' ? ((formData.get('department') as string) || null) : null,
    birthday:    (formData.get('birthday') as string) || null,
    description: (formData.get('description') as string) || null,
    account_id:  contact_type === 'business' ? ((formData.get('account_id') as string) || null) : null,
    owner_id:    (formData.get('owner_id') as string) || null,
  }).returning({ id: contacts.id })

  return row.id
}

export async function updateContact(id: string, formData: FormData) {
  await requirePermission('contacts', 'update')
  await assertNotPendingApproval('contacts', id)  // 承認待ち中は編集ロック（REQ-0023 / #131）
  const full_name    = formData.get('full_name') as string
  const contact_type = (formData.get('contact_type') as string) || 'business'
  if (!full_name?.trim()) throw new Error('氏名は必須です')

  const [before] = await db.select({
    full_name: contacts.full_name, title: contacts.title,
    department: contacts.department, email: contacts.email, phone: contacts.phone,
  }).from(contacts).where(eq(contacts.id, id))

  await db.update(contacts).set({
    contact_type,
    full_name:   full_name.trim(),
    email:       (formData.get('email') as string) || null,
    phone:       (formData.get('phone') as string) || null,
    title:       contact_type === 'business' ? ((formData.get('title') as string) || null) : null,
    department:  contact_type === 'business' ? ((formData.get('department') as string) || null) : null,
    birthday:    (formData.get('birthday') as string) || null,
    description: (formData.get('description') as string) || null,
    account_id:  contact_type === 'business' ? ((formData.get('account_id') as string) || null) : null,
    owner_id:    (formData.get('owner_id') as string) || null,
    updated_at:  new Date(),
  }).where(eq(contacts.id, id))

  if (before) {
    await logChanges('contact', id,
      {
        full_name:  { label: '氏名',   value: before.full_name },
        title:      { label: '役職',   value: before.title },
        department: { label: '部署',   value: before.department },
        email:      { label: 'メール', value: before.email },
        phone:      { label: '電話',   value: before.phone },
      },
      {
        full_name:  { label: '氏名',   value: full_name.trim() },
        title:      { label: '役職',   value: (formData.get('title') as string) || null },
        department: { label: '部署',   value: (formData.get('department') as string) || null },
        email:      { label: 'メール', value: (formData.get('email') as string) || null },
        phone:      { label: '電話',   value: (formData.get('phone') as string) || null },
      },
    )
  }

  redirect(withSaveToast(`/contacts/${id}`, 'saved'))
}

export async function deleteContact(id: string) {
  await requirePermission('contacts', 'delete')
  await assertNotPendingApproval('contacts', id)  // 承認待ち中は削除も不可（REQ-0023 / #131）
  await trashRecord('contacts', id)  // 実削除の前にゴミ箱へ退避（REQ-0047）
  await cleanupRelatedRecordsForParent('contact', id)
  await cleanupRecordLinksForParent('contact', id)
  await db.delete(contacts).where(eq(contacts.id, id))
  redirect(withSaveToast('/contacts', 'deleted'))
}
