import { db } from '@/lib/db'
import { customer_vehicles, accounts, contacts, maintenance_records, maintenance_line_items, attachments } from '@/lib/schema'
import { eq, desc, asc } from 'drizzle-orm'
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
import { getAllUsers } from '@/lib/userUtils'
import EditableInfoCard from '@/components/detail/EditableInfoCard'
import InlineEditButton from '@/components/detail/InlineEditButton'
import { maintenanceDisplayName } from '@/industries/auto-body/lib/maintenanceDisplay'
import { isPersonalAccount } from '@/industries/auto-body/lib/customerDisplay'
import { AB_ICONS } from '@/industries/auto-body/lib/icons'
import { aggregateLatestConsumables, type LineWithMaintenance } from '@/industries/auto-body/lib/consumablesAggregate'
import { NavIcon } from '@/lib/navIcon'
import { Car, CalendarClock, Wrench, Boxes, Paperclip } from 'lucide-react'
import { RecordColumns, KpiBand, RefCard, Badge, RecordTable, RecordTableEmpty, type KpiItem, type BadgeTone } from '@/components/record/RecordUI'
import RecordTabPanel from '@/components/record/RecordTabPanel'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

const STATUS_TONE: Record<string, BadgeTone> = {
  '予約': 'neutral', '受付': 'info', '作業中': 'warn', '部品待ち': 'warn', '納車待ち': 'warn', '完了': 'pos', 'キャンセル': 'danger',
}

export default async function CustomerVehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const mAccount = alias(accounts, 'm_account')
  const mContact = alias(contacts, 'm_contact')

  const [vRow, maintenances, consumableLines, attachmentRows, accountsList, contactsList, users] = await Promise.all([
    db.select({
      v: customer_vehicles,
      account: { id: accounts.id, name: accounts.name, phone: accounts.phone, address: accounts.address },
      contact: { id: contacts.id, full_name: contacts.full_name, email: contacts.email, phone: contacts.phone },
    })
      .from(customer_vehicles).leftJoin(accounts, eq(customer_vehicles.account_id, accounts.id)).leftJoin(contacts, eq(customer_vehicles.contact_id, contacts.id)).where(eq(customer_vehicles.id, id)).then((r) => r[0] ?? null),
    db.select({ id: maintenance_records.id, maintenance_no: maintenance_records.maintenance_no, intake_date: maintenance_records.intake_date, delivery_date: maintenance_records.delivery_date, status: maintenance_records.status, mileage: maintenance_records.mileage, account: { id: mAccount.id, name: mAccount.name }, contact: { id: mContact.id, full_name: mContact.full_name } })
      .from(maintenance_records).leftJoin(mAccount, eq(maintenance_records.account_id, mAccount.id)).leftJoin(mContact, eq(maintenance_records.contact_id, mContact.id)).where(eq(maintenance_records.customer_vehicle_id, id)).orderBy(desc(maintenance_records.intake_date), desc(maintenance_records.created_at)),
    db.select({ maintenance_id: maintenance_line_items.maintenance_id, work_category: maintenance_line_items.work_category, item_name: maintenance_line_items.item_name, intake_date: maintenance_records.intake_date, delivery_date: maintenance_records.delivery_date, mileage: maintenance_records.mileage })
      .from(maintenance_line_items).innerJoin(maintenance_records, eq(maintenance_line_items.maintenance_id, maintenance_records.id)).where(eq(maintenance_records.customer_vehicle_id, id)),
    db.select().from(attachments).where(eq(attachments.customer_vehicle_id, id)).orderBy(desc(attachments.created_at)),
    db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    db.select({ id: contacts.id, full_name: contacts.full_name }).from(contacts).orderBy(asc(contacts.full_name)),
    getAllUsers(),
  ])

  if (!vRow) notFound()
  const v = vRow.v
  const account = vRow.account?.id ? vRow.account : null
  const contact = vRow.contact?.id ? vRow.contact : null
  const accountIsPersonal = isPersonalAccount(account)
  const ownerName = v.owner_id ? (users.find((u) => u.id === v.owner_id)?.name ?? null) : null
  const accountOptions = accountsList.map((a) => ({ value: a.id, label: a.name }))
  const contactOptions = contactsList.map((c) => ({ value: c.id, label: c.full_name }))
  const userOptions = users.map((u) => ({ value: u.id, label: u.name }))

  // eslint-disable-next-line react-hooks/purity
  const nowTime = Date.now()
  const days = v.inspection_due_date ? Math.ceil((new Date(v.inspection_due_date).getTime() - nowTime) / 86400000) : null
  const urgent = days != null && days <= 30
  const consumables = aggregateLatestConsumables(consumableLines as LineWithMaintenance[])
  const editFlag = await canEdit()

  async function saveCustomerVehicleInline(formData: FormData) { 'use server'; await updateCustomerVehicleBasic(id, formData) }
  async function handleDelete() { 'use server'; await deleteCustomerVehicle(id) }
  async function uploadFile(formData: FormData) { 'use server'; formData.set('customer_vehicle_id', id); formData.set('revalidate', `/customer-vehicles/${id}`); await uploadAttachment(formData) }
  async function deleteFile(formData: FormData) { 'use server'; await deleteAttachment(formData.get('attach_id') as string, formData.get('storage_path') as string, `/customer-vehicles/${id}`) }

  const kpis: KpiItem[] = [
    { icon: <CalendarClock />, label: '車検満了', value: <span className="text-[17px]">{v.inspection_due_date ?? '—'}</span>, sub: days != null ? (days < 0 ? `${-days}日経過` : `あと${days}日`) : '—', subTone: urgent ? 'warn' : 'mut' },
    { icon: <Wrench />, label: '整備履歴', value: <>{maintenances.length}<small> 件</small></>, sub: '入庫実績' },
    { icon: <Boxes />, label: '消耗品', value: <>{consumables.length}<small> 種</small></>, sub: '前回交換' },
  ]

  const maintTab = maintenances.length === 0 ? <RecordTableEmpty>整備履歴がありません</RecordTableEmpty> : (
    <>
      <div className="flex justify-end px-4 py-2"><AuthGuard minRole="editor"><Link href={`/maintenance/new?customer_vehicle_id=${id}`} className="text-xs text-brand-700 font-semibold hover:text-brand-800">＋ 整備を追加</Link></AuthGuard></div>
      <RecordTable columns={[{ label: '整備名' }, { label: '整備No' }, { label: '入庫日' }, { label: '状態' }, { label: '走行', num: true }]}>
        {maintenances.map((m) => {
          const acc = m.account?.id ? m.account : null
          const con = m.contact?.id ? m.contact : null
          const displayName = maintenanceDisplayName(m, acc, con, { car_model: v.car_model, car_name: v.car_name })
          return (
            <tr key={m.id} className="hover:bg-zinc-50">
              <td className="px-4 py-2.5 border-b border-zinc-100 font-semibold text-zinc-900"><Link href={`/maintenance/${m.id}`} className="hover:text-brand-700 break-all">{displayName}</Link></td>
              <td className="px-4 py-2.5 border-b border-zinc-100 font-mono text-xs text-zinc-500">{m.maintenance_no}</td>
              <td className="px-4 py-2.5 border-b border-zinc-100 text-zinc-700">{m.intake_date ?? '—'}</td>
              <td className="px-4 py-2.5 border-b border-zinc-100"><Badge tone={STATUS_TONE[m.status] ?? 'neutral'}>{m.status}</Badge></td>
              <td className="px-4 py-2.5 border-b border-zinc-100 text-right tabular-nums text-zinc-500">{m.mileage != null ? `${Number(m.mileage).toLocaleString()} km` : '—'}</td>
            </tr>
          )
        })}
      </RecordTable>
    </>
  )

  const filesTab = (
    <div className="px-4 py-3">
      <AttachmentsSection attachments={attachmentRows} supabaseUrl={SUPABASE_URL} uploadAction={uploadFile} deleteAction={deleteFile} heading="車両の添付ファイル" />
    </div>
  )

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <RecordHeader
        crumbs={[{ label: '顧客車両', href: '/customer-vehicles' }, { label: v.plate_number ?? v.car_model ?? '車両' }]}
        avatar={<Car className="w-6 h-6" strokeWidth={2.25} aria-hidden />}
        title={v.plate_number ?? v.car_model ?? '車両'}
        badges={v.inspection_due_date ? <Badge tone={days != null && days < 0 ? 'danger' : urgent ? 'warn' : 'pos'} dot>{days != null && days < 0 ? '車検切れ' : urgent ? '車検間近' : '車検有効'}</Badge> : undefined}
        meta={[
          ...([v.car_name, v.car_model, v.grade].filter(Boolean).length > 0 ? [{ value: [v.car_name, v.car_model, v.grade].filter(Boolean).join(' / ') }] : []),
          ...(account && !accountIsPersonal ? [{ icon: AB_ICONS.account, value: <Link href={`/accounts/${account.id}`} className="text-brand-700 hover:underline">{account.name}</Link> }] : contact ? [{ icon: AB_ICONS.contact, value: <Link href={`/contacts/${contact.id}`} className="text-brand-700 hover:underline">{contact.full_name}</Link> }] : []),
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <InlineEditButton event="bract:edit-customer-vehicle" />
              <DeleteButton action={handleDelete} confirmMessage="この顧客車両を削除しますか？" />
            </div>
          </AuthGuard>
        }
      />

      <KpiBand items={kpis} />

      <RecordColumns
        left={
          <>
            <EditableInfoCard
              title="顧客車両（全項目）"
              dense
              canEdit={editFlag}

              editEvent="bract:edit-customer-vehicle"
              action={saveCustomerVehicleInline}
              fields={[
                { section: '顧客・所有者', label: '取引先', name: 'account_id', kind: 'select', value: v.account_id ?? '', options: accountOptions, view: account && !accountIsPersonal ? <Link href={`/accounts/${account.id}`} className="text-brand-700 hover:underline">{AB_ICONS.account} {account.name}</Link> : <span className="text-zinc-300">—</span> },
                { section: '顧客・所有者', label: '顧客（人物）', name: 'contact_id', kind: 'select', value: v.contact_id ?? '', options: contactOptions, view: contact ? <Link href={`/contacts/${contact.id}`} className="text-brand-700 hover:underline">{AB_ICONS.contact} {contact.full_name}</Link> : <span className="text-zinc-300">—</span> },
                { section: '顧客・所有者', label: '社内担当', name: 'owner_id', kind: 'select', value: v.owner_id ?? '', options: userOptions, view: ownerName ?? <span className="text-zinc-300">—</span> },
                { section: '顧客・所有者', label: '連絡先', fullWidth: true, view: (contact?.phone ?? account?.phone) || contact?.email || account?.address ? (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-700">
                    {(contact?.phone ?? account?.phone) && <span className="inline-flex items-center gap-1"><NavIcon icon="📞" className="w-3.5 h-3.5 shrink-0" /> {contact?.phone ?? account?.phone}</span>}
                    {contact?.email && <span className="inline-flex items-center gap-1"><NavIcon icon="✉️" className="w-3.5 h-3.5 shrink-0" /> {contact.email}</span>}
                    {account?.address && <span className="inline-flex items-center gap-1"><NavIcon icon="📍" className="w-3.5 h-3.5 shrink-0" /> {account.address}</span>}
                  </div>
                ) : <span className="text-zinc-400">—</span> },
                { section: '車両登録情報', label: '運輸支局', name: 'transport_branch', kind: 'text', value: v.transport_branch, view: v.transport_branch ?? '—' },
                { section: '車両登録情報', label: '分類番号', name: 'classification_number', kind: 'text', value: v.classification_number, view: v.classification_number ?? '—' },
                { section: '車両登録情報', label: 'かな', name: 'kana', kind: 'text', value: v.kana, view: v.kana ?? '—' },
                { section: '車両登録情報', label: 'ナンバー', name: 'plate_number', kind: 'text', value: v.plate_number, view: v.plate_number ? <span className="font-medium">{v.plate_number}</span> : '—' },
                { section: '車両登録情報', label: '車名', name: 'car_name', kind: 'text', value: v.car_name, view: v.car_name ?? '—' },
                { section: '車両登録情報', label: '車種', name: 'car_model', kind: 'text', value: v.car_model, view: v.car_model ?? '—' },
                { section: '車両登録情報', label: 'グレード', name: 'grade', kind: 'text', value: v.grade, view: v.grade ?? '—' },
                { section: '車両登録情報', label: '種別', name: 'vehicle_kind', kind: 'text', value: v.vehicle_kind, view: v.vehicle_kind ?? '—' },
                { section: '車両登録情報', label: '用途', name: 'vehicle_usage', kind: 'text', value: v.vehicle_usage, view: v.vehicle_usage ?? '—' },
                { section: '車両登録情報', label: '自家・事業', name: 'private_business', kind: 'text', value: v.private_business, view: v.private_business ?? '—' },
                { section: '車両登録情報', label: '車体の形状', name: 'body_shape', kind: 'text', value: v.body_shape, view: v.body_shape ?? '—' },
                { section: '車両登録情報', label: '車台番号', name: 'vin', kind: 'text', value: v.vin, view: v.vin ? <span className="font-mono">{v.vin}</span> : '—' },
                { section: '車両登録情報', label: '型式', name: 'type_designation', kind: 'text', value: v.type_designation, view: v.type_designation ?? '—' },
                { section: '車両登録情報', label: '類別区分', name: 'class_category', kind: 'text', value: v.class_category, view: v.class_category ?? '—' },
                { section: '車両登録情報', label: '初年度（年）', name: 'first_registration_year', kind: 'number', value: v.first_registration_year != null ? String(v.first_registration_year) : '', view: v.first_registration_year ?? '—' },
                { section: '車両登録情報', label: '初年度（月）', name: 'first_registration_month', kind: 'number', value: v.first_registration_month != null ? String(v.first_registration_month) : '', view: v.first_registration_month ?? '—' },
                { section: '車両登録情報', label: '車検満了日', name: 'inspection_due_date', kind: 'date', value: v.inspection_due_date ? String(v.inspection_due_date).slice(0, 10) : '', view: <span className={urgent ? 'text-rose-600 font-semibold' : ''}>{v.inspection_due_date ?? '—'}{days != null && <span className="ml-2 text-xs text-zinc-400">({days < 0 ? `${-days}日経過` : `あと${days}日`})</span>}</span> },
                { section: 'メモ', label: 'メモ', name: 'memo', kind: 'textarea', value: v.memo, fullWidth: true, view: v.memo ? v.memo : <span className="text-zinc-300">—</span> },
              ]}
            />

            {consumables.length > 0 && (
              <RefCard title="消耗品の前回交換" icon={<NavIcon icon="🧰" className="w-4 h-4" />}>
                <div className="grid grid-cols-2 gap-2">
                  {consumables.map((c) => (
                    <Link key={c.categoryId} href={`/maintenance/${c.maintenanceId}`} className="block p-2.5 rounded-md border border-zinc-100 hover:border-brand-300 hover:bg-brand-50/30 transition">
                      <div className="flex items-center gap-1.5 mb-0.5"><span className="text-sm">{c.icon}</span><span className="text-[11px] font-medium text-zinc-700">{c.label}</span></div>
                      <div className="text-[13px] text-zinc-800 font-semibold">{c.date ?? '—'}</div>
                      {c.mileage != null && <div className="text-[11px] text-zinc-500">{c.mileage.toLocaleString()} km</div>}
                    </Link>
                  ))}
                </div>
              </RefCard>
            )}
          </>
        }
      >
        <RecordTabPanel
          tabs={[
            { id: 'maint', label: '整備履歴', icon: <Wrench />, count: maintenances.length, content: maintTab },
            { id: 'files', label: '添付', icon: <Paperclip />, count: attachmentRows.length, content: filesTab },
          ]}
        />
        <div className="mt-4 text-right"><RecordId id={id} /></div>
      </RecordColumns>
    </div>
  )
}
