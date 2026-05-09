import { db } from '@/lib/db'
import { accounts, contacts, opportunities, custom_records, object_definitions } from '@/lib/schema'
import { eq, asc, and } from 'drizzle-orm'
import Link from 'next/link'
import ActivityForm, { type CustomObjectGroup } from '@/components/ActivityForm'
import { createActivity } from '@/app/actions/activities'
import { requireEditor } from '@/lib/auth'

/**
 * カスタムレコードの表示名を導出する。
 * data.name → data.title → "<オブジェクトラベル> #<short id>" の優先順。
 */
function customRecordTitle(
  data: Record<string, unknown> | null | undefined,
  objectLabel: string | null | undefined,
  recordId: string,
): string {
  const d = (data ?? {}) as Record<string, unknown>
  const name = typeof d.name === 'string' ? d.name : null
  const title = typeof d.title === 'string' ? d.title : null
  return name ?? title ?? `${objectLabel ?? 'カスタム'} #${recordId.slice(0, 8)}`
}

export default async function NewActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ account_id?: string; contact_id?: string; opportunity_id?: string; custom_record_id?: string; return_to?: string }>
}) {
  const { account_id, contact_id, opportunity_id, custom_record_id, return_to } = await searchParams

  async function createActivityAction(_: string | null, formData: FormData): Promise<string | null> {
    'use server'
    if (return_to) formData.set('return_to', return_to)
    try { await createActivity(formData); return null }
    catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return (e as Error).message
    }
  }
  await requireEditor()
  // contact_id / opportunity_id から account_id を補完する
  let resolvedAccountId = account_id ?? ''
  if (!resolvedAccountId && contact_id) {
    const row = await db.select({ account_id: contacts.account_id })
      .from(contacts).where(eq(contacts.id, contact_id)).then((r) => r[0] ?? null)
    resolvedAccountId = row?.account_id ?? ''
  }
  if (!resolvedAccountId && opportunity_id) {
    const row = await db.select({ account_id: opportunities.account_id })
      .from(opportunities).where(eq(opportunities.id, opportunity_id)).then((r) => r[0] ?? null)
    resolvedAccountId = row?.account_id ?? ''
  }

  const [accountsList, contactsList, opportunitiesList, customGroups] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    db.select({ id: contacts.id, full_name: contacts.full_name, account_id: contacts.account_id })
      .from(contacts).orderBy(asc(contacts.full_name)),
    db.select({ id: opportunities.id, name: opportunities.name })
      .from(opportunities).orderBy(asc(opportunities.name)),
    // 活動を関連付け可能なカスタムオブジェクトとそのレコード一覧
    (async (): Promise<CustomObjectGroup[]> => {
      const objs = await db.select({
        id: object_definitions.id,
        api_name: object_definitions.api_name,
        label: object_definitions.label,
        label_plural: object_definitions.label_plural,
        icon: object_definitions.icon,
      })
        .from(object_definitions)
        .where(and(eq(object_definitions.is_builtin, false), eq(object_definitions.enable_activities, true)))
        .orderBy(asc(object_definitions.sort_order), asc(object_definitions.label))
      if (objs.length === 0) return []
      const records = await db.select({
        id: custom_records.id,
        object_id: custom_records.object_id,
        data: custom_records.data,
      }).from(custom_records)
      return objs.map((obj) => ({
        object_id: obj.id,
        api_name: obj.api_name,
        label: obj.label,
        label_plural: obj.label_plural,
        icon: obj.icon,
        records: records
          .filter((r) => r.object_id === obj.id)
          .map((r) => ({
            id: r.id,
            label: customRecordTitle(r.data as Record<string, unknown>, obj.label, r.id),
          })),
      }))
    })(),
  ])

  // 既定の custom_record_id が渡されたら、その object_id を解決
  let defaultCustomObjectId = ''
  if (custom_record_id) {
    const row = await db.select({ object_id: custom_records.object_id })
      .from(custom_records).where(eq(custom_records.id, custom_record_id)).then((r) => r[0] ?? null)
    defaultCustomObjectId = row?.object_id ?? ''
  }

  const cancelHref = return_to
    ?? (account_id
    ? `/accounts/${account_id}`
    : contact_id
    ? `/contacts/${contact_id}`
    : opportunity_id
    ? `/opportunities/${opportunity_id}`
    : '/activities')

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/activities" className="hover:text-zinc-600">活動履歴</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">新規作成</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">活動を記録</h1>
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <ActivityForm
          action={createActivityAction}
          cancelHref={cancelHref}
          accounts={accountsList}
          contacts={contactsList}
          opportunities={opportunitiesList}
          customGroups={customGroups}
          defaultValues={{
            account_id: resolvedAccountId,
            contact_ids: contact_id ? [contact_id] : [],
            opportunity_id: opportunity_id ?? '',
            custom_object_id: defaultCustomObjectId,
            custom_record_id: custom_record_id ?? '',
          }}
        />
      </div>
    </div>
  )
}
