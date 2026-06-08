import { db } from '@/lib/db'
import { maintenance_records, customer_vehicles, accounts, contacts } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import { DOCUMENT_TYPES } from '@/industries/auto-body/lib/documents'
import { maintenanceDisplayName } from '@/industries/auto-body/lib/maintenanceDisplay'
import Breadcrumbs from '@/components/Breadcrumbs'

export default async function DocumentsIndexPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  if (!(await isModuleEnabled('auto-body'))) notFound()
  const { id } = await params

  const mRow = await db.select({
    m:       maintenance_records,
    vehicle: customer_vehicles,
    account: { id: accounts.id, name: accounts.name },
    contact: { id: contacts.id, full_name: contacts.full_name },
  })
    .from(maintenance_records)
    .leftJoin(customer_vehicles, eq(maintenance_records.customer_vehicle_id, customer_vehicles.id))
    .leftJoin(accounts,          eq(maintenance_records.account_id,         accounts.id))
    .leftJoin(contacts,          eq(maintenance_records.contact_id,         contacts.id))
    .where(eq(maintenance_records.id, id))
    .then((r) => r[0] ?? null)
  if (!mRow) notFound()

  const m       = mRow.m
  const displayName = maintenanceDisplayName(m, mRow.account?.id ? mRow.account : null, mRow.contact?.id ? mRow.contact : null, mRow.vehicle)

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <Breadcrumbs items={[
        { label: '整備', href: '/maintenance' },
        { label: displayName, href: `/maintenance/${id}` },
        { label: '帳票' },
      ]} />
      <h1 className="text-2xl font-bold text-zinc-900 mt-2 mb-1">帳票印刷</h1>
      <p className="text-sm text-zinc-500 mb-6">
        整備: <span className="font-mono">{m.maintenance_no}</span> ／ 任意の帳票をクリックすると印刷プレビューが開きます
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {DOCUMENT_TYPES.map((d) => (
          <Link
            key={d.type}
            href={`/maintenance/${id}/documents/${d.type}`}
            target="_blank"
            className="block bg-white border border-zinc-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-sm transition-all group"
          >
            <div className="flex items-start gap-3">
              <div className="text-2xl">{d.icon ?? '📄'}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-800 group-hover:text-blue-700">{d.label}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{d.description}</p>
              </div>
              <span className="text-zinc-300 group-hover:text-blue-600 text-sm shrink-0">→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
