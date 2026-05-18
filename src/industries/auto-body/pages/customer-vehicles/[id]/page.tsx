import { db } from '@/lib/db'
import { customer_vehicles, accounts, contacts, maintenance_records } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import RecordHeader from '@/components/RecordHeader'
import RecordId from '@/components/RecordId'
import AuthGuard from '@/components/AuthGuard'
import DeleteButton from '@/components/DeleteButton'
import { deleteCustomerVehicle } from '@/industries/auto-body/actions/customerVehicles'
import { maintenanceDisplayName } from '@/industries/auto-body/lib/maintenanceDisplay'
import { isPersonalAccount } from '@/industries/auto-body/lib/customerDisplay'
import { AB_ICONS } from '@/industries/auto-body/lib/icons'

const STATUS_COLOR: Record<string, string> = {
  '予約':     'bg-zinc-100 text-zinc-700',
  '受付':     'bg-blue-50 text-blue-700',
  '作業中':   'bg-yellow-50 text-yellow-700',
  '納車待ち': 'bg-orange-50 text-orange-700',
  '完了':     'bg-green-50 text-green-700',
  'キャンセル': 'bg-red-50 text-red-700',
}

export default async function CustomerVehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // 整備一覧で displayName を組み立てるため、整備に紐付く account/contact を別名で join
  const mAccount = alias(accounts, 'm_account')
  const mContact = alias(contacts, 'm_contact')

  const [vRow, maintenances] = await Promise.all([
    db.select({
      v:       customer_vehicles,
      account: {
        id:      accounts.id,
        name:    accounts.name,
        phone:   accounts.phone,
        address: accounts.address,
      },
      contact: {
        id:        contacts.id,
        full_name: contacts.full_name,
        email:     contacts.email,
        phone:     contacts.phone,
      },
    })
      .from(customer_vehicles)
      .leftJoin(accounts, eq(customer_vehicles.account_id, accounts.id))
      .leftJoin(contacts, eq(customer_vehicles.contact_id, contacts.id))
      .where(eq(customer_vehicles.id, id))
      .then((r) => r[0] ?? null),
    db.select({
      id:             maintenance_records.id,
      maintenance_no: maintenance_records.maintenance_no,
      intake_date:    maintenance_records.intake_date,
      delivery_date:  maintenance_records.delivery_date,
      status:         maintenance_records.status,
      mileage:        maintenance_records.mileage,
      account:        { id: mAccount.id, name: mAccount.name },
      contact:        { id: mContact.id, full_name: mContact.full_name },
    })
      .from(maintenance_records)
      .leftJoin(mAccount, eq(maintenance_records.account_id, mAccount.id))
      .leftJoin(mContact, eq(maintenance_records.contact_id, mContact.id))
      .where(eq(maintenance_records.customer_vehicle_id, id))
      .orderBy(desc(maintenance_records.intake_date), desc(maintenance_records.created_at)),
  ])

  if (!vRow) notFound()
  const v = vRow.v
  const account = vRow.account?.id ? vRow.account : null
  const contact = vRow.contact?.id ? vRow.contact : null
  const accountIsPersonal = isPersonalAccount(account)

  // RSC は 1 リクエストにつき 1 回しか render されないため Date.now() は安定。
  // react-hooks/purity は client component 向けの規則なのでここでは無効化する。
  // eslint-disable-next-line react-hooks/purity
  const nowTime = Date.now()
  const days = v.inspection_due_date
    ? Math.ceil((new Date(v.inspection_due_date).getTime() - nowTime) / 86400000)
    : null
  const urgent = days != null && days <= 30

  async function handleDelete() {
    'use server'
    await deleteCustomerVehicle(id)
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <RecordHeader
        crumbs={[
          { label: '顧客車両', href: '/customer-vehicles' },
          { label: v.plate_number ?? v.car_model ?? '車両' },
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <Link href={`/customer-vehicles/${id}/edit`} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">✏️ 編集</Link>
              <DeleteButton action={handleDelete} confirmMessage="この顧客車両を削除しますか？" />
            </div>
          </AuthGuard>
        }
      />

      <div className="mb-4">
        <h1 className="text-2xl font-bold text-zinc-900">🚗 {v.plate_number ?? v.car_model ?? '車両'}</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {[v.car_name, v.car_model, v.grade].filter(Boolean).join(' / ') || '—'}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
          {account && !accountIsPersonal ? (
            <Link href={`/accounts/${account.id}`} className="text-blue-600 hover:underline">
              {AB_ICONS.account} {account.name}
            </Link>
          ) : contact ? (
            <Link href={`/contacts/${contact.id}`} className="text-blue-600 hover:underline">
              {AB_ICONS.contact} {contact.full_name}
            </Link>
          ) : (
            <span className="text-zinc-400">所有者未設定</span>
          )}
        </div>
      </div>

      {/* 顧客（所有者） */}
      <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">顧客（所有者）</h2>
        {(account && !accountIsPersonal) ? (
          /* BtoB: 法人取引先 */
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-zinc-400 mb-1">取引先</dt>
              <dd>
                <Link href={`/accounts/${account.id}`} className="text-blue-600 hover:underline font-medium">
                  {AB_ICONS.account} {account.name}
                </Link>
              </dd>
            </div>
            {contact && (
              <div>
                <dt className="text-xs text-zinc-400 mb-1">顧客担当者</dt>
                <dd>
                  <Link href={`/contacts/${contact.id}`} className="text-blue-600 hover:underline">
                    {AB_ICONS.contact} {contact.full_name}
                  </Link>
                </dd>
              </div>
            )}
            {(contact?.phone || account.phone) && (
              <div>
                <dt className="text-xs text-zinc-400 mb-1">電話</dt>
                <dd className="text-zinc-800">📞 {contact?.phone ?? account.phone}</dd>
              </div>
            )}
            {contact?.email && (
              <div>
                <dt className="text-xs text-zinc-400 mb-1">Email</dt>
                <dd className="text-zinc-800">✉️ {contact.email}</dd>
              </div>
            )}
            {account.address && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-zinc-400 mb-1">住所</dt>
                <dd className="text-zinc-800">📍 {account.address}</dd>
              </div>
            )}
          </dl>
        ) : contact ? (
          /* BtoC: 個人 */
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="sm:col-span-2">
              <dt className="text-xs text-zinc-400 mb-1">顧客</dt>
              <dd>
                <Link href={`/contacts/${contact.id}`} className="text-blue-600 hover:underline font-medium">
                  {AB_ICONS.contact} {contact.full_name}
                </Link>
              </dd>
            </div>
            {contact.phone && (
              <div>
                <dt className="text-xs text-zinc-400 mb-1">電話</dt>
                <dd className="text-zinc-800">📞 {contact.phone}</dd>
              </div>
            )}
            {contact.email && (
              <div>
                <dt className="text-xs text-zinc-400 mb-1">Email</dt>
                <dd className="text-zinc-800">✉️ {contact.email}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-sm text-zinc-400">所有者が設定されていません。「✏️ 編集」から取引先 または 顧客（人物）を選択してください。</p>
        )}
      </div>

      {/* ナンバープレート */}
      <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">ナンバープレート</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><dt className="text-xs text-zinc-400 mb-1">運輸支局</dt><dd className="text-sm text-zinc-800">{v.transport_branch ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">分類番号</dt><dd className="text-sm text-zinc-800">{v.classification_number ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">かな</dt><dd className="text-sm text-zinc-800">{v.kana ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">ナンバー</dt><dd className="text-sm text-zinc-800 font-medium">{v.plate_number ?? '—'}</dd></div>
        </dl>
      </div>

      {/* 車両情報 */}
      <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">車両情報</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div><dt className="text-xs text-zinc-400 mb-1">車名</dt><dd className="text-sm text-zinc-800">{v.car_name ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">車種</dt><dd className="text-sm text-zinc-800">{v.car_model ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">グレード</dt><dd className="text-sm text-zinc-800">{v.grade ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">種別</dt><dd className="text-sm text-zinc-800">{v.vehicle_kind ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">用途</dt><dd className="text-sm text-zinc-800">{v.vehicle_usage ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">自家・事業</dt><dd className="text-sm text-zinc-800">{v.private_business ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">車体の形状</dt><dd className="text-sm text-zinc-800">{v.body_shape ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">車台番号</dt><dd className="text-sm text-zinc-800 font-mono">{v.vin ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">型式</dt><dd className="text-sm text-zinc-800">{v.type_designation ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">類別区分</dt><dd className="text-sm text-zinc-800">{v.class_category ?? '—'}</dd></div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">初年度</dt>
            <dd className="text-sm text-zinc-800">{[v.first_registration_year, v.first_registration_month].filter(Boolean).join(' / ') || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">車検満了日</dt>
            <dd className={`text-sm ${urgent ? 'text-red-600 font-semibold' : 'text-zinc-800'}`}>
              {v.inspection_due_date ?? '—'}
              {days != null && <span className="ml-2 text-xs text-zinc-400">({days < 0 ? `${-days}日経過` : `あと${days}日`})</span>}
            </dd>
          </div>
        </dl>
        {v.memo && (
          <div className="mt-4 pt-4 border-t border-zinc-100">
            <dt className="text-xs text-zinc-400 mb-1">メモ</dt>
            <dd className="text-sm text-zinc-800 whitespace-pre-wrap">{v.memo}</dd>
          </div>
        )}
      </div>

      {/* 整備履歴 */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-zinc-800">
            整備履歴 <span className="text-zinc-400 font-normal text-sm">({maintenances.length})</span>
          </h2>
          <AuthGuard minRole="editor">
            <Link href={`/maintenance/new?customer_vehicle_id=${id}`} className="text-xs text-blue-600 hover:text-blue-800">
              ＋ 整備を追加
            </Link>
          </AuthGuard>
        </div>
        {maintenances.length > 0 ? (
          <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-zinc-600">整備名</th>
                  <th className="text-left px-4 py-2 font-medium text-zinc-600">整備No</th>
                  <th className="text-left px-4 py-2 font-medium text-zinc-600">入庫日</th>
                  <th className="text-left px-4 py-2 font-medium text-zinc-600">納車日</th>
                  <th className="text-left px-4 py-2 font-medium text-zinc-600">ステータス</th>
                  <th className="text-left px-4 py-2 font-medium text-zinc-600">走行距離</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {maintenances.map((m) => {
                  const acc = m.account?.id ? m.account : null
                  const con = m.contact?.id ? m.contact : null
                  // 車両は当ページの v をそのまま流用（同じ車両に紐付くため）
                  const displayName = maintenanceDisplayName(m, acc, con, { car_model: v.car_model, car_name: v.car_name })
                  return (
                    <tr key={m.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-2">
                        <Link href={`/maintenance/${m.id}`} className="text-blue-600 hover:underline break-all">{displayName}</Link>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-zinc-500">{m.maintenance_no}</td>
                      <td className="px-4 py-2 text-zinc-700">{m.intake_date ?? '—'}</td>
                      <td className="px-4 py-2 text-zinc-700">{m.delivery_date ?? '—'}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[m.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-zinc-500">
                        {m.mileage != null ? `${Number(m.mileage).toLocaleString()} km` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-zinc-400 bg-white border border-zinc-200 rounded-lg px-4 py-6 text-center">
            整備履歴がありません
          </p>
        )}
      </section>

      <div className="text-right">
        <RecordId id={id} />
      </div>
    </div>
  )
}
