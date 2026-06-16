import { buildRecordStream } from '@/lib/buildRecordStream'
import { db } from '@/lib/db'
import { Car, Wallet, TrendingUp, CalendarClock, Activity, Wrench } from 'lucide-react'
import { vehicles } from '@/industries/auto-body/schema'
import { accounts, opportunities, activities, tasks, expenses, change_logs, maintenance_records, customer_vehicles, contacts } from '@/lib/schema'
import { activityIdsRelatedTo, taskIdsRelatedTo, expenseIdsRelatedTo } from '@/lib/relatedRecords'
import { alias } from 'drizzle-orm/pg-core'
import { eq, and, desc, asc, inArray } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import RecordHeader from '@/components/RecordHeader'
import RecordId from '@/components/RecordId'
import RecordLinksSection from '@/components/RecordLinksSection'
import AuthGuard from '@/components/AuthGuard'
import DeleteButton from '@/components/DeleteButton'
import { toggleTaskDone, quickCreateTask } from '@/app/actions/tasks'
import { quickCreateActivity } from '@/app/actions/activities'
import { quickCreateExpense } from '@/app/actions/expenses'
import { deleteVehicle, updateVehicleBasic } from '@/industries/auto-body/actions/vehicles'
import { canEdit } from '@/lib/auth'
import { getAllUsers } from '@/lib/userUtils'
import EditableInfoCard, { type EditField } from '@/components/detail/EditableInfoCard'
import InlineEditButton from '@/components/detail/InlineEditButton'
import { NavIcon } from '@/lib/navIcon'
import StageBar from '@/components/StageBar'
import { VEHICLE_STAGES } from '@/lib/statusStages'
import { requestStatusChange } from '@/app/actions/approvals'
import ApprovalSection from '@/components/approvals/ApprovalSection'
import { daysUntilInspection, calcAutoBodyProfit } from '@/industries/auto-body/lib/autoBodyService'
import { getActivityTypes } from '@/lib/activityTypes'
import { getAppTimeZone } from '@/lib/systemSettings'
import { RecordColumns, KpiBand, RefCard, Badge, RecordTable, RecordTableEmpty, type KpiItem } from '@/components/record/RecordUI'
import RecordTabPanel from '@/components/record/RecordTabPanel'
import ActivityStream from '@/components/record/ActivityStream'
import InlineComposer from '@/components/record/InlineComposer'


export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supplier = alias(accounts, 'supplier')
  const buyer = alias(accounts, 'buyer')

  const [vRow, relatedOpps, activitiesList, tasksList, expensesList, activityTypes, changeLogs, loanerHistory, accountsList, usersList] = await Promise.all([
    db.select({
      id: vehicles.id, maker: vehicles.maker, model: vehicles.model, year: vehicles.year, mileage: vehicles.mileage,
      color: vehicles.color, license_plate: vehicles.license_plate, vin: vehicles.vin, status: vehicles.status,
      purchase_date: vehicles.purchase_date, purchase_price: vehicles.purchase_price, sale_price: vehicles.sale_price,
      sold_date: vehicles.sold_date, sold_price: vehicles.sold_price, next_inspection_date: vehicles.next_inspection_date,
      description: vehicles.description, owner_id: vehicles.owner_id, created_at: vehicles.created_at,
      supplier: { id: supplier.id, name: supplier.name }, buyer: { id: buyer.id, name: buyer.name },
    })
      .from(vehicles).leftJoin(supplier, eq(vehicles.supplier_account_id, supplier.id)).leftJoin(buyer, eq(vehicles.buyer_account_id, buyer.id)).where(eq(vehicles.id, id)).then((r) => r[0] ?? null),
    db.select({ id: opportunities.id, name: opportunities.name, stage: opportunities.stage, service_type: opportunities.service_type, amount: opportunities.amount, parts_cost: opportunities.parts_cost, close_date: opportunities.close_date })
      .from(opportunities).where(eq(opportunities.vehicle_id, id)).orderBy(desc(opportunities.close_date)),
    db.select().from(activities).where(inArray(activities.id, activityIdsRelatedTo('vehicles', id))).orderBy(desc(activities.occurred_at)),
    db.select().from(tasks).where(inArray(tasks.id, taskIdsRelatedTo('vehicles', id))).orderBy(asc(tasks.done), asc(tasks.due_date)),
    db.select().from(expenses).where(inArray(expenses.id, expenseIdsRelatedTo('vehicles', id))).orderBy(desc(expenses.expense_date)),
    getActivityTypes(),
    db.select().from(change_logs).where(and(eq(change_logs.object_type, 'vehicle'), eq(change_logs.object_id, id))).orderBy(desc(change_logs.changed_at)).limit(40),
    db.select({ id: maintenance_records.id, maintenance_no: maintenance_records.maintenance_no, status: maintenance_records.status, loaner_handover_at: maintenance_records.loaner_handover_at, loaner_return_at: maintenance_records.loaner_return_at, customer_account: { id: accounts.id, name: accounts.name }, customer_contact: { id: contacts.id, full_name: contacts.full_name } })
      .from(maintenance_records).leftJoin(accounts, eq(maintenance_records.account_id, accounts.id)).leftJoin(contacts, eq(maintenance_records.contact_id, contacts.id)).leftJoin(customer_vehicles, eq(maintenance_records.customer_vehicle_id, customer_vehicles.id)).where(eq(maintenance_records.loaner_vehicle_id, id)).orderBy(desc(maintenance_records.created_at)),
    db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    getAllUsers(),
  ])

  if (!vRow) notFound()
  const v = vRow
  const editFlag = await canEdit()

  async function saveVehicleInline(formData: FormData) { 'use server'; await updateVehicleBasic(id, formData) }
  async function handleDelete() { 'use server'; await deleteVehicle(id) }
  async function changeStatus(status: string) { 'use server'; return await requestStatusChange('vehicles', id, 'status', status) }
  async function toggleTask(formData: FormData) { 'use server'; await toggleTaskDone(formData.get('task_id') as string, formData.get('done') === 'true', `/vehicles/${id}`) }

  const accountOptions = accountsList.map((a) => ({ value: a.id, label: a.name }))
  const userOptions = usersList.map((u) => ({ value: u.id, label: u.name }))
  const ownerName = v.owner_id ? (usersList.find((u) => u.id === v.owner_id)?.name ?? null) : null
  const totalProfit = relatedOpps.reduce((s, o) => s + calcAutoBodyProfit(Number(o.amount ?? 0), Number(o.parts_cost ?? 0)), 0)
  const days = daysUntilInspection(v.next_inspection_date)
  const expiringSoon = days != null && days <= 30
  const vehProfit = v.purchase_price && v.sold_price ? Number(v.sold_price) - Number(v.purchase_price) : null

  const activeLoan = loanerHistory.find((l) => l.status !== '完了' && l.status !== 'キャンセル' && !l.loaner_return_at) ?? null
  const pastLoans = loanerHistory.filter((l) => l !== activeLoan)
  const customerLabelOf = (l: typeof loanerHistory[number]) => l.customer_account?.id ? l.customer_account.name : l.customer_contact?.id ? l.customer_contact.full_name : '—'

  const ACTIVITY_TYPE_LABELS: Record<string, string> = {}
  for (const t of activityTypes) ACTIVITY_TYPE_LABELS[t.value] = t.label

  // stream（活動 / ToDo / 経費 / 履歴）は共通ヘルパで構築
  const tz = await getAppTimeZone()
  const { stream, interactionCount } = buildRecordStream({
    activities: activitiesList, tasks: tasksList, expenses: expensesList, changeLogs,
    activityTypeLabels: ACTIVITY_TYPE_LABELS, toggleTask, tz,
  })

  const composer = (
    <AuthGuard minRole="editor">
      <InlineComposer relatedToken={`vehicles:${id}`} revalidate={`/vehicles/${id}`} activityTypes={activityTypes.map((t) => ({ value: t.value, label: t.label }))} userInitial={(ownerName ?? v.maker).trim()[0]} createActivity={quickCreateActivity} createTask={quickCreateTask} createExpense={quickCreateExpense} />
    </AuthGuard>
  )

  const vehicleFields: EditField[] = [
    { section: '車両', label: 'メーカー', name: 'maker', kind: 'text', value: v.maker, view: v.maker ?? '—' },
    { section: '車両', label: '車種', name: 'model', kind: 'text', value: v.model, view: v.model ?? '—' },
    { section: '車両', label: '年式', name: 'year', kind: 'number', value: v.year != null ? String(v.year) : '', view: v.year ?? '—' },
    { section: '車両', label: '走行距離', name: 'mileage', kind: 'number', value: v.mileage != null ? String(v.mileage) : '', view: v.mileage != null ? `${Number(v.mileage).toLocaleString()} km` : '—' },
    { section: '車両', label: '色', name: 'color', kind: 'text', value: v.color, view: v.color ?? '—' },
    { section: '車両', label: 'ナンバー', name: 'license_plate', kind: 'text', value: v.license_plate, view: v.license_plate ?? '—' },
    { section: '車両', label: '車台番号', name: 'vin', kind: 'text', value: v.vin, view: v.vin ? <span className="font-mono">{v.vin}</span> : '—' },
    { section: '車両', label: '次回車検', name: 'next_inspection_date', kind: 'date', value: v.next_inspection_date ? String(v.next_inspection_date).slice(0, 10) : '', view: <span className={expiringSoon ? 'text-rose-600 font-semibold' : ''}>{v.next_inspection_date ?? '—'}{days != null && <span className="ml-2 text-xs text-zinc-400">({days < 0 ? `${-days}日経過` : `あと${days}日`})</span>}</span> },
    { section: '車両', label: '担当', name: 'owner_id', kind: 'select', value: v.owner_id ?? '', options: userOptions, view: ownerName ?? '—' },
    { section: '車両', label: '登録日', view: v.created_at ? new Date(v.created_at).toLocaleDateString('ja-JP') : '—' },
    { section: '仕入・販売', label: '仕入日', name: 'purchase_date', kind: 'date', value: v.purchase_date ? String(v.purchase_date).slice(0, 10) : '', view: v.purchase_date ?? '—' },
    { section: '仕入・販売', label: '仕入価格', name: 'purchase_price', kind: 'number', value: v.purchase_price != null ? String(v.purchase_price) : '', view: v.purchase_price ? `¥${Number(v.purchase_price).toLocaleString()}` : '—' },
    { section: '仕入・販売', label: '仕入元', name: 'supplier_account_id', kind: 'select', value: v.supplier?.id ?? '', options: accountOptions, view: v.supplier?.id ? <Link href={`/accounts/${v.supplier.id}`} className="text-brand-700 hover:underline">{v.supplier.name}</Link> : '—' },
    { section: '仕入・販売', label: '希望売価', name: 'sale_price', kind: 'number', value: v.sale_price != null ? String(v.sale_price) : '', view: v.sale_price ? `¥${Number(v.sale_price).toLocaleString()}` : '—' },
    { section: '仕入・販売', label: '売却日', name: 'sold_date', kind: 'date', value: v.sold_date ? String(v.sold_date).slice(0, 10) : '', view: v.sold_date ?? '—' },
    { section: '仕入・販売', label: '売却価格', name: 'sold_price', kind: 'number', value: v.sold_price != null ? String(v.sold_price) : '', view: v.sold_price ? <span className="font-semibold text-emerald-700">¥{Number(v.sold_price).toLocaleString()}</span> : '—' },
    { section: '仕入・販売', label: '売却先', name: 'buyer_account_id', kind: 'select', value: v.buyer?.id ?? '', options: accountOptions, view: v.buyer?.id ? <Link href={`/accounts/${v.buyer.id}`} className="text-brand-700 hover:underline">{v.buyer.name}</Link> : '—' },
    { section: '備考', label: '備考', name: 'description', kind: 'textarea', value: v.description, fullWidth: true, view: v.description ? v.description : <span className="text-zinc-300">—</span> },
  ]

  const kpis: KpiItem[] = [
    { icon: <Wallet />, label: '仕入価格', value: v.purchase_price ? `¥${Number(v.purchase_price).toLocaleString()}` : '—', sub: v.purchase_date ?? '—' },
    { icon: <Wallet />, label: v.sold_price ? '売却価格' : '希望売価', value: (v.sold_price ?? v.sale_price) ? `¥${Number(v.sold_price ?? v.sale_price).toLocaleString()}` : '—', sub: v.sold_date ?? (v.sold_price ? '—' : '未販売') },
    { icon: <TrendingUp />, label: '単体粗利', value: vehProfit != null ? `¥${vehProfit.toLocaleString()}` : '—', sub: '売価 − 仕入', subTone: vehProfit != null && vehProfit < 0 ? 'down' : 'up' },
    { icon: <CalendarClock />, label: '次回車検', value: <span className="text-[17px]">{v.next_inspection_date ?? '—'}</span>, sub: days != null ? (days < 0 ? `${-days}日経過` : `あと${days}日`) : '—', subTone: expiringSoon ? 'warn' : 'mut' },
  ]

  const serviceTab = relatedOpps.length === 0 ? <RecordTableEmpty>関連サービスがありません</RecordTableEmpty> : (
    <>
      <div className="flex justify-end px-4 py-2"><AuthGuard minRole="editor"><Link href={`/opportunities/new?vehicle_id=${id}`} className="text-xs text-brand-700 font-semibold hover:text-brand-800">＋ 整備・修理・車検</Link></AuthGuard></div>
      <RecordTable columns={[{ label: 'サービス' }, { label: '区分' }, { label: '売上', num: true }, { label: '部品原価', num: true }, { label: '利益', num: true }]}>
        {relatedOpps.map((o) => {
          const profit = calcAutoBodyProfit(Number(o.amount ?? 0), Number(o.parts_cost ?? 0))
          return (
            <tr key={o.id} className="hover:bg-zinc-50">
              <td className="px-4 py-2.5 border-b border-zinc-100 font-semibold text-zinc-900"><Link href={`/opportunities/${o.id}`} className="hover:text-brand-700">{o.name}</Link></td>
              <td className="px-4 py-2.5 border-b border-zinc-100 text-zinc-500">{o.service_type ?? '—'}</td>
              <td className="px-4 py-2.5 border-b border-zinc-100 text-right tabular-nums text-zinc-700">{o.amount ? `¥${Number(o.amount).toLocaleString()}` : '—'}</td>
              <td className="px-4 py-2.5 border-b border-zinc-100 text-right tabular-nums text-zinc-500">¥{Number(o.parts_cost ?? 0).toLocaleString()}</td>
              <td className={`px-4 py-2.5 border-b border-zinc-100 text-right tabular-nums font-medium ${profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>¥{profit.toLocaleString()}</td>
            </tr>
          )
        })}
      </RecordTable>
      <div className="flex justify-between px-4 py-2.5 bg-zinc-50 border-t border-zinc-200 text-sm"><span className="font-semibold text-zinc-600">利益合計</span><span className={`font-bold ${totalProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>¥{totalProfit.toLocaleString()}</span></div>
    </>
  )

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <RecordHeader
        crumbs={[{ label: '車両', href: '/vehicles' }, { label: `${v.maker} ${v.model}` }]}
        avatar={<Car className="w-6 h-6" strokeWidth={2.25} aria-hidden />}
        title={`${v.maker} ${v.model}`}
        meta={[
          ...(v.year != null ? [{ value: `${v.year}年式` }] : []),
          ...(v.mileage != null ? [{ value: `${Number(v.mileage).toLocaleString()} km` }] : []),
          ...(v.license_plate ? [{ value: v.license_plate, mono: true }] : []),
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <InlineEditButton event="bract:edit-vehicle" />
              <DeleteButton action={handleDelete} confirmMessage="この車両を削除しますか？" />
            </div>
          </AuthGuard>
        }
      />

      <div className="mb-5">
        <StageBar stages={VEHICLE_STAGES} currentStage={v.status} updateAction={changeStatus} />
      </div>

      <ApprovalSection objectType="vehicles" objectId={id} />

      <KpiBand items={kpis} />

      <RecordColumns
        left={
          <>
            <EditableInfoCard title="車両情報（全項目）" dense canEdit={editFlag} editEvent="bract:edit-vehicle" action={saveVehicleInline} fields={vehicleFields} />

            {(activeLoan || pastLoans.length > 0) && (
              <RefCard title="代車利用" icon={<NavIcon icon="🚙" className="w-4 h-4" />}>
                {activeLoan ? (
                  <div className="bg-teal-50 border border-teal-200 rounded-md p-3 mb-2">
                    <div className="flex items-center gap-2 mb-1"><span className="text-[11px] font-semibold text-teal-700">現在貸出中</span><Badge tone="neutral">{activeLoan.status}</Badge></div>
                    <Link href={`/maintenance/${activeLoan.id}`} className="text-sm font-semibold text-brand-700 hover:underline block">整備 {activeLoan.maintenance_no}</Link>
                    <p className="text-xs text-zinc-600 mt-0.5">顧客: {customerLabelOf(activeLoan)}</p>
                  </div>
                ) : <p className="text-xs text-zinc-400 mb-2">現在の貸出はありません</p>}
                {pastLoans.length > 0 && (
                  <ul className="divide-y divide-zinc-100 text-xs">
                    {pastLoans.map((l) => (
                      <li key={l.id} className="py-1.5 flex items-center gap-2">
                        <Link href={`/maintenance/${l.id}`} className="text-brand-700 hover:underline shrink-0">{l.maintenance_no}</Link>
                        <span className="text-zinc-700 truncate">{customerLabelOf(l)}</span>
                        <span className="text-zinc-400 ml-auto shrink-0">{l.loaner_handover_at ? new Date(l.loaner_handover_at).toLocaleDateString('ja-JP') : '—'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </RefCard>
            )}

            <RecordLinksSection selfApi="vehicle" selfId={id} />
          </>
        }
      >
        <RecordTabPanel
          tabs={[
            { id: 'flow', label: 'アクティビティ', icon: <Activity />, count: interactionCount, content: <ActivityStream events={stream} composer={composer} /> },
            { id: 'service', label: '関連サービス', icon: <Wrench />, count: relatedOpps.length, content: serviceTab },
          ]}
        />
        <div className="mt-4 text-right"><RecordId id={id} /></div>
      </RecordColumns>
    </div>
  )
}
