import { db } from '@/lib/db'
import { parts, part_movements, vehicles } from '@/industries/auto-body/schema'
import { accounts, opportunities, activities, tasks, expenses, change_logs } from '@/lib/schema'
import { activityIdsRelatedTo, taskIdsRelatedTo, expenseIdsRelatedTo, batchResolveRelatedRecords } from '@/lib/relatedRecords'
import OtherRelationsChips from '@/components/OtherRelationsChips'
import { eq, and, desc, asc, inArray, count } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import RecordHeader from '@/components/RecordHeader'
import RecordId from '@/components/RecordId'
import AuthGuard from '@/components/AuthGuard'
import DeleteButton from '@/components/DeleteButton'
import ChangeLogSection from '@/components/ChangeLogSection'
import RecordTabs, { type TabDef } from '@/components/RecordTabs'
import { toggleTaskDone } from '@/app/actions/tasks'
import { deletePart, createPartMovement, deletePartMovement, updatePartBasic } from '@/industries/auto-body/actions/parts'
import { calcStock, stockBadgeColor, MOVEMENT_TYPES } from '@/industries/auto-body/lib/partsHelpers'
import { canEdit } from '@/lib/auth'
import EditableInfoCard from '@/components/detail/EditableInfoCard'
import InlineEditButton from '@/components/detail/InlineEditButton'
import { getActivityTypes } from '@/lib/activityTypes'
import { NavIcon } from '@/lib/navIcon'

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  high:   { label: '高', color: 'text-red-600 bg-red-50' },
  medium: { label: '中', color: 'text-yellow-700 bg-yellow-50' },
  low:    { label: '低', color: 'text-green-700 bg-green-50' },
}

export default async function PartDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [partRow, movementRows, opps, vehs, activitiesList, tasksList, expensesList, activityTypes, changeLogCountRow] = await Promise.all([
    db.select({
      id: parts.id, part_number: parts.part_number, name: parts.name,
      category: parts.category, unit_price: parts.unit_price,
      reorder_level: parts.reorder_level, description: parts.description,
      created_at: parts.created_at,
      supplier: { id: accounts.id, name: accounts.name },
    })
      .from(parts)
      .leftJoin(accounts, eq(parts.supplier_account_id, accounts.id))
      .where(eq(parts.id, id))
      .then((r) => r[0] ?? null),
    db.select({
      id:             part_movements.id,
      movement_type:  part_movements.movement_type,
      quantity:       part_movements.quantity,
      unit_price:     part_movements.unit_price,
      occurred_at:    part_movements.occurred_at,
      notes:          part_movements.notes,
      opportunity_id: part_movements.opportunity_id,
      vehicle_id:     part_movements.vehicle_id,
    })
      .from(part_movements)
      .where(eq(part_movements.part_id, id))
      .orderBy(desc(part_movements.occurred_at), desc(part_movements.created_at)),
    db.select({ id: opportunities.id, name: opportunities.name }).from(opportunities).orderBy(desc(opportunities.created_at)),
    db.select({ id: vehicles.id, maker: vehicles.maker, model: vehicles.model, license_plate: vehicles.license_plate }).from(vehicles).orderBy(asc(vehicles.maker), asc(vehicles.model)),
    db.select().from(activities)
      .where(inArray(activities.id, activityIdsRelatedTo('parts', id)))
      .orderBy(desc(activities.occurred_at)),
    db.select().from(tasks)
      .where(inArray(tasks.id, taskIdsRelatedTo('parts', id)))
      .orderBy(asc(tasks.done), asc(tasks.due_date)),
    db.select().from(expenses)
      .where(inArray(expenses.id, expenseIdsRelatedTo('parts', id)))
      .orderBy(desc(expenses.expense_date)),
    getActivityTypes(),
    db.select({ c: count() }).from(change_logs)
      .where(and(eq(change_logs.object_type, 'part'), eq(change_logs.object_id, id))),
  ])

  if (!partRow) notFound()

  const [activityRelMap, taskRelMap, expenseRelMap] = await Promise.all([
    batchResolveRelatedRecords('activity', activitiesList.map((a) => a.id)),
    batchResolveRelatedRecords('task',     tasksList.map((t) => t.id)),
    batchResolveRelatedRecords('expense',  expensesList.map((e) => e.id)),
  ])
  const isNotSelf = (r: { object_api: string; record_id: string }) =>
    !(r.object_api === 'parts' && r.record_id === id)

  const stock = calcStock(movementRows)
  const ACTIVITY_TYPE_LABELS: Record<string, string> = {}
  for (const t of activityTypes) ACTIVITY_TYPE_LABELS[t.value] = `${t.icon} ${t.label}`

  const [editFlag, supplierAccounts] = await Promise.all([
    canEdit(),
    db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
  ])

  async function savePartInline(formData: FormData) {
    'use server'
    await updatePartBasic(id, formData)
  }

  async function handleDelete() {
    'use server'
    await deletePart(id)
  }

  async function addMovement(formData: FormData) {
    'use server'
    formData.set('part_id', id)
    await createPartMovement(formData)
  }

  async function removeMovement(formData: FormData) {
    'use server'
    const mid = formData.get('movement_id') as string
    if (mid) await deletePartMovement(mid, id)
  }

  async function toggleTask(formData: FormData) {
    'use server'
    const taskId = formData.get('task_id') as string
    const done   = formData.get('done') === 'true'
    await toggleTaskDone(taskId, done, `/parts/${id}`)
  }

  // ── 概要タブ ─────────────────────────────────────────────────────
  const overviewContent = (
    <>
      <EditableInfoCard
        title="部品情報"
        canEdit={editFlag}
        showEditButton={false}
        editEvent="bract:edit-part"
        action={savePartInline}
        fields={[
          { label: '部品名', name: 'name', kind: 'text', value: partRow.name, view: partRow.name ?? '—' },
          { label: '品番', name: 'part_number', kind: 'text', value: partRow.part_number, view: partRow.part_number ? <span className="font-mono">{partRow.part_number}</span> : '—' },
          { label: 'カテゴリ', name: 'category', kind: 'text', value: partRow.category, view: partRow.category ?? '—' },
          { label: '標準仕入単価', name: 'unit_price', kind: 'number', value: partRow.unit_price != null ? String(partRow.unit_price) : '', view: partRow.unit_price ? `¥${Number(partRow.unit_price).toLocaleString()}` : '—' },
          { label: '主仕入元', name: 'supplier_account_id', kind: 'select', value: partRow.supplier?.id ?? '', options: supplierAccounts.map((a) => ({ value: a.id, label: a.name })),
            view: partRow.supplier?.id ? <Link href={`/accounts/${partRow.supplier.id}`} className="text-blue-600 hover:underline">{partRow.supplier.name}</Link> : '—' },
          { label: '発注しきい値', name: 'reorder_level', kind: 'number', value: partRow.reorder_level != null ? String(partRow.reorder_level) : '', view: `${partRow.reorder_level} 個` },
          { label: '現在庫', view: <span className={`px-3 py-1 rounded text-base font-bold ${stockBadgeColor(stock, partRow.reorder_level ?? 0)}`}>{stock} 個</span> },
          { label: '備考', name: 'description', kind: 'textarea', value: partRow.description, fullWidth: true, view: partRow.description ? partRow.description : <span className="text-zinc-300">—</span> },
        ]}
      />

      <AuthGuard minRole="editor">
        <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 mb-6">
          <h2 className="text-sm font-semibold text-zinc-700 mb-4">入出庫を記録</h2>
          <form action={addMovement} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select name="movement_type" required defaultValue="入庫"
              className="border border-zinc-300 rounded px-3 py-2 text-sm bg-white">
              {MOVEMENT_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <input name="quantity" type="number" min="1" placeholder="数量" required
              className="border border-zinc-300 rounded px-3 py-2 text-sm" />
            <input name="occurred_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)}
              className="border border-zinc-300 rounded px-3 py-2 text-sm" />
            <input name="unit_price" type="number" min="0" placeholder="単価（任意）"
              className="border border-zinc-300 rounded px-3 py-2 text-sm" />
            <select name="opportunity_id" className="border border-zinc-300 rounded px-3 py-2 text-sm bg-white">
              <option value="">— 関連商談（任意）—</option>
              {opps.slice(0, 50).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <select name="vehicle_id" className="border border-zinc-300 rounded px-3 py-2 text-sm bg-white">
              <option value="">— 関連車両（任意）—</option>
              {vehs.map((v) => (
                <option key={v.id} value={v.id}>{v.maker} {v.model}{v.license_plate ? ` / ${v.license_plate}` : ''}</option>
              ))}
            </select>
            <input name="notes" placeholder="メモ（任意）" className="sm:col-span-2 border border-zinc-300 rounded px-3 py-2 text-sm" />
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700">記録</button>
          </form>
        </div>
      </AuthGuard>

      <section className="mb-6">
        <h2 className="text-base font-semibold text-zinc-800 mb-3">入出庫履歴 <span className="text-zinc-400 font-normal text-sm">({movementRows.length})</span></h2>
        {movementRows.length === 0 ? (
          <p className="text-sm text-zinc-400 bg-white border border-zinc-200 rounded-lg px-4 py-6 text-center">履歴がありません</p>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left  px-3 py-2 font-medium text-zinc-600">日付</th>
                  <th className="text-left  px-3 py-2 font-medium text-zinc-600">種別</th>
                  <th className="text-left px-3 py-2 font-medium text-zinc-600">数量</th>
                  <th className="text-left px-3 py-2 font-medium text-zinc-600">単価</th>
                  <th className="text-left  px-3 py-2 font-medium text-zinc-600">メモ</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {movementRows.map((m) => {
                  const sign = m.movement_type === '出庫' ? '−' : '＋'
                  return (
                    <tr key={m.id} className="hover:bg-zinc-50">
                      <td className="px-3 py-2 text-zinc-700">{m.occurred_at}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          m.movement_type === '入庫' ? 'bg-blue-50 text-blue-700' :
                          m.movement_type === '出庫' ? 'bg-orange-50 text-orange-700' :
                          'bg-purple-50 text-purple-700'
                        }`}>{m.movement_type}</span>
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${m.movement_type === '出庫' ? 'text-orange-600' : 'text-zinc-700'}`}>
                        {sign} {m.quantity}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-500">
                        {m.unit_price ? `¥${Number(m.unit_price).toLocaleString()}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-zinc-500 truncate max-w-xs">{m.notes ?? '—'}</td>
                      <td className="px-3 py-2 text-right">
                        <AuthGuard minRole="editor">
                          <form action={removeMovement}>
                            <input type="hidden" name="movement_id" value={m.id} />
                            <button type="submit" className="text-xs text-red-400 hover:text-red-600">削除</button>
                          </form>
                        </AuthGuard>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )

  // ── 活動・ToDo・経費タブ ───────────────────────────────────────
  const interactionCount = activitiesList.length + tasksList.length + expensesList.length
  const interactionsContent = interactionCount === 0 ? (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-8 text-center">
      <p className="text-sm text-zinc-400 mb-4">活動・ToDo・経費はまだありません</p>
      <AuthGuard minRole="editor">
        <p className="text-xs text-zinc-400 mb-3">作成画面の「関連レコード」で部品を選択してください</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/activities/new" className="inline-flex items-center gap-1 px-3 py-1.5 border border-blue-200 text-blue-600 text-sm rounded-md hover:bg-blue-50 transition-colors">＋ 活動を記録</Link>
          <Link href="/tasks/new"      className="inline-flex items-center gap-1 px-3 py-1.5 border border-blue-200 text-blue-600 text-sm rounded-md hover:bg-blue-50 transition-colors">＋ ToDo を追加</Link>
          <Link href="/expenses/new"   className="inline-flex items-center gap-1 px-3 py-1.5 border border-blue-200 text-blue-600 text-sm rounded-md hover:bg-blue-50 transition-colors">＋ 経費を追加</Link>
        </div>
      </AuthGuard>
    </div>
  ) : (
    <>
      {activitiesList.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-zinc-800">活動履歴 <span className="text-zinc-400 font-normal text-sm">({activitiesList.length})</span></h2>
            <AuthGuard minRole="editor">
              <Link href={`/activities/new?custom_record_id=${id}`} className="text-xs text-blue-600 hover:text-blue-800">＋ 追加</Link>
            </AuthGuard>
          </div>
          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100">
            {activitiesList.map((a) => (
              <div key={a.id} className="px-4 py-3 hover:bg-zinc-50">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-zinc-400">{ACTIVITY_TYPE_LABELS[a.type] ?? a.type}</span>
                  <span className="text-xs text-zinc-400">•</span>
                  <span className="text-xs text-zinc-400">{a.occurred_at ? new Date(a.occurred_at).toLocaleDateString('ja-JP') : '—'}</span>
                </div>
                <Link href={`/activities/${a.id}`} className="text-sm font-medium text-zinc-800 hover:text-blue-600">{a.subject}</Link>
                <OtherRelationsChips relations={(activityRelMap.get(a.id) ?? []).filter(isNotSelf)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {tasksList.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-zinc-800">ToDo <span className="text-zinc-400 font-normal text-sm">({tasksList.length})</span></h2>
            <AuthGuard minRole="editor">
              <Link href={`/tasks/new?custom_record_id=${id}`} className="text-xs text-blue-600 hover:text-blue-800">＋ 追加</Link>
            </AuthGuard>
          </div>
          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100">
            {tasksList.map((t) => {
              const priority  = PRIORITY_CONFIG[t.priority] ?? PRIORITY_CONFIG.medium
              return (
                <div key={t.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 ${t.done ? 'opacity-60' : ''}`}>
                  <AuthGuard minRole="editor">
                    <form action={toggleTask} className="shrink-0">
                      <input type="hidden" name="task_id" value={t.id} />
                      <input type="hidden" name="done" value={(!t.done).toString()} />
                      <button type="submit" className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${t.done ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-300 hover:border-blue-400'}`}>
                        {t.done && <span className="text-xs leading-none">✓</span>}
                      </button>
                    </form>
                  </AuthGuard>
                  <div className="flex-1 min-w-0">
                    <Link href={`/tasks/${t.id}`} className={`text-sm hover:text-blue-600 ${t.done ? 'line-through text-zinc-400' : 'text-zinc-900 font-medium'}`}>{t.title}</Link>
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-medium ${priority.color}`}>{priority.label}</span>
                    <OtherRelationsChips relations={(taskRelMap.get(t.id) ?? []).filter(isNotSelf)} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {expensesList.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-zinc-800">経費 <span className="text-zinc-400 font-normal text-sm">({expensesList.length})</span></h2>
            <AuthGuard minRole="editor">
              <Link href={`/expenses/new?custom_record_id=${id}`} className="text-xs text-blue-600 hover:text-blue-800">＋ 追加</Link>
            </AuthGuard>
          </div>
          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100">
            {expensesList.map((e) => (
              <div key={e.id} className="px-4 py-3 hover:bg-zinc-50">
                <Link href={`/expenses/${e.id}`} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800">{e.title}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{e.category} · {e.expense_date}</p>
                  </div>
                  <span className="font-bold text-zinc-800 text-sm shrink-0">¥{Number(e.amount).toLocaleString()}</span>
                </Link>
                <OtherRelationsChips relations={(expenseRelMap.get(e.id) ?? []).filter(isNotSelf)} />
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )

  // ── 履歴タブ ─────────────────────────────────────────────────────
  const changeLogCount = Number(changeLogCountRow[0]?.c ?? 0)
  const historyContent = (
    <div className="bg-white border border-zinc-200 rounded-lg px-4 py-2">
      <ChangeLogSection objectType="part" objectId={id} />
    </div>
  )

  const tabsConfig: TabDef[] = [
    { id: 'overview', label: '概要', content: overviewContent },
  ]
  tabsConfig.push({
    id: 'interactions',
    label: '活動・ToDo・経費',
    badge: interactionCount > 0 ? interactionCount : undefined,
    content: interactionsContent,
  })
  if (changeLogCount > 0) {
    tabsConfig.push({ id: 'history', label: '履歴', badge: changeLogCount, content: historyContent })
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <RecordHeader
        crumbs={[{ label: '部品マスタ', href: '/parts' }, { label: partRow.name }]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <InlineEditButton event="bract:edit-part" />
              <DeleteButton action={handleDelete} confirmMessage="この部品を削除しますか？関連する入出庫履歴もすべて削除されます。" />
            </div>
          </AuthGuard>
        }
      />

      <div className="mb-4">
        <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2"><NavIcon icon="🔧" className="w-6 h-6" />{partRow.name}</h1>
        <p className="text-sm text-zinc-500 mt-1 font-mono">{partRow.part_number}</p>
      </div>

      <RecordTabs defaultTab="overview" tabs={tabsConfig} />

      <div className="mt-6 text-right">
        <RecordId id={id} />
      </div>
    </div>
  )
}
