import { db } from '@/lib/db'
import { expenses, expense_related_records } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import RecordId from '@/components/RecordId'
import { revalidatePath } from 'next/cache'
import DeleteButton from '@/components/DeleteButton'
import AuthGuard from '@/components/AuthGuard'
import RecordHeader from '@/components/RecordHeader'
import { resolveRelatedRecords } from '@/lib/relatedRecords'
import { canEdit } from '@/lib/auth'
import EditableInfoCard from '@/components/detail/EditableInfoCard'
import InlineEditButton from '@/components/detail/InlineEditButton'
import { updateExpenseBasic } from '@/app/actions/expenses'

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
    })
      .from(expenses)
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
  const catColor   = CATEGORY_COLORS[expense.category] ?? CATEGORY_COLORS['その他']
  const editFlag   = await canEdit()

  async function saveExpenseInline(formData: FormData) {
    'use server'
    await updateExpenseBasic(id, formData)
  }

  async function deleteAction() {
    'use server'
    await db.delete(expenses).where(eq(expenses.id, id))
    revalidatePath('/expenses')
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
              <InlineEditButton event="bract:edit-expense" />
              <Link href={`/expenses/${id}/edit`} className="px-3 py-1.5 border border-zinc-300 text-zinc-600 text-sm rounded-md hover:bg-zinc-50 transition-colors">関連</Link>
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

      <EditableInfoCard
        title="詳細情報"
        canEdit={editFlag}
        showEditButton={false}
        editEvent="bract:edit-expense"
        action={saveExpenseInline}
        fields={[
          { label: '件名', name: 'title', kind: 'text', value: expense.title, fullWidth: true, view: expense.title ?? '—' },
          { label: '日付', name: 'expense_date', kind: 'date', value: expense.expense_date ? String(expense.expense_date).slice(0, 10) : '', view: expense.expense_date ?? '—' },
          { label: '金額', name: 'amount', kind: 'number', value: expense.amount != null ? String(expense.amount) : '', view: `¥${Number(expense.amount).toLocaleString()}` },
          { label: 'カテゴリ', name: 'category', kind: 'select', value: expense.category, options: Object.keys(CATEGORY_COLORS).map((c) => ({ value: c, label: c })), view: expense.category },
          { label: '登録日', view: expense.created_at ? new Date(expense.created_at).toLocaleDateString('ja-JP') : '—' },
          { label: '備考', name: 'notes', kind: 'textarea', value: expense.notes, fullWidth: true, view: expense.notes ? expense.notes : <span className="text-zinc-300">—</span> },
        ]}
      />
      <div className="mt-4 text-right">
        <RecordId id={id} />
      </div>
    </div>
  )
}
