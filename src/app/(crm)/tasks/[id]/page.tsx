import { db } from '@/lib/db'
import { tasks, task_related_records } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import RecordId from '@/components/RecordId'
import { deleteTask, toggleTaskDone, updateTaskBasic, updateTaskRelatedRecords } from '@/app/actions/tasks'
import EditableInfoCard from '@/components/detail/EditableInfoCard'
import InlineEditButton from '@/components/detail/InlineEditButton'
import InlineRelatedRecordsEditor from '@/components/detail/InlineRelatedRecordsEditor'
import { getRelatedRecordsPickerData } from '@/lib/relatedRecordsPicker'
import DeleteButton from '@/components/DeleteButton'
import AuthGuard from '@/components/AuthGuard'
import RecordHeader from '@/components/RecordHeader'
import { getAllUsers } from '@/lib/userUtils'
import { canEdit } from '@/lib/auth'
import { resolveRelatedRecords } from '@/lib/relatedRecords'
import { SquareCheckBig, CalendarClock, UserRound, Check } from 'lucide-react'
import { RecordColumns, Badge, type BadgeTone } from '@/components/record/RecordUI'

const PRIORITY_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  high: { label: '高', tone: 'danger' }, medium: { label: '中', tone: 'warn' }, low: { label: '低', tone: 'pos' },
}

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [task, relatedPairs, allUsers] = await Promise.all([
    db.select({
      id: tasks.id, title: tasks.title, description: tasks.description, done: tasks.done,
      priority: tasks.priority, due_date: tasks.due_date, owner_id: tasks.owner_id, created_at: tasks.created_at,
    }).from(tasks).where(eq(tasks.id, id)).then((r) => r[0] ?? null),
    db.select({ object_api: task_related_records.related_object_api, record_id: task_related_records.related_record_id })
      .from(task_related_records).where(eq(task_related_records.task_id, id)),
    getAllUsers(),
  ])

  if (!task) notFound()
  const ownerName = task.owner_id ? (allUsers.find((u) => u.id === task.owner_id)?.name ?? null) : null

  const [allRelated, pickerData] = await Promise.all([
    resolveRelatedRecords(relatedPairs),
    getRelatedRecordsPickerData('tasks'),
  ])
  const priority = PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.medium
  // eslint-disable-next-line react-hooks/purity
  const NOW = Date.now()
  const overdue = !task.done && task.due_date && new Date(task.due_date).getTime() < NOW

  async function handleDelete() { 'use server'; await deleteTask(id) }
  async function saveTaskInline(formData: FormData) { 'use server'; await updateTaskBasic(id, formData) }
  async function saveTaskRelated(formData: FormData) { 'use server'; await updateTaskRelatedRecords(id, formData) }
  const canEditFlag = await canEdit()
  async function toggleDone(formData: FormData) {
    'use server'
    await toggleTaskDone(id, formData.get('done') === 'true', `/tasks/${id}`)
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <RecordHeader
        crumbs={[{ label: 'ToDo', href: '/tasks' }, { label: task.title }]}
        avatar={<SquareCheckBig className="w-6 h-6" strokeWidth={2.25} aria-hidden />}
        title={task.title}
        badges={<><Badge tone={priority.tone}>優先度 {priority.label}</Badge><Badge tone={task.done ? 'pos' : 'warn'} dot>{task.done ? '完了' : '進行中'}</Badge></>}
        meta={[
          ...(task.due_date ? [{ icon: <CalendarClock className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />, label: '期限', value: <span className={overdue ? 'text-rose-600 font-medium' : ''}>{new Date(task.due_date).toLocaleDateString('ja-JP')}{overdue ? '（超過）' : ''}</span> }] : []),
          ...(ownerName ? [{ icon: <UserRound className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />, label: '担当', value: ownerName }] : []),
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <form action={toggleDone}>
                <input type="hidden" name="done" value={(!task.done).toString()} />
                <button type="submit" className={`inline-flex items-center gap-1.5 h-8 px-3 text-[13px] font-semibold rounded-md border ${task.done ? 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50' : 'bg-brand-600 text-white border-brand-600 hover:bg-brand-700'}`}>
                  <Check className="w-4 h-4" />{task.done ? '未完了に戻す' : '完了にする'}
                </button>
              </form>
              <InlineEditButton event="bract:edit-task" />
              <DeleteButton action={handleDelete} confirmMessage="このToDoを削除しますか？" />
            </div>
          </AuthGuard>
        }
      />

      <RecordColumns
        narrow
        left={
          <>
            <EditableInfoCard
              title="ToDo情報"
              dense
              canEdit={canEditFlag}
              showEditButton={false}
              editEvent="bract:edit-task"
              action={saveTaskInline}
              fields={[
                { label: 'タイトル', name: 'title', kind: 'text', value: task.title, fullWidth: true, view: task.title ?? '—' },
                { label: '期限', name: 'due_date', kind: 'date', value: task.due_date ? String(task.due_date).slice(0, 10) : '', view: task.due_date ? <span className={overdue ? 'text-rose-600 font-medium' : ''}>{new Date(task.due_date).toLocaleDateString('ja-JP')}{overdue && ' (超過)'}</span> : '—' },
                { label: '優先度', name: 'priority', kind: 'select', value: task.priority, options: [{ value: 'high', label: '高' }, { value: 'medium', label: '中' }, { value: 'low', label: '低' }], view: priority.label },
                { label: '担当', name: 'owner_id', kind: 'select', value: task.owner_id ?? '', options: allUsers.map((u) => ({ value: u.id, label: u.name })), view: ownerName ?? '—' },
                { label: '登録日', view: task.created_at ? new Date(task.created_at).toLocaleDateString('ja-JP') : '—' },
              ]}
            />

            <InlineRelatedRecordsEditor
              canEdit={canEditFlag}
              editEvent="bract:edit-task"
              action={saveTaskRelated}
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
          title="詳細・メモ"
          canEdit={canEditFlag}
          showEditButton={false}
          editEvent="bract:edit-task"
          action={saveTaskInline}
          fields={[
            { label: '詳細・メモ', name: 'description', kind: 'textarea', value: task.description, fullWidth: true, view: task.description ? <span className="text-sm leading-[1.85] text-zinc-800">{task.description}</span> : <span className="text-zinc-300">詳細が記録されていません</span> },
          ]}
        />
        <div className="mt-4 text-right"><RecordId id={id} /></div>
      </RecordColumns>
    </div>
  )
}
