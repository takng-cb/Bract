import { db } from '@/lib/db'
import { SquarePen } from 'lucide-react'
import { vehicles } from '@/industries/auto-body/schema'
import { accounts, opportunities, activities, tasks, expenses, change_logs, maintenance_records, customer_vehicles, contacts } from '@/lib/schema'
import { activityIdsRelatedTo, taskIdsRelatedTo, expenseIdsRelatedTo, batchResolveRelatedRecords } from '@/lib/relatedRecords'
import OtherRelationsChips from '@/components/OtherRelationsChips'
import { alias } from 'drizzle-orm/pg-core'
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
import { deleteVehicle } from '@/industries/auto-body/actions/vehicles'
import { NavIcon } from '@/lib/navIcon'
import {
  vehicleStatusColor,
  daysUntilInspection,
  calcAutoBodyProfit,
} from '@/industries/auto-body/lib/autoBodyService'
import { getActivityTypes } from '@/lib/activityTypes'

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  high:   { label: '高', color: 'text-red-600 bg-red-50' },
  medium: { label: '中', color: 'text-yellow-700 bg-yellow-50' },
  low:    { label: '低', color: 'text-green-700 bg-green-50' },
}

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supplier = alias(accounts, 'supplier')
  const buyer    = alias(accounts, 'buyer')

  const [vRow, relatedOpps, activitiesList, tasksList, expensesList, activityTypes, changeLogCountRow, loanerHistory] = await Promise.all([
    db.select({
      id:                   vehicles.id,
      maker:                vehicles.maker,
      model:                vehicles.model,
      year:                 vehicles.year,
      mileage:              vehicles.mileage,
      color:                vehicles.color,
      license_plate:        vehicles.license_plate,
      vin:                  vehicles.vin,
      status:               vehicles.status,
      purchase_date:        vehicles.purchase_date,
      purchase_price:       vehicles.purchase_price,
      sale_price:           vehicles.sale_price,
      sold_date:            vehicles.sold_date,
      sold_price:           vehicles.sold_price,
      next_inspection_date: vehicles.next_inspection_date,
      description:          vehicles.description,
      created_at:           vehicles.created_at,
      supplier: { id: supplier.id, name: supplier.name },
      buyer:    { id: buyer.id,    name: buyer.name },
    })
      .from(vehicles)
      .leftJoin(supplier, eq(vehicles.supplier_account_id, supplier.id))
      .leftJoin(buyer,    eq(vehicles.buyer_account_id, buyer.id))
      .where(eq(vehicles.id, id))
      .then((r) => r[0] ?? null),
    db.select({
      id:           opportunities.id,
      name:         opportunities.name,
      stage:        opportunities.stage,
      service_type: opportunities.service_type,
      amount:       opportunities.amount,
      parts_cost:   opportunities.parts_cost,
      close_date:   opportunities.close_date,
    })
      .from(opportunities)
      .where(eq(opportunities.vehicle_id, id))
      .orderBy(desc(opportunities.close_date)),
    db.select().from(activities)
      .where(inArray(activities.id, activityIdsRelatedTo('vehicles', id)))
      .orderBy(desc(activities.occurred_at)),
    db.select().from(tasks)
      .where(inArray(tasks.id, taskIdsRelatedTo('vehicles', id)))
      .orderBy(asc(tasks.done), asc(tasks.due_date)),
    db.select().from(expenses)
      .where(inArray(expenses.id, expenseIdsRelatedTo('vehicles', id)))
      .orderBy(desc(expenses.expense_date)),
    getActivityTypes(),
    db.select({ c: count() }).from(change_logs)
      .where(and(eq(change_logs.object_type, 'vehicle'), eq(change_logs.object_id, id))),
    // この車両を代車として使った（または現在使っている）整備の履歴
    // 最新順。アクティブ判定は status と loaner_return_at で行う。
    db.select({
      id:                 maintenance_records.id,
      maintenance_no:     maintenance_records.maintenance_no,
      status:             maintenance_records.status,
      intake_date:        maintenance_records.intake_date,
      delivery_date:      maintenance_records.delivery_date,
      loaner_handover_at: maintenance_records.loaner_handover_at,
      loaner_return_at:   maintenance_records.loaner_return_at,
      customer_account:   { id: accounts.id, name: accounts.name },
      customer_contact:   { id: contacts.id, full_name: contacts.full_name },
      vehicle:            { id: customer_vehicles.id, plate_number: customer_vehicles.plate_number, car_model: customer_vehicles.car_model },
    })
      .from(maintenance_records)
      .leftJoin(accounts,          eq(maintenance_records.account_id, accounts.id))
      .leftJoin(contacts,          eq(maintenance_records.contact_id, contacts.id))
      .leftJoin(customer_vehicles, eq(maintenance_records.customer_vehicle_id, customer_vehicles.id))
      .where(eq(maintenance_records.loaner_vehicle_id, id))
      .orderBy(desc(maintenance_records.created_at)),
  ])

  if (!vRow) notFound()
  const v = vRow

  const [activityRelMap, taskRelMap, expenseRelMap] = await Promise.all([
    batchResolveRelatedRecords('activity', activitiesList.map((a) => a.id)),
    batchResolveRelatedRecords('task',     tasksList.map((t) => t.id)),
    batchResolveRelatedRecords('expense',  expensesList.map((e) => e.id)),
  ])
  const isNotSelf = (r: { object_api: string; record_id: string }) =>
    !(r.object_api === 'vehicles' && r.record_id === id)

  const totalProfit = relatedOpps.reduce(
    (s, o) => s + calcAutoBodyProfit(Number(o.amount ?? 0), Number(o.parts_cost ?? 0)),
    0,
  )

  const days = daysUntilInspection(v.next_inspection_date)
  const expiringSoon = days != null && days <= 30

  // 代車利用: アクティブ = ステータスが完了/キャンセルでない、かつ返却日時が未記録
  const activeLoan  = loanerHistory.find((l) => l.status !== '完了' && l.status !== 'キャンセル' && !l.loaner_return_at) ?? null
  const pastLoans   = loanerHistory.filter((l) => l !== activeLoan)
  const customerLabelOf = (l: typeof loanerHistory[number]) =>
    l.customer_account?.id ? l.customer_account.name
      : l.customer_contact?.id ? l.customer_contact.full_name
      : '—'

  const ACTIVITY_TYPE_LABELS: Record<string, string> = {}
  for (const t of activityTypes) ACTIVITY_TYPE_LABELS[t.value] = `${t.icon} ${t.label}`

  async function handleDelete() {
    'use server'
    await deleteVehicle(id)
  }

  async function toggleTask(formData: FormData) {
    'use server'
    const taskId = formData.get('task_id') as string
    const done   = formData.get('done') === 'true'
    await toggleTaskDone(taskId, done, `/vehicles/${id}`)
  }

  // ── 概要タブ ─────────────────────────────────────────────────────
  const overviewContent = (
    <>
      <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 mb-6">
        <h2 className="text-sm font-bold text-zinc-700 mb-4">車両情報</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-zinc-400 mb-1">ナンバー</dt>
            <dd className="text-sm text-zinc-800">{v.license_plate ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">車台番号</dt>
            <dd className="text-sm text-zinc-800">{v.vin ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">次回車検</dt>
            <dd className={`text-sm ${expiringSoon ? 'text-red-600 font-semibold' : 'text-zinc-800'}`}>
              {v.next_inspection_date ?? '—'}
              {days != null && (
                <span className="ml-2 text-xs text-zinc-400">
                  ({days < 0 ? `${-days}日経過` : `あと${days}日`})
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">登録日</dt>
            <dd className="text-sm text-zinc-800">
              {v.created_at ? new Date(v.created_at).toLocaleDateString('ja-JP') : '—'}
            </dd>
          </div>
        </dl>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 mb-6">
        <h2 className="text-sm font-bold text-zinc-700 mb-4">仕入・販売</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-zinc-400 mb-1">仕入日</dt>
            <dd className="text-sm text-zinc-800">{v.purchase_date ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">仕入価格</dt>
            <dd className="text-sm text-zinc-800">{v.purchase_price ? `¥${Number(v.purchase_price).toLocaleString()}` : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">仕入元</dt>
            <dd className="text-sm text-zinc-800">
              {v.supplier?.id ? (
                <Link href={`/accounts/${v.supplier.id}`} className="text-blue-600 hover:underline">{v.supplier.name}</Link>
              ) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">希望売価</dt>
            <dd className="text-sm text-zinc-800">{v.sale_price ? `¥${Number(v.sale_price).toLocaleString()}` : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">売却日</dt>
            <dd className="text-sm text-zinc-800">{v.sold_date ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">売却価格</dt>
            <dd className="text-sm text-zinc-800">
              {v.sold_price ? <span className="font-semibold text-green-700">¥{Number(v.sold_price).toLocaleString()}</span> : '—'}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-zinc-400 mb-1">売却先</dt>
            <dd className="text-sm text-zinc-800">
              {v.buyer?.id ? (
                <Link href={`/accounts/${v.buyer.id}`} className="text-blue-600 hover:underline">{v.buyer.name}</Link>
              ) : '—'}
            </dd>
          </div>
        </dl>
        {v.purchase_price && v.sold_price && (
          <div className="mt-4 pt-4 border-t border-zinc-200 flex justify-between items-baseline">
            <span className="text-sm font-semibold text-zinc-700">車両単体粗利（売価 − 仕入）</span>
            <span className={`text-xl font-bold ${Number(v.sold_price) - Number(v.purchase_price) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              ¥{(Number(v.sold_price) - Number(v.purchase_price)).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {v.description && (
        <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 mb-6">
          <h2 className="text-sm font-bold text-zinc-700 mb-2">備考</h2>
          <p className="text-sm text-zinc-800 whitespace-pre-wrap">{v.description}</p>
        </div>
      )}

      {/* 代車利用（Issue #45） */}
      {(activeLoan || pastLoans.length > 0) && (
        <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 mb-6">
          <h2 className="text-sm font-bold text-zinc-700 mb-4 flex items-center gap-2">
            <NavIcon icon="🚙" className="w-4 h-4" /> 代車利用
          </h2>

          {/* 現在の貸出先 */}
          {activeLoan ? (
            <div className="bg-teal-50 border border-teal-200 rounded-md p-4 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-teal-700 uppercase tracking-wide">現在貸出中</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-zinc-600 border border-zinc-200">
                  {activeLoan.status}
                </span>
              </div>
              <Link
                href={`/maintenance/${activeLoan.id}`}
                className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline block"
              >
                整備 {activeLoan.maintenance_no}
              </Link>
              <p className="text-xs text-zinc-600 mt-1">
                顧客: {customerLabelOf(activeLoan)}
                {activeLoan.vehicle?.plate_number && (
                  <span className="ml-2 text-zinc-400 inline-flex items-center gap-1">／ 顧客車両: <NavIcon icon="🚗" className="w-3 h-3 shrink-0" />{activeLoan.vehicle.plate_number}</span>
                )}
              </p>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mt-2">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">入庫日</dt>
                  <dd className="text-zinc-700">{activeLoan.intake_date ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">納車予定</dt>
                  <dd className="text-zinc-700">{activeLoan.delivery_date ?? '—'}</dd>
                </div>
                <div className="flex justify-between col-span-2">
                  <dt className="text-zinc-500">貸出日時</dt>
                  <dd className="text-zinc-700">
                    {activeLoan.loaner_handover_at ? new Date(activeLoan.loaner_handover_at).toLocaleString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="text-xs text-zinc-400 mb-3">現在の貸出はありません</p>
          )}

          {/* 過去の貸出履歴 */}
          {pastLoans.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                過去の貸出履歴 <span className="text-zinc-400">({pastLoans.length})</span>
              </p>
              <ul className="divide-y divide-zinc-100 text-xs">
                {pastLoans.map((l) => (
                  <li key={l.id} className="py-1.5 flex items-center gap-3">
                    <Link href={`/maintenance/${l.id}`} className="text-blue-600 hover:underline shrink-0">
                      {l.maintenance_no}
                    </Link>
                    <span className="text-zinc-700 truncate">{customerLabelOf(l)}</span>
                    <span className="text-zinc-400 ml-auto shrink-0">
                      {l.loaner_handover_at ? new Date(l.loaner_handover_at).toLocaleDateString('ja-JP') : '—'}
                      {l.loaner_return_at && ` → ${new Date(l.loaner_return_at).toLocaleDateString('ja-JP')}`}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 shrink-0">{l.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-zinc-800">
            関連サービス <span className="text-zinc-400 font-normal text-sm">({relatedOpps.length})</span>
          </h2>
          <AuthGuard minRole="editor">
            <Link href={`/opportunities/new?vehicle_id=${id}`} className="text-xs text-blue-600 hover:text-blue-800">
              ＋ 整備・修理・車検を追加
            </Link>
          </AuthGuard>
        </div>
        {relatedOpps.length > 0 ? (
          <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-zinc-600">サービス</th>
                  <th className="text-left px-3 py-2 font-medium text-zinc-600">区分</th>
                  <th className="text-left px-3 py-2 font-medium text-zinc-600">完了予定</th>
                  <th className="text-left px-3 py-2 font-medium text-zinc-600">売上</th>
                  <th className="text-left px-3 py-2 font-medium text-zinc-600">部品原価</th>
                  <th className="text-left px-3 py-2 font-medium text-zinc-600">利益</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {relatedOpps.map((o) => {
                  const profit = calcAutoBodyProfit(Number(o.amount ?? 0), Number(o.parts_cost ?? 0))
                  return (
                    <tr key={o.id} className="hover:bg-zinc-50">
                      <td className="px-3 py-2">
                        <Link href={`/opportunities/${o.id}`} className="font-medium hover:text-blue-600">{o.name}</Link>
                      </td>
                      <td className="px-3 py-2 text-zinc-500">{o.service_type ?? '—'}</td>
                      <td className="px-3 py-2 text-zinc-500">{o.close_date ?? '—'}</td>
                      <td className="px-3 py-2 text-right text-zinc-700">{o.amount ? `¥${Number(o.amount).toLocaleString()}` : '—'}</td>
                      <td className="px-3 py-2 text-right text-zinc-500">¥{Number(o.parts_cost ?? 0).toLocaleString()}</td>
                      <td className={`px-3 py-2 text-right font-medium ${profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>¥{profit.toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="border-t-2 border-zinc-200 bg-zinc-50">
                <tr>
                  <td colSpan={5} className="px-3 py-2 text-xs font-semibold text-zinc-600">利益合計</td>
                  <td className={`px-3 py-2 text-right font-bold ${totalProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>¥{totalProfit.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="text-sm text-zinc-400 bg-white border border-zinc-200 rounded-lg px-4 py-6 text-center">
            関連サービスがありません
          </p>
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
        <p className="text-xs text-zinc-400 mb-3">作成画面の「関連レコード」で車両を選択してください</p>
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
                {a.body && <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{a.body}</p>}
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
              const isOverdue = !t.done && t.due_date && new Date(t.due_date) < new Date()
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
                    <div className="flex items-center gap-2">
                      <Link href={`/tasks/${t.id}`} className={`text-sm hover:text-blue-600 ${t.done ? 'line-through text-zinc-400' : 'text-zinc-900 font-medium'}`}>{t.title}</Link>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priority.color}`}>{priority.label}</span>
                    </div>
                    {t.due_date && <p className={`text-xs mt-0.5 inline-flex items-center gap-1 ${isOverdue ? 'text-red-500' : 'text-zinc-400'}`}><NavIcon icon="📅" className="w-3 h-3 shrink-0" /> {new Date(t.due_date).toLocaleDateString('ja-JP')}{isOverdue && ' (期限超過)'}</p>}
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
      <ChangeLogSection objectType="vehicle" objectId={id} />
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
        crumbs={[
          { label: '車両', href: '/vehicles' },
          { label: `${v.maker} ${v.model}` },
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <Link href={`/vehicles/${id}/edit`} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"><SquarePen className="w-4 h-4 inline -mt-0.5" strokeWidth={2.25} /> 編集</Link>
              <DeleteButton action={handleDelete} confirmMessage="この車両を削除しますか？" />
            </div>
          </AuthGuard>
        }
      />

      <div className="mb-4">
        <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
          <NavIcon icon="🚗" className="w-6 h-6" /> {v.maker} {v.model}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
          <span className={`inline-block px-2 py-0.5 text-xs rounded ${vehicleStatusColor(v.status)}`}>{v.status}</span>
          {v.year   && <span>{v.year}年式</span>}
          {v.color  && <span>・ {v.color}</span>}
          {v.mileage != null && <span>・ {Number(v.mileage).toLocaleString()} km</span>}
        </div>
      </div>

      <RecordTabs defaultTab="overview" tabs={tabsConfig} />

      <div className="mt-6 text-right">
        <RecordId id={id} />
      </div>
    </div>
  )
}
