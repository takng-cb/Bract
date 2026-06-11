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
import InlineRelatedRecordsEditor from '@/components/detail/InlineRelatedRecordsEditor'
import { updateExpenseBasic, updateExpenseRelatedRecords } from '@/app/actions/expenses'
import { getRelatedRecordsPickerData } from '@/lib/relatedRecordsPicker'
import { Receipt, Wallet, CalendarDays } from 'lucide-react'
import { RecordColumns, Badge, type BadgeTone } from '@/components/record/RecordUI'
import { requireBookRead } from '@/lib/permissions'

const CATEGORIES = ['交通費', '接待費', '通信費', '消耗品費', '広告費', '外注費', 'その他']
const CATEGORY_TONE: Record<string, BadgeTone> = {
  交通費: 'info', 接待費: 'ai', 通信費: 'info', 消耗品費: 'warn', 広告費: 'warn', 外注費: 'danger', その他: 'neutral',
}

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireBookRead('expenses')  // RBAC: Read 権限ガード（ADR-0023）
  const { id } = await params

  const [expense, relatedPairs] = await Promise.all([
    db.select({
      id: expenses.id, title: expenses.title, amount: expenses.amount,
      category: expenses.category, expense_date: expenses.expense_date,
      notes: expenses.notes, created_at: expenses.created_at,
    }).from(expenses).where(eq(expenses.id, id)).then((r) => r[0] ?? null),
    db.select({ object_api: expense_related_records.related_object_api, record_id: expense_related_records.related_record_id })
      .from(expense_related_records).where(eq(expense_related_records.expense_id, id)),
  ])

  if (!expense) notFound()

  const [allRelated, pickerData] = await Promise.all([
    resolveRelatedRecords(relatedPairs),
    getRelatedRecordsPickerData('expenses'),
  ])
  const editFlag = await canEdit()

  async function saveExpenseInline(formData: FormData) { 'use server'; await updateExpenseBasic(id, formData) }
  async function saveExpenseRelated(formData: FormData) { 'use server'; await updateExpenseRelatedRecords(id, formData) }
  async function deleteAction() {
    'use server'
    await db.delete(expenses).where(eq(expenses.id, id)); revalidatePath('/expenses'); redirect('/expenses')
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <RecordHeader
        crumbs={[{ label: '経費管理', href: '/expenses' }, { label: expense.title }]}
        avatar={<Receipt className="w-6 h-6" strokeWidth={2.25} aria-hidden />}
        title={expense.title}
        badges={<Badge tone={CATEGORY_TONE[expense.category] ?? 'neutral'}>{expense.category}</Badge>}
        meta={[
          { icon: <Wallet className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />, value: <span className="font-bold text-zinc-900">¥{Number(expense.amount).toLocaleString()}</span> },
          ...(expense.expense_date ? [{ icon: <CalendarDays className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />, value: expense.expense_date }] : []),
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <InlineEditButton event="bract:edit-expense" />
              <DeleteButton action={deleteAction} confirmMessage="この経費を削除しますか？" />
            </div>
          </AuthGuard>
        }
      />

      <RecordColumns
        narrow
        left={
          <>
            <EditableInfoCard
              title="経費情報"
              dense
              canEdit={editFlag}

              editEvent="bract:edit-expense"
              action={saveExpenseInline}
              fields={[
                { label: '件名', name: 'title', kind: 'text', value: expense.title, fullWidth: true, view: expense.title ?? '—' },
                { label: '日付', name: 'expense_date', kind: 'date', value: expense.expense_date ? String(expense.expense_date).slice(0, 10) : '', view: expense.expense_date ?? '—' },
                { label: '金額', name: 'amount', kind: 'number', value: expense.amount != null ? String(expense.amount) : '', view: <span className="font-bold text-zinc-900">¥{Number(expense.amount).toLocaleString()}</span> },
                { label: 'カテゴリ', name: 'category', kind: 'select', value: expense.category, options: CATEGORIES.map((c) => ({ value: c, label: c })), view: expense.category },
                { label: '登録日', view: expense.created_at ? new Date(expense.created_at).toLocaleDateString('ja-JP') : '—' },
              ]}
            />

            <InlineRelatedRecordsEditor
              canEdit={editFlag}
              editEvent="bract:edit-expense"
              action={saveExpenseRelated}
              objectTypes={pickerData.objectTypes}
              recordsByObject={pickerData.recordsByObject}
              defaultValue={relatedPairs.map((p) => ({ object_api: p.object_api, record_id: p.record_id }))}
              view={allRelated.length > 0 ? (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {allRelated.map((r, i) => (
                    <Link key={`${r.href}-${i}`} href={r.href} className="text-sm text-brand-700 hover:underline">{r.icon} {r.label}</Link>
                  ))}
                </div>
              ) : <p className="text-sm text-zinc-400">紐づくレコードなし</p>}
            />
          </>
        }
      >
        <EditableInfoCard
          title="備考"
          canEdit={editFlag}

          editEvent="bract:edit-expense"
          action={saveExpenseInline}
          fields={[
            { label: '備考', name: 'notes', kind: 'textarea', value: expense.notes, fullWidth: true, view: expense.notes ? <span className="text-sm leading-[1.85] text-zinc-800">{expense.notes}</span> : <span className="text-zinc-300">備考が記録されていません</span> },
          ]}
        />
        <div className="mt-4 text-right"><RecordId id={id} /></div>
      </RecordColumns>
    </div>
  )
}
