import { db } from '@/lib/db'
import {
  maintenance_records, customer_vehicles, accounts, contacts,
  maintenance_line_items, maintenance_fees, maintenance_payments,
} from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import { getAllUsers } from '@/lib/userUtils'
import { isDocumentType, DOCUMENT_META } from '@/industries/auto-body/lib/documents'
import { isPersonalAccount } from '@/industries/auto-body/lib/customerDisplay'
import DocumentLayout from '@/industries/auto-body/components/documents/DocumentLayout'
import { TEMPLATES, type DocumentData } from '@/industries/auto-body/components/documents/templates'
import type { CustomerInfo } from '@/industries/auto-body/components/documents/DocumentPieces'

const TAX_RATES: Record<string, number> = {
  '税別10%': 10, '税別8%': 8, '税込10%': 10, '税込8%': 8, '非課税': 0,
}

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string; type: string }>
}) {
  if (!(await isModuleEnabled('auto-body'))) notFound()
  const { id, type } = await params
  if (!isDocumentType(type)) notFound()

  // 請求先別指定 (billing_account) のため accounts を 2 回 join
  const bAccount = alias(accounts, 'b_account')

  const [mRow, lines, fees, payments, users] = await Promise.all([
    db.select({
      m:       maintenance_records,
      vehicle: customer_vehicles,
      account: { id: accounts.id, name: accounts.name, address: accounts.address },
      contact: { id: contacts.id, full_name: contacts.full_name },
      billing: { id: bAccount.id, name: bAccount.name, address: bAccount.address },
    })
      .from(maintenance_records)
      .leftJoin(customer_vehicles, eq(maintenance_records.customer_vehicle_id, customer_vehicles.id))
      .leftJoin(accounts,  eq(maintenance_records.account_id,         accounts.id))
      .leftJoin(contacts,  eq(maintenance_records.contact_id,         contacts.id))
      .leftJoin(bAccount,  eq(maintenance_records.billing_account_id, bAccount.id))
      .where(eq(maintenance_records.id, id))
      .then((r) => r[0] ?? null),
    db.select().from(maintenance_line_items).where(eq(maintenance_line_items.maintenance_id, id))
      .orderBy(asc(maintenance_line_items.sort_order)),
    db.select().from(maintenance_fees).where(eq(maintenance_fees.maintenance_id, id))
      .orderBy(asc(maintenance_fees.sort_order)),
    db.select().from(maintenance_payments).where(eq(maintenance_payments.maintenance_id, id))
      .orderBy(asc(maintenance_payments.payment_date)),
    getAllUsers(),
  ])
  if (!mRow) notFound()

  const m       = mRow.m
  const vehicle = mRow.vehicle
  const account = mRow.account?.id ? mRow.account : null
  const contact = mRow.contact?.id ? mRow.contact : null
  const billing = mRow.billing?.id ? mRow.billing : null
  const accountIsPersonal         = isPersonalAccount(account)
  const billingIsPersonal         = isPersonalAccount(billing)

  // 顧客 (宛名) を BtoB/BtoC で組み立て
  const customer: CustomerInfo = (account && !accountIsPersonal)
    ? {
        primaryName:   account.name,
        attentionName: contact?.full_name ?? null,
        address:       account.address ?? null,
      }
    : {
        primaryName:   contact?.full_name ?? '—',
        attentionName: null,
        address:       null,
      }

  const billingCustomer: CustomerInfo | null = (billing && !billingIsPersonal && billing.id !== account?.id)
    ? {
        primaryName:   billing.name,
        attentionName: null,
        address:       billing.address ?? null,
      }
    : null

  // 担当者氏名
  const receptionName = m.reception_owner_id ? users.find((u) => u.id === m.reception_owner_id)?.name ?? '—' : '—'
  const workerName    = m.worker_owner_id    ? users.find((u) => u.id === m.worker_owner_id)?.name    ?? '—' : '—'

  // 合計計算
  let laborSum = 0, partsSum = 0
  for (const l of lines) {
    if (l.is_excluded) continue
    const labor = Number(l.labor_amount ?? 0)
    const qty   = Number(l.parts_qty ?? 0)
    const unit  = Number(l.parts_unit_price ?? 0)
    if (Number.isFinite(labor)) laborSum += labor
    if (Number.isFinite(qty) && Number.isFinite(unit)) partsSum += qty * unit
  }
  let taxableFees = 0, nontaxableFees = 0
  for (const f of fees) {
    const a = Number(f.amount ?? 0)
    if (f.category === '課税')  taxableFees    += a
    if (f.category === '非課税') nontaxableFees += a
  }
  const taxRate       = TAX_RATES[m.tax_mode ?? '税別10%'] ?? 10
  const isTaxExternal = m.tax_mode?.startsWith('税別') ?? true
  const consumptionTax = isTaxExternal ? Math.floor((laborSum + partsSum + taxableFees) * (taxRate / 100)) : 0
  const grandTotal    = laborSum + partsSum + taxableFees + consumptionTax + nontaxableFees

  const issueDate = new Date().toISOString().slice(0, 10)
  const meta      = DOCUMENT_META[type]

  const data: DocumentData = {
    maintenance: {
      id:                   m.id,
      maintenance_no:       m.maintenance_no,
      intake_date:          m.intake_date,
      intake_time:          m.intake_time,
      delivery_date:        m.delivery_date,
      delivery_time:        m.delivery_time,
      pickup_location:      m.pickup_location,
      delivery_location:    m.delivery_location,
      sales_recording_date: m.sales_recording_date,
      branch_id:            m.branch_id,
      intake_category:      m.intake_category,
      receptionName,
      workerName,
      internal_memo:        m.internal_memo,
      work_order_note:      m.work_order_note,
      general_note:         m.general_note,
      tax_mode:             m.tax_mode,
    },
    customer,
    billingCustomer,
    vehicle: {
      plate_number:     vehicle?.plate_number,
      car_name:         vehicle?.car_name,
      car_model:        vehicle?.car_model,
      grade:            vehicle?.grade,
      vin:              vehicle?.vin,
      type_designation: vehicle?.type_designation,
      mileage:          m.mileage,
    },
    lines: lines.map((l) => ({
      id:               l.id,
      work_category:    l.work_category,
      item_name:        l.item_name,
      hours:            l.hours,
      labor_amount:     l.labor_amount,
      parts_qty:        l.parts_qty,
      parts_unit:       l.parts_unit,
      parts_unit_price: l.parts_unit_price,
      note:             l.note,
      is_excluded:      l.is_excluded ?? false,
      work_status:      l.work_status,
    })),
    fees: fees.map((f) => ({
      id:        f.id,
      category:  f.category,
      item_name: f.item_name,
      amount:    f.amount,
    })),
    payments: payments.map((p) => ({
      id:             p.id,
      payment_date:   p.payment_date,
      payment_method: p.payment_method,
      amount:         p.amount,
      memo:           p.memo,
    })),
    totals: { laborSum, partsSum, taxableFees, nontaxableFees, consumptionTax, grandTotal },
    issueDate,
  }

  const Template = TEMPLATES[type]

  return (
    <DocumentLayout title={meta.label} maintenanceId={id}>
      <Template d={data} />
    </DocumentLayout>
  )
}
