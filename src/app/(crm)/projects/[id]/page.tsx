import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { accounts, change_logs, projects, activities, tasks, expenses } from '@/lib/schema'
import { eq, and, asc, desc, inArray } from 'drizzle-orm'
import Link from 'next/link'
import { Building2, Wallet, TrendingUp, CalendarClock, MapPin, UserRound, Tag, Activity, Folder } from 'lucide-react'
import RecordHeader from '@/components/RecordHeader'
import RecordId from '@/components/RecordId'
import RecordLinksSection from '@/components/RecordLinksSection'
import ExternalSharePanel from '@/components/portal/ExternalSharePanel'
import AuthGuard from '@/components/AuthGuard'
import DeleteButton from '@/components/DeleteButton'
import InlineEditButton from '@/components/detail/InlineEditButton'
import EditableInfoCard from '@/components/detail/EditableInfoCard'
import StageBar from '@/components/StageBar'
import TagsSection from '@/components/TagsSection'
import { PROJECT_STAGES, PROJECT_TYPES } from '@/lib/statusStages'
import { RecordColumns, KpiBand, RefCard, MiniItem, Badge, type KpiItem, type BadgeTone } from '@/components/record/RecordUI'
import RecordTabPanel from '@/components/record/RecordTabPanel'
import ActivityStream from '@/components/record/ActivityStream'
import InlineComposer from '@/components/record/InlineComposer'
import { buildRecordStream } from '@/lib/buildRecordStream'
import { activityIdsRelatedTo, taskIdsRelatedTo, expenseIdsRelatedTo } from '@/lib/relatedRecords'
import { getActivityTypes } from '@/lib/activityTypes'
import { toggleTaskDone, quickCreateTask } from '@/app/actions/tasks'
import { quickCreateActivity } from '@/app/actions/activities'
import { quickCreateExpense } from '@/app/actions/expenses'
import { NavIcon } from '@/lib/navIcon'
import { canEdit } from '@/lib/auth'
import { getAllUsers } from '@/lib/userUtils'
import { isModuleEnabled } from '@/lib/modules/registry'
import { requireBookRead, canSeeRecord } from '@/lib/permissions'
import { getAppTimeZone } from '@/lib/systemSettings'
import { fmtDate } from '@/lib/datetime'
import { updateProject, updateProjectStatus, deleteProject } from '@/app/actions/projects'

const STATUS_TONE: Record<string, BadgeTone> = {
  企画: 'neutral', 計画: 'info', 進行中: 'warn', 完了: 'pos', 保留: 'ai', 中止: 'danger',
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireBookRead('projects')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('projects'))) notFound()
  const { id } = await params

  const [project, allUsers, accountsList, activitiesList, tasksList, expensesList, activityTypes, changeLogs] = await Promise.all([
    db.select({
      id: projects.id, name: projects.name, status: projects.status, project_type: projects.project_type,
      location: projects.location, start_date: projects.start_date, end_date: projects.end_date,
      budget: projects.budget, expected_revenue: projects.expected_revenue, actual_cost: projects.actual_cost,
      description: projects.description, owner_id: projects.owner_id, created_at: projects.created_at,
      account: { id: accounts.id, name: accounts.name },
    })
      .from(projects)
      .leftJoin(accounts, eq(projects.account_id, accounts.id))
      .where(eq(projects.id, id)).then((r) => r[0] ?? null),
    getAllUsers(),
    db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    db.select().from(activities).where(inArray(activities.id, activityIdsRelatedTo('project', id))).orderBy(desc(activities.occurred_at)),
    db.select().from(tasks).where(inArray(tasks.id, taskIdsRelatedTo('project', id))).orderBy(asc(tasks.done), asc(tasks.due_date)),
    db.select().from(expenses).where(inArray(expenses.id, expenseIdsRelatedTo('project', id))).orderBy(desc(expenses.expense_date)),
    getActivityTypes(),
    db.select().from(change_logs).where(and(eq(change_logs.object_type, 'project'), eq(change_logs.object_id, id))).orderBy(desc(change_logs.changed_at)).limit(40),
  ])

  if (!project) notFound()
  if (!(await canSeeRecord('projects', 'read', project.owner_id))) notFound()  // レコードスコープ（REQ-0083）

  const editFlag = await canEdit()
  const account = project.account?.id ? project.account : null
  const ownerName = project.owner_id ? (allUsers.find((u) => u.id === project.owner_id)?.name ?? null) : null

  const ACTIVITY_TYPE_LABELS: Record<string, string> = {}
  for (const t of activityTypes) ACTIVITY_TYPE_LABELS[t.value] = t.label

  async function saveProjectInline(formData: FormData) { 'use server'; await updateProject(id, formData) }
  async function changeStatus(status: string) { 'use server'; await updateProjectStatus(id, status) }
  async function handleDelete() { 'use server'; await deleteProject(id) }
  async function toggleTask(formData: FormData) {
    'use server'
    await toggleTaskDone(formData.get('task_id') as string, formData.get('done') === 'true', `/projects/${id}`)
  }

  const tz = await getAppTimeZone()
  const { stream, interactionCount } = buildRecordStream({
    activities: activitiesList, tasks: tasksList, expenses: expensesList, changeLogs,
    activityTypeLabels: ACTIVITY_TYPE_LABELS, toggleTask, tz,
  })

  const composer = (
    <AuthGuard minRole="editor">
      <InlineComposer
        relatedToken={`project:${id}`}
        revalidate={`/projects/${id}`}
        activityTypes={activityTypes.map((t) => ({ value: t.value, label: t.label }))}
        userInitial={(ownerName ?? project.name).trim()[0]}
        createActivity={quickCreateActivity}
        createTask={quickCreateTask}
        createExpense={quickCreateExpense}
      />
    </AuthGuard>
  )

  // eslint-disable-next-line react-hooks/purity
  const NOW = Date.now()
  const budget   = project.budget != null ? Number(project.budget) : null
  const revenue  = project.expected_revenue != null ? Number(project.expected_revenue) : null
  const cost     = project.actual_cost != null ? Number(project.actual_cost) : 0
  const profit   = revenue != null ? revenue - cost : null
  const daysLeft = project.end_date ? Math.ceil((new Date(project.end_date).getTime() - NOW) / 86400000) : null

  const kpis: KpiItem[] = [
    { icon: <Wallet />, label: '予算', value: budget != null ? `¥${budget.toLocaleString()}` : '—', sub: '総事業費' },
    { icon: <Wallet />, label: '想定売上', value: revenue != null ? `¥${revenue.toLocaleString()}` : '—', sub: cost ? `実績原価 ¥${cost.toLocaleString()}` : '—' },
    { icon: <TrendingUp />, label: '想定粗利', value: profit != null ? `¥${profit.toLocaleString()}` : '—', sub: '売上 − 原価', subTone: profit != null && profit < 0 ? 'down' : 'up' },
    { icon: <CalendarClock />, label: '完了予定', value: <span className="text-[17px]">{project.end_date ?? '—'}</span>, sub: daysLeft != null ? (daysLeft < 0 ? `${-daysLeft}日超過` : `残 ${daysLeft}日`) : '—', subTone: daysLeft != null && daysLeft < 0 ? 'down' : 'warn' },
  ]

  const accountOptions = accountsList.map((a) => ({ value: a.id, label: a.name }))
  const userOptions = allUsers.map((u) => ({ value: u.id, label: u.name }))

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <RecordHeader
        crumbs={[{ label: 'プロジェクト', href: '/projects' }, { label: project.name }]}
        avatar={<NavIcon icon="🏗️" className="w-6 h-6" />}
        title={project.name}
        badges={<Badge tone={STATUS_TONE[project.status] ?? 'neutral'} dot>{project.status}</Badge>}
        meta={[
          ...(project.project_type ? [{ value: project.project_type }] : []),
          ...(project.location ? [{ icon: <MapPin className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />, value: project.location }] : []),
          ...(ownerName ? [{ icon: <UserRound className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />, label: '担当', value: ownerName }] : []),
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <InlineEditButton />
              <DeleteButton action={handleDelete} confirmMessage="このプロジェクトを削除しますか？" />
            </div>
          </AuthGuard>
        }
      />

      <div className="mb-5">
        <StageBar stages={PROJECT_STAGES} currentStage={project.status} updateAction={changeStatus} />
      </div>

      <KpiBand items={kpis} />

      <RecordColumns
        left={
          <>
            <EditableInfoCard
              title="プロジェクト情報"
              dense
              canEdit={editFlag}
              action={saveProjectInline}
              hiddenFields={[{ name: 'status', value: project.status }]}
              fields={[
                { label: 'プロジェクト名', name: 'name', kind: 'text', value: project.name, view: project.name },
                { label: '種別', name: 'project_type', kind: 'select', value: project.project_type ?? '', options: PROJECT_TYPES.map((t) => ({ value: t, label: t })), view: project.project_type ?? '—' },
                { label: '関連取引先', name: 'account_id', kind: 'select', value: account?.id ?? '', options: accountOptions, view: account ? <Link href={`/accounts/${account.id}`} className="text-brand-700 hover:underline">{account.name}</Link> : '—' },
                { label: '所在地', name: 'location', kind: 'text', value: project.location, view: project.location ?? '—' },
                { label: '着手日', name: 'start_date', kind: 'date', value: project.start_date ? String(project.start_date).slice(0, 10) : '', view: project.start_date ?? '—' },
                { label: '完了予定日', name: 'end_date', kind: 'date', value: project.end_date ? String(project.end_date).slice(0, 10) : '', view: project.end_date ?? '—' },
                { label: '予算・総事業費', name: 'budget', kind: 'number', value: project.budget != null ? String(project.budget) : '', view: budget != null ? `¥${budget.toLocaleString()}` : '—' },
                { label: '想定売上', name: 'expected_revenue', kind: 'number', value: project.expected_revenue != null ? String(project.expected_revenue) : '', view: revenue != null ? `¥${revenue.toLocaleString()}` : '—' },
                { label: '実績原価', name: 'actual_cost', kind: 'number', value: project.actual_cost != null ? String(project.actual_cost) : '', view: `¥${cost.toLocaleString()}` },
                { label: '担当者', name: 'owner_id', kind: 'select', value: project.owner_id ?? '', options: userOptions, view: ownerName ?? '—' },
                { label: '登録日', view: fmtDate(project.created_at, tz) },
                { label: '概要・メモ', name: 'description', kind: 'textarea', value: project.description, fullWidth: true, view: project.description ? project.description : <span className="text-zinc-300">—</span> },
              ]}
            />

            <RefCard title="関連取引先" icon={<Building2 />}>
              {account
                ? <MiniItem icon={<Building2 />} iconClass="bg-brand-50 text-brand-700" title={account.name} sub="取引先" href={`/accounts/${account.id}`} right={<NavIcon icon="↗" className="w-3.5 h-3.5" />} />
                : <p className="text-sm text-zinc-400">—</p>}
              {ownerName && <MiniItem icon={ownerName.trim()[0]} iconClass="bg-brand-600 text-white" title={ownerName} sub="担当" />}
            </RefCard>

            <RefCard title="タグ" icon={<Tag />}>
              <TagsSection objectType="project" objectId={id} revalidatePath={`/projects/${id}`} />
            </RefCard>
          </>
        }
      >
        <RecordTabPanel
          tabs={[
            { id: 'flow', label: 'アクティビティ', icon: <Activity />, count: interactionCount, content: <ActivityStream events={stream} composer={composer} /> },
            { id: 'related', label: '関連情報', icon: <Folder />, content: <div className="space-y-4"><RecordLinksSection selfApi="project" selfId={id} /><ExternalSharePanel objectApi="project" recordId={id} revalidatePath={`/projects/${id}`} /></div> },
          ]}
        />
        <div className="mt-4 text-right"><RecordId id={id} /></div>
      </RecordColumns>
    </div>
  )
}
