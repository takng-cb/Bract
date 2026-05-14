import { db } from '@/lib/db'
import { expenses, accounts, contacts, opportunities, custom_records, object_definitions, expense_related_records } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import RecordId from '@/components/RecordId'
import { revalidatePath } from 'next/cache'
import DeleteButton from '@/components/DeleteButton'
import AuthGuard from '@/components/AuthGuard'
import RecordHeader from '@/components/RecordHeader'
import { resolveRelatedRecords } from '@/lib/relatedRecords'

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

const CATEGORY_COLORS: Record<string, string> = {
  交通費:  'bg-blue-50 text-blue-700 border-blue-200',
  接待費:  'bg-purple-50 text-purple-700 border-purple-200',
  通信費:  'bg-cyan-50 text-cyan-700 border-cyan-200',
  消耗品費: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  広告費:  'bg-orange-50 text-orange-700 border-orange-200',
  外注費:  'bg-red-50 text-red-700 border-red-200',
  その他:  'bg-zinc-100 text-zinc-600 border-zinc-200',
}

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [expense, relatedPairs] = await Promise.all([
    db.select({
      id: expenses.id, title: expenses.title, amount: expenses.amount,
      category: expenses.category, expense_date: expenses.expense_date,
      notes: expenses.notes, created_at: expenses.created_at,
      custom_record_id: expenses.custom_record_id,
      accounts:      { id: accounts.id, name: accounts.name },
      contacts:      { id: contacts.id, full_name: contacts.full_name },
      opportunities: { id: opportunities.id, name: opportunities.name },
      custom_record: { id: custom_records.id, data: custom_records.data, object_id: custom_records.object_id },
      object_def:    { id: object_definitions.id, api_name: object_definitions.api_name, label: object_definitions.label },
    })
      .from(expenses)
      .leftJoin(accounts, eq(expenses.account_id, accounts.id))
      .leftJoin(contacts, eq(expenses.contact_id, contacts.id))
      .leftJoin(opportunities, eq(expenses.opportunity_id, opportunities.id))
      .leftJoin(custom_records, eq(expenses.custom_record_id, custom_records.id))
      .leftJoin(object_definitions, eq(custom_records.object_id, object_definitions.id))
      .where(eq(expenses.id, id))
      .then((r) => r[0] ?? null),
    db.select({
      object_api: expense_related_records.related_object_api,
      record_id:  expense_related_records.related_record_id,
    })
      .from(expense_related_records)
      .where(eq(expense_related_records.expense_id, id)),
  ])

  if (!expense) notFound()

  const allRelated = await resolveRelatedRecords(relatedPairs)

  const account     = expense.accounts?.id     ? expense.accounts     : null
  const contact     = expense.contacts?.id     ? expense.contacts     : null
  const opportunity = expense.opportunities?.id ? expense.opportunities : null
  const customRecord = expense.custom_record?.id ? expense.custom_record : null
  const objectDef    = expense.object_def?.id    ? expense.object_def    : null
  const customLabel  = customRecord
    ? customRecordTitle(customRecord.data as Record<string, unknown>, objectDef?.label, customRecord.id)
    : null
  const customHref   = customRecord && objectDef
    ? `/objects/${objectDef.api_name}/${customRecord.id}`
    : null
  const catColor    = CATEGORY_COLORS[expense.category] ?? CATEGORY_COLORS['その他']

  async function deleteAction() {
    'use server'
    const row = await db.select({ opportunity_id: expenses.opportunity_id })
      .from(expenses).where(eq(expenses.id, id)).then((r) => r[0] ?? null)
    await db.delete(expenses).where(eq(expenses.id, id))
    revalidatePath('/expenses')
    if (row?.opportunity_id) revalidatePath(`/opportunities/${row.opportunity_id}`)
    redirect('/expenses')
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <RecordHeader
        crumbs={[
          { label: '経費管理', href: '/expenses' },
          { label: expense.title },
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <Link href={`/expenses/${id}/edit`} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors">
                ✏️ 編集
              </Link>
              <DeleteButton action={deleteAction} confirmMessage="この経費を削除しますか？" />
            </div>
          </AuthGuard>
        }
      />

      {/* 関連レコード（junction 経由で全件表示） */}
      <div className="mb-4 bg-zinc-50 border border-zinc-200 rounded-md px-4 py-3">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">関連レコード</p>
        {allRelated.length > 0 ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {allRelated.map((r, i) => (
              <Link key={`${r.href}-${i}`} href={r.href} className="text-sm text-blue-600 hover:underline">
                {r.icon} {r.label}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-400">紐づくレコードなし</p>
        )}
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-md border text-sm font-medium ${catColor}`}>
            {expense.category}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 break-words">{expense.title}</h1>
        <p className="text-2xl font-bold text-blue-600 mt-1">¥{Number(expense.amount).toLocaleString()}</p>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">詳細情報</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-zinc-400 mb-1">日付</dt>
            <dd className="text-sm text-zinc-800">{expense.expense_date}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">カテゴリ</dt>
            <dd className="text-sm text-zinc-800">{expense.category}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">取引先</dt>
            <dd className="text-sm">
              {account
                ? <Link href={`/accounts/${account.id}`} className="text-blue-600 hover:underline">🏢 {account.name}</Link>
                : <span className="text-zinc-400">—</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">人物</dt>
            <dd className="text-sm">
              {contact
                ? <Link href={`/contacts/${contact.id}`} className="text-blue-600 hover:underline">👤 {contact.full_name}</Link>
                : <span className="text-zinc-400">—</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">商談</dt>
            <dd className="text-sm">
              {opportunity
                ? <Link href={`/opportunities/${opportunity.id}`} className="text-blue-600 hover:underline">💼 {opportunity.name}</Link>
                : <span className="text-zinc-400">—</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">{objectDef?.label ?? 'カスタム'}</dt>
            <dd className="text-sm">
              {customRecord && customHref && customLabel
                ? <Link href={customHref} className="text-blue-600 hover:underline">🗂️ {customLabel}</Link>
                : <span className="text-zinc-400">—</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">登録日</dt>
            <dd className="text-sm text-zinc-800">{expense.created_at ? new Date(expense.created_at).toLocaleDateString('ja-JP') : '—'}</dd>
          </div>
        </dl>
        <div className="mt-4 pt-4 border-t border-zinc-100">
          <dt className="text-xs text-zinc-400 mb-1">備考</dt>
          <dd className="text-sm text-zinc-800 whitespace-pre-wrap min-h-[2.5rem]">
            {expense.notes ?? <span className="text-zinc-300">—</span>}
          </dd>
        </div>
      </div>
      <div className="mt-4 text-right">
        <RecordId id={id} />
      </div>
    </div>
  )
}
