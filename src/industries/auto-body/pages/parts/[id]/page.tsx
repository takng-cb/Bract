import { db } from '@/lib/db'
import { parts, part_movements, vehicles } from '@/industries/auto-body/schema'
import { accounts, opportunities, activities, tasks, expenses, change_logs } from '@/lib/schema'
import { activityIdsRelatedTo, taskIdsRelatedTo, expenseIdsRelatedTo } from '@/lib/relatedRecords'
import { eq, and, desc, asc, inArray } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import RecordHeader from '@/components/RecordHeader'
import RecordId from '@/components/RecordId'
import AuthGuard from '@/components/AuthGuard'
import DeleteButton from '@/components/DeleteButton'
import { toggleTaskDone, quickCreateTask } from '@/app/actions/tasks'
import { quickCreateActivity } from '@/app/actions/activities'
import { quickCreateExpense } from '@/app/actions/expenses'
import { deletePart, createPartMovement, deletePartMovement, updatePartBasic } from '@/industries/auto-body/actions/parts'
import { calcStock, MOVEMENT_TYPES } from '@/industries/auto-body/lib/partsHelpers'
import { canEdit } from '@/lib/auth'
import EditableInfoCard from '@/components/detail/EditableInfoCard'
import InlineEditButton from '@/components/detail/InlineEditButton'
import { getActivityTypes } from '@/lib/activityTypes'
import { Wrench, Boxes, Wallet, Activity, Package } from 'lucide-react'
import { RecordColumns, KpiBand, Badge, RecordTable, RecordTableEmpty, type KpiItem, type BadgeTone } from '@/components/record/RecordUI'
import RecordTabPanel from '@/components/record/RecordTabPanel'
import ActivityStream, { type StreamEvent } from '@/components/record/ActivityStream'
import InlineComposer from '@/components/record/InlineComposer'

const PRIORITY_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  high: { label: '高', tone: 'danger' }, medium: { label: '中', tone: 'warn' }, low: { label: '低', tone: 'pos' },
}
const MOVE_TONE: Record<string, BadgeTone> = { 入庫: 'info', 出庫: 'warn', 調整: 'ai' }

export default async function PartDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [partRow, movementRows, opps, vehs, activitiesList, tasksList, expensesList, activityTypes, changeLogs, editFlag, supplierAccounts] = await Promise.all([
    db.select({ id: parts.id, part_number: parts.part_number, name: parts.name, category: parts.category, unit_price: parts.unit_price, reorder_level: parts.reorder_level, description: parts.description, created_at: parts.created_at, supplier: { id: accounts.id, name: accounts.name } })
      .from(parts).leftJoin(accounts, eq(parts.supplier_account_id, accounts.id)).where(eq(parts.id, id)).then((r) => r[0] ?? null),
    db.select({ id: part_movements.id, movement_type: part_movements.movement_type, quantity: part_movements.quantity, unit_price: part_movements.unit_price, occurred_at: part_movements.occurred_at, notes: part_movements.notes })
      .from(part_movements).where(eq(part_movements.part_id, id)).orderBy(desc(part_movements.occurred_at), desc(part_movements.created_at)),
    db.select({ id: opportunities.id, name: opportunities.name }).from(opportunities).orderBy(desc(opportunities.created_at)),
    db.select({ id: vehicles.id, maker: vehicles.maker, model: vehicles.model, license_plate: vehicles.license_plate }).from(vehicles).orderBy(asc(vehicles.maker), asc(vehicles.model)),
    db.select().from(activities).where(inArray(activities.id, activityIdsRelatedTo('parts', id))).orderBy(desc(activities.occurred_at)),
    db.select().from(tasks).where(inArray(tasks.id, taskIdsRelatedTo('parts', id))).orderBy(asc(tasks.done), asc(tasks.due_date)),
    db.select().from(expenses).where(inArray(expenses.id, expenseIdsRelatedTo('parts', id))).orderBy(desc(expenses.expense_date)),
    getActivityTypes(),
    db.select().from(change_logs).where(and(eq(change_logs.object_type, 'part'), eq(change_logs.object_id, id))).orderBy(desc(change_logs.changed_at)).limit(40),
    canEdit(),
    db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
  ])

  if (!partRow) notFound()

  const stock = calcStock(movementRows)
  const ACTIVITY_TYPE_LABELS: Record<string, string> = {}
  for (const t of activityTypes) ACTIVITY_TYPE_LABELS[t.value] = t.label
  const below = (partRow.reorder_level ?? 0) > 0 && stock <= (partRow.reorder_level ?? 0)

  async function savePartInline(formData: FormData) { 'use server'; await updatePartBasic(id, formData) }
  async function handleDelete() { 'use server'; await deletePart(id) }
  async function addMovement(formData: FormData) { 'use server'; formData.set('part_id', id); await createPartMovement(formData) }
  async function removeMovement(formData: FormData) { 'use server'; const mid = formData.get('movement_id') as string; if (mid) await deletePartMovement(mid, id) }
  async function toggleTask(formData: FormData) { 'use server'; await toggleTaskDone(formData.get('task_id') as string, formData.get('done') === 'true', `/parts/${id}`) }

  // eslint-disable-next-line react-hooks/purity
  const NOW = Date.now()
  const dayLabel = (d: Date) => {
    const t0 = new Date(NOW); t0.setHours(0, 0, 0, 0); const d0 = new Date(d); d0.setHours(0, 0, 0, 0)
    const diff = Math.round((t0.getTime() - d0.getTime()) / 86400000)
    if (diff === 0) return '今日'; if (diff === 1) return '昨日'
    return d.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })
  }
  const hm = (d: Date) => d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  const stream: (StreamEvent & { sort: number })[] = []
  for (const a of activitiesList) {
    const d = a.occurred_at ? new Date(a.occurred_at) : a.created_at ? new Date(a.created_at) : null
    if (!d) continue
    stream.push({ id: `a-${a.id}`, kind: 'act', typeLabel: ACTIVITY_TYPE_LABELS[a.type] ?? a.type, time: hm(d), day: dayLabel(d), sort: d.getTime(),
      body: <><Link href={`/activities/${a.id}`} className="font-semibold text-zinc-900 hover:text-brand-700">{a.subject}</Link>{a.body && <span className="block text-zinc-500 text-[12.5px] mt-0.5 line-clamp-2">{a.body}</span>}</> })
  }
  for (const t of tasksList) {
    const d = t.created_at ? new Date(t.created_at) : null
    if (!d) continue
    const pr = PRIORITY_BADGE[t.priority] ?? PRIORITY_BADGE.medium
    stream.push({ id: `t-${t.id}`, kind: 'todo', typeLabel: 'ToDo', time: hm(d), day: dayLabel(d), sort: d.getTime(),
      leading: <AuthGuard minRole="editor"><form action={toggleTask}><input type="hidden" name="task_id" value={t.id} /><input type="hidden" name="done" value={(!t.done).toString()} /><button type="submit" className={`w-4.5 h-4.5 rounded-md border-[1.5px] grid place-items-center ${t.done ? 'bg-brand-600 border-brand-600 text-white' : 'border-zinc-300 hover:border-brand-400'}`}>{t.done && <span className="text-[10px] leading-none">✓</span>}</button></form></AuthGuard>,
      body: <div className="flex items-center gap-2 flex-wrap"><Link href={`/tasks/${t.id}`} className={`font-semibold hover:text-brand-700 ${t.done ? 'line-through text-zinc-400' : 'text-zinc-900'}`}>{t.title}</Link><Badge tone={pr.tone}>{pr.label}</Badge></div> })
  }
  for (const e of expensesList) {
    const d = e.expense_date ? new Date(e.expense_date) : e.created_at ? new Date(e.created_at) : null
    if (!d) continue
    stream.push({ id: `e-${e.id}`, kind: 'exp', typeLabel: '経費', day: dayLabel(d), sort: d.getTime(),
      body: <Link href={`/expenses/${e.id}`} className="flex items-center justify-between gap-2"><span className="font-semibold text-zinc-900">{e.title}</span><span className="font-bold text-zinc-900 shrink-0">¥{Number(e.amount).toLocaleString()}</span></Link> })
  }
  for (const c of changeLogs) {
    const d = c.changed_at ? new Date(c.changed_at) : null
    if (!d) continue
    stream.push({ id: `c-${c.id}`, kind: 'his', typeLabel: '履歴', time: hm(d), day: dayLabel(d), sort: d.getTime(),
      body: <span className="text-zinc-600">{c.field_label}を <span className="text-zinc-900 font-medium">{c.old_value ?? '—'}</span> → <span className="text-zinc-900 font-medium">{c.new_value ?? '—'}</span> に変更</span> })
  }
  stream.sort((a, b) => b.sort - a.sort)
  const interactionCount = activitiesList.length + tasksList.length + expensesList.length

  const composer = (
    <AuthGuard minRole="editor">
      <InlineComposer relatedToken={`parts:${id}`} revalidate={`/parts/${id}`} activityTypes={activityTypes.map((t) => ({ value: t.value, label: t.label }))} userInitial={partRow.name.trim()[0]} createActivity={quickCreateActivity} createTask={quickCreateTask} createExpense={quickCreateExpense} />
    </AuthGuard>
  )

  const kpis: KpiItem[] = [
    { icon: <Boxes />, label: '現在庫', value: <>{stock}<small> 個</small></>, sub: `発注点 ${partRow.reorder_level ?? 0}`, subTone: below ? 'down' : 'mut' },
    { icon: <Wallet />, label: '標準仕入単価', value: partRow.unit_price ? `¥${Number(partRow.unit_price).toLocaleString()}` : '—', sub: partRow.category ?? '—' },
    { icon: <Package />, label: '入出庫', value: <>{movementRows.length}<small> 件</small></>, sub: '履歴' },
    { icon: <Activity />, label: '活動', value: <>{interactionCount}<small> 件</small></>, sub: '活動/ToDo/経費' },
  ]

  const moveTab = (
    <div>
      <AuthGuard minRole="editor">
        <form action={addMovement} className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-4 py-3 border-b border-zinc-100 bg-zinc-50">
          <select name="movement_type" required defaultValue="入庫" className="border border-zinc-300 rounded-md px-2.5 py-1.5 text-sm bg-white">{MOVEMENT_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}</select>
          <input name="quantity" type="number" min="1" placeholder="数量" required className="border border-zinc-300 rounded-md px-2.5 py-1.5 text-sm" />
          <input name="occurred_at" type="date" defaultValue={new Date(NOW).toISOString().slice(0, 10)} className="border border-zinc-300 rounded-md px-2.5 py-1.5 text-sm" />
          <input name="unit_price" type="number" min="0" placeholder="単価（任意）" className="border border-zinc-300 rounded-md px-2.5 py-1.5 text-sm" />
          <select name="opportunity_id" className="border border-zinc-300 rounded-md px-2.5 py-1.5 text-sm bg-white"><option value="">— 関連商談（任意）—</option>{opps.slice(0, 50).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
          <select name="vehicle_id" className="border border-zinc-300 rounded-md px-2.5 py-1.5 text-sm bg-white"><option value="">— 関連車両（任意）—</option>{vehs.map((v) => <option key={v.id} value={v.id}>{v.maker} {v.model}{v.license_plate ? ` / ${v.license_plate}` : ''}</option>)}</select>
          <input name="notes" placeholder="メモ（任意）" className="sm:col-span-2 border border-zinc-300 rounded-md px-2.5 py-1.5 text-sm" />
          <button type="submit" className="px-4 py-1.5 bg-brand-600 text-white text-sm font-medium rounded-md hover:bg-brand-700">記録</button>
        </form>
      </AuthGuard>
      {movementRows.length === 0 ? <RecordTableEmpty>入出庫履歴がありません</RecordTableEmpty> : (
        <RecordTable columns={[{ label: '日付' }, { label: '種別' }, { label: '数量', num: true }, { label: '単価', num: true }, { label: 'メモ' }, { label: '' }]}>
          {movementRows.map((m) => (
            <tr key={m.id} className="hover:bg-zinc-50">
              <td className="px-4 py-2.5 border-b border-zinc-100 text-zinc-700">{m.occurred_at}</td>
              <td className="px-4 py-2.5 border-b border-zinc-100"><Badge tone={MOVE_TONE[m.movement_type] ?? 'neutral'}>{m.movement_type}</Badge></td>
              <td className={`px-4 py-2.5 border-b border-zinc-100 text-right tabular-nums font-semibold ${m.movement_type === '出庫' ? 'text-orange-600' : 'text-zinc-700'}`}>{m.movement_type === '出庫' ? '−' : '＋'} {m.quantity}</td>
              <td className="px-4 py-2.5 border-b border-zinc-100 text-right tabular-nums text-zinc-500">{m.unit_price ? `¥${Number(m.unit_price).toLocaleString()}` : '—'}</td>
              <td className="px-4 py-2.5 border-b border-zinc-100 text-zinc-500 truncate max-w-xs">{m.notes ?? '—'}</td>
              <td className="px-4 py-2.5 border-b border-zinc-100 text-right"><AuthGuard minRole="editor"><form action={removeMovement}><input type="hidden" name="movement_id" value={m.id} /><button type="submit" className="text-xs text-rose-400 hover:text-rose-600">削除</button></form></AuthGuard></td>
            </tr>
          ))}
        </RecordTable>
      )}
    </div>
  )

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <RecordHeader
        crumbs={[{ label: '部品マスタ', href: '/parts' }, { label: partRow.name }]}
        avatar={<Wrench className="w-6 h-6" strokeWidth={2.25} aria-hidden />}
        title={partRow.name}
        badges={<Badge tone={below ? 'danger' : 'pos'} dot>在庫 {stock} 個</Badge>}
        meta={[
          ...(partRow.part_number ? [{ label: '品番', value: partRow.part_number, mono: true }] : []),
          ...(partRow.category ? [{ label: 'カテゴリ', value: partRow.category }] : []),
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <InlineEditButton event="bract:edit-part" />
              <DeleteButton action={handleDelete} confirmMessage="この部品を削除しますか？関連する入出庫履歴もすべて削除されます。" />
            </div>
          </AuthGuard>
        }
      />

      <KpiBand items={kpis} />

      <RecordColumns
        left={
          <EditableInfoCard
            title="部品情報"
            dense
            canEdit={editFlag}
            showEditButton={false}
            editEvent="bract:edit-part"
            action={savePartInline}
            fields={[
              { label: '部品名', name: 'name', kind: 'text', value: partRow.name, view: partRow.name ?? '—' },
              { label: '品番', name: 'part_number', kind: 'text', value: partRow.part_number, view: partRow.part_number ? <span className="font-mono">{partRow.part_number}</span> : '—' },
              { label: 'カテゴリ', name: 'category', kind: 'text', value: partRow.category, view: partRow.category ?? '—' },
              { label: '標準仕入単価', name: 'unit_price', kind: 'number', value: partRow.unit_price != null ? String(partRow.unit_price) : '', view: partRow.unit_price ? `¥${Number(partRow.unit_price).toLocaleString()}` : '—' },
              { label: '主仕入元', name: 'supplier_account_id', kind: 'select', value: partRow.supplier?.id ?? '', options: supplierAccounts.map((a) => ({ value: a.id, label: a.name })), view: partRow.supplier?.id ? <Link href={`/accounts/${partRow.supplier.id}`} className="text-brand-700 hover:underline">{partRow.supplier.name}</Link> : '—' },
              { label: '発注点', name: 'reorder_level', kind: 'number', value: partRow.reorder_level != null ? String(partRow.reorder_level) : '', view: `${partRow.reorder_level} 個` },
              { label: '備考', name: 'description', kind: 'textarea', value: partRow.description, fullWidth: true, view: partRow.description ? partRow.description : <span className="text-zinc-300">—</span> },
            ]}
          />
        }
      >
        <RecordTabPanel
          tabs={[
            { id: 'flow', label: 'アクティビティ', icon: <Activity />, count: interactionCount, content: <ActivityStream events={stream} composer={composer} /> },
            { id: 'moves', label: '入出庫', icon: <Package />, count: movementRows.length, content: moveTab },
          ]}
        />
        <div className="mt-4 text-right"><RecordId id={id} /></div>
      </RecordColumns>
    </div>
  )
}
