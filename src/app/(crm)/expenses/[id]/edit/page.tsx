import { db } from '@/lib/db'
import { expenses, expense_related_records } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import ExpenseForm from '@/components/ExpenseForm'
import Breadcrumbs from '@/components/Breadcrumbs'
import { updateExpense } from '@/app/actions/expenses'
import { requireEditor } from '@/lib/auth'
import { getRelatedRecordsPickerData } from '@/lib/relatedRecordsPicker'
import type { RelatedRecordSelection } from '@/components/RelatedRecordsPicker'
import { requireBookRead } from '@/lib/permissions'

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  await requireBookRead('expenses')  // RBAC: Read 権限ガード（ADR-0023）
  const { id } = await params
  await requireEditor()
  // Picker の選択肢（ブック一覧）。レコード本体はオンデマンド検索（/api/search/records）
  const [expense, pickerData, relatedRows] = await Promise.all([
    db.select().from(expenses).where(eq(expenses.id, id)).then((r) => r[0] ?? null),
    getRelatedRecordsPickerData('expenses'),
    db.select({
      object_api: expense_related_records.related_object_api,
      record_id:  expense_related_records.related_record_id,
    })
      .from(expense_related_records)
      .where(eq(expense_related_records.expense_id, id)),
  ])
  if (!expense) notFound()

  async function updateExpenseAction(_: string | null, formData: FormData): Promise<string | null> {
    'use server'
    try { await updateExpense(id, formData); return null }
    catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return (e as Error).message
    }
  }

  const objectTypes = pickerData.objectTypes

  const defaultRelated: RelatedRecordSelection[] = relatedRows.map((r) => ({
    object_api: r.object_api,
    record_id:  r.record_id,
  }))

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <Breadcrumbs items={[
        { label: '経費管理', href: '/expenses' },
        { label: expense.title, href: `/expenses/${id}` },
        { label: '編集' },
      ]} />
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">経費を編集</h1>
        <ExpenseForm
          action={updateExpenseAction}
          cancelHref={`/expenses/${id}`}
          objectTypes={objectTypes}
          defaultValues={{
            title:        expense.title,
            amount:       expense.amount !== null ? Number(expense.amount) : null,
            category:     expense.category,
            expense_date: expense.expense_date ?? undefined,
            notes:        expense.notes,
            related_records: defaultRelated,
          }}
        />
    </div>
  )
}
