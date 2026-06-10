import { db } from '@/lib/db'
import { SquarePen } from 'lucide-react'
import { customer_vehicles, accounts, contacts, maintenance_records, maintenance_line_items, attachments } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import RecordHeader from '@/components/RecordHeader'
import RecordId from '@/components/RecordId'
import AuthGuard from '@/components/AuthGuard'
import DeleteButton from '@/components/DeleteButton'
import AttachmentsSection from '@/components/AttachmentsSection'
import { uploadAttachment, deleteAttachment } from '@/app/actions/attachments'
import { deleteCustomerVehicle, updateCustomerVehicleBasic } from '@/industries/auto-body/actions/customerVehicles'
import { canEdit } from '@/lib/auth'
import EditableInfoCard from '@/components/detail/EditableInfoCard'
import { maintenanceDisplayName } from '@/industries/auto-body/lib/maintenanceDisplay'
import { isPersonalAccount } from '@/industries/auto-body/lib/customerDisplay'
import { AB_ICONS } from '@/industries/auto-body/lib/icons'
import { aggregateLatestConsumables, type LineWithMaintenance } from '@/industries/auto-body/lib/consumablesAggregate'
import { NavIcon } from '@/lib/navIcon'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

const STATUS_COLOR: Record<string, string> = {
  '予約':     'bg-zinc-100 text-zinc-700',
  '受付':     'bg-blue-50 text-blue-700',
  '作業中':   'bg-yellow-50 text-yellow-700',
  '部品待ち': 'bg-yellow-100 text-yellow-800',
  '納車待ち': 'bg-orange-50 text-orange-700',
  '完了':     'bg-green-50 text-green-700',
  'キャンセル': 'bg-red-50 text-red-700',
}

export default async function CustomerVehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // 整備一覧で displayName を組み立てるため、整備に紐付く account/contact を別名で join
  const mAccount = alias(accounts, 'm_account')
  const mContact = alias(contacts, 'm_contact')

  const [vRow, maintenances, consumableLines, attachmentRows] = await Promise.all([
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
    // 消耗品集計用: 当車両に紐づく全 line_items + 親 maintenance の日付/走行距離を join
    db.select({
      maintenance_id: maintenance_line_items.maintenance_id,
      work_category:  maintenance_line_items.work_category,
      item_name:      maintenance_line_items.item_name,
      intake_date:    maintenance_records.intake_date,
      delivery_date:  maintenance_records.delivery_date,
      mileage:        maintenance_records.mileage,
    })
      .from(maintenance_line_items)
      .innerJoin(maintenance_records, eq(maintenance_line_items.maintenance_id, maintenance_records.id))
      .where(eq(maintenance_records.customer_vehicle_id, id)),
    db.select().from(attachments).where(eq(attachments.customer_vehicle_id, id)).orderBy(desc(attachments.created_at)),
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

  // 消耗品の前回交換集計 (Phase A item 4)
  const consumables = aggregateLatestConsumables(consumableLines as LineWithMaintenance[])

  const editFlag = await canEdit()

  async function saveCustomerVehicleInline(formData: FormData) {
    'use server'
    await updateCustomerVehicleBasic(id, formData)
  }

  async function handleDelete() {
    'use server'
    await deleteCustomerVehicle(id)
  }

  // 添付ファイル用 Server Actions (id を closure に閉じ込める)
  async function uploadFile(formData: FormData) {
    'use server'
    formData.set('customer_vehicle_id', id)
    formData.set('revalidate', `/customer-vehicles/${id}`)
    await uploadAttachment(formData)
  }
  async function deleteFile(formData: FormData) {
    'use server'
    const attachId = formData.get('attach_id') as string
    const path     = formData.get('storage_path') as string
    await deleteAttachment(attachId, path, `/customer-vehicles/${id}`)
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
              <Link href={`/customer-vehicles/${id}/edit`} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"><SquarePen className="w-4 h-4 inline -mt-0.5" strokeWidth={2.25} /> 編集</Link>
              <DeleteButton action={handleDelete} confirmMessage="この顧客車両を削除しますか？" />
            </div>
          </AuthGuard>
        }
      />

      <div className="mb-4">
        <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2"><NavIcon icon="🚗" className="w-6 h-6" /> {v.plate_number ?? v.car_model ?? '車両'}</h1>
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
      <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 mb-6">
        <h2 className="text-sm font-bold text-zinc-700 mb-4">顧客（所有者）</h2>
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
                <dd className="text-zinc-800 inline-flex items-center gap-1"><NavIcon icon="📞" className="w-3.5 h-3.5 shrink-0" /> {contact?.phone ?? account.phone}</dd>
              </div>
            )}
            {contact?.email && (
              <div>
                <dt className="text-xs text-zinc-400 mb-1">Email</dt>
                <dd className="text-zinc-800 inline-flex items-center gap-1"><NavIcon icon="✉️" className="w-3.5 h-3.5 shrink-0" /> {contact.email}</dd>
              </div>
            )}
            {account.address && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-zinc-400 mb-1">住所</dt>
                <dd className="text-zinc-800 inline-flex items-center gap-1"><NavIcon icon="📍" className="w-3.5 h-3.5 shrink-0" /> {account.address}</dd>
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
                <dd className="text-zinc-800 inline-flex items-center gap-1"><NavIcon icon="📞" className="w-3.5 h-3.5 shrink-0" /> {contact.phone}</dd>
              </div>
            )}
            {contact.email && (
              <div>
                <dt className="text-xs text-zinc-400 mb-1">Email</dt>
                <dd className="text-zinc-800 inline-flex items-center gap-1"><NavIcon icon="✉️" className="w-3.5 h-3.5 shrink-0" /> {contact.email}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-sm text-zinc-400">所有者が設定されていません。「編集」から取引先 または 顧客（人物）を選択してください。</p>
        )}
      </div>

      {/* ナンバープレート */}
      <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 mb-6">
        <h2 className="text-sm font-bold text-zinc-700 mb-4">ナンバープレート</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><dt className="text-xs text-zinc-400 mb-1">運輸支局</dt><dd className="text-sm text-zinc-800">{v.transport_branch ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">分類番号</dt><dd className="text-sm text-zinc-800">{v.classification_number ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">かな</dt><dd className="text-sm text-zinc-800">{v.kana ?? '—'}</dd></div>
          <div><dt className="text-xs text-zinc-400 mb-1">ナンバー</dt><dd className="text-sm text-zinc-800 font-medium">{v.plate_number ?? '—'}</dd></div>
        </dl>
      </div>

      {/* 車両情報 */}
      <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 mb-6">
        <h2 className="text-sm font-bold text-zinc-700 mb-4">車両情報</h2>
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
        </dl>
        <p className="mt-4 pt-3 border-t border-zinc-100 text-xs text-zinc-400">登記情報の編集は右上「編集」から行えます。</p>
      </div>

      {/* 車検・メモ（インライン編集） */}
      <EditableInfoCard
        title="車検・メモ"
        canEdit={editFlag}
        editEvent="bract:edit-customer-vehicle"
        action={saveCustomerVehicleInline}
        fields={[
          { label: '車検満了日', name: 'inspection_due_date', kind: 'date', value: v.inspection_due_date ? String(v.inspection_due_date).slice(0, 10) : '',
            view: <span className={urgent ? 'text-red-600 font-semibold' : ''}>{v.inspection_due_date ?? '—'}{days != null && <span className="ml-2 text-xs text-zinc-400">({days < 0 ? `${-days}日経過` : `あと${days}日`})</span>}</span> },
          { label: 'メモ', name: 'memo', kind: 'textarea', value: v.memo, fullWidth: true, view: v.memo ? v.memo : <span className="text-zinc-300">—</span> },
        ]}
      />

      {/* 添付ファイル (画像/PDF/書類など、車両に紐付くもの) */}
      <AttachmentsSection
        attachments={attachmentRows}
        supabaseUrl={SUPABASE_URL}
        uploadAction={uploadFile}
        deleteAction={deleteFile}
        heading="車両の添付ファイル"
      />

      {/* 消耗品の前回交換 (Phase A item 4) */}
      <section className="mb-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-800 mb-3">
          <NavIcon icon="🧰" className="w-4 h-4" />消耗品の前回交換 <span className="text-zinc-400 font-normal text-sm">({consumables.length})</span>
        </h2>
        {consumables.length > 0 ? (
          <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {consumables.map((c) => (
              <Link
                key={c.categoryId}
                href={`/maintenance/${c.maintenanceId}`}
                className="block p-3 rounded-md border border-zinc-100 hover:border-blue-300 hover:bg-blue-50/30 transition"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{c.icon}</span>
                  <span className="text-xs font-medium text-zinc-700">{c.label}</span>
                </div>
                <div className="text-sm text-zinc-800 font-semibold">
                  {c.date ?? '—'}
                </div>
                {c.mileage != null && (
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {c.mileage.toLocaleString()} km
                  </div>
                )}
                {c.itemName && (
                  <div className="text-[10px] text-zinc-400 mt-0.5 truncate" title={c.itemName}>
                    {c.itemName}
                  </div>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-400 bg-white border border-zinc-200 rounded-lg px-4 py-4 text-center">
            該当する消耗品の交換履歴がありません
          </p>
        )}
      </section>

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
