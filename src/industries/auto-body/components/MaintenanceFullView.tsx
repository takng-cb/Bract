/**
 * 整備の「全体」ビュー。
 *
 * レイアウト（#整備レイアウト改修）:
 *   - 上段に 顧客・車両 / 代車 / 合計 の 3 カードを横並び（旧・左 sticky パネルを上へ移設）
 *   - その下に 整備 → 損傷 → 作業項目 → 諸費用/請求支払/入金 を全幅で縦積み
 *
 * 編集 UX:
 *   - フィールド系（整備 / 顧客・車両 / 代車 / 請求・支払 / 損傷）は InlineSection で
 *     「閲覧⇄編集」をその場トグル（他ブックの EditableInfoCard と同じ作法）。
 *   - 明細系（作業項目 / 諸費用 / 入金）は専用エディタ（ステージング表）を直接表示する。
 */
import { db } from '@/lib/db'
import {
  maintenance_records, customer_vehicles, accounts, contacts,
  maintenance_line_items, maintenance_fees, maintenance_payments,
  maintenance_damage_pins, vehicles,
} from '@/lib/schema'
import { eq, or, asc } from 'drizzle-orm'
import Link from 'next/link'
import { AB_ICONS, STATUS_PALETTE } from '@/industries/auto-body/lib/icons'
import { isPersonalAccount } from '@/industries/auto-body/lib/customerDisplay'
import { DOCUMENT_TYPES } from '@/industries/auto-body/lib/documents'
import { canEdit } from '@/lib/auth'
import InlineSection from './InlineSection'
import MaintenanceLineItemsEditor from './MaintenanceLineItemsEditor'
import MaintenanceFeesEditor from './MaintenanceFeesEditor'
import MaintenancePaymentsEditor from './MaintenancePaymentsEditor'
import MaintenanceBillingEditForm from './MaintenanceBillingEditForm'
import MaintenanceDamageMap from './MaintenanceDamageMap'
import MaintenanceDamageMapPreview from './MaintenanceDamageMapPreview'
import MaintenanceCustomerVehicleEditForm from './MaintenanceCustomerVehicleEditForm'
import MaintenanceBasicInfoEditForm from './MaintenanceBasicInfoEditForm'
import MaintenanceLoanerEditForm from './MaintenanceLoanerEditForm'
import StageBar, { type StageConfig } from '@/components/StageBar'
import { updateMaintenanceStatus } from '@/industries/auto-body/actions/maintenance'
import { NavIcon } from '@/lib/navIcon'

const STATUS_STAGES: StageConfig[] = [
  { value: '予約',     label: '予約',     activeColor: STATUS_PALETTE['予約'].activeColor,    pastColor: STATUS_PALETTE['予約'].pastColor },
  { value: '受付',     label: '受付',     activeColor: STATUS_PALETTE['受付'].activeColor,    pastColor: STATUS_PALETTE['受付'].pastColor },
  { value: '作業中',   label: '作業中',   activeColor: STATUS_PALETTE['作業中'].activeColor,  pastColor: STATUS_PALETTE['作業中'].pastColor },
  { value: '部品待ち', label: '部品待ち', activeColor: STATUS_PALETTE['部品待ち'].activeColor,pastColor: STATUS_PALETTE['部品待ち'].pastColor },
  { value: '納車待ち', label: '納車待ち', activeColor: STATUS_PALETTE['納車待ち'].activeColor,pastColor: STATUS_PALETTE['納車待ち'].pastColor },
  { value: '完了',     label: '完了 ✓',   activeColor: STATUS_PALETTE['完了'].activeColor,    pastColor: STATUS_PALETTE['完了'].pastColor },
]

type Props = {
  maintenanceId: string
  users: { id: string; name: string }[]
}

const TAX_RATES: Record<string, number> = {
  '税別10%': 10, '税別8%': 8, '税込10%': 10, '税込8%': 8, '非課税': 0,
}

function yen(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return `¥${Math.round(Number(n)).toLocaleString()}`
}

export default async function MaintenanceFullView({ maintenanceId, users }: Props) {
  // 1 回目のクエリ群: 整備本体 + 関連情報を取得（loaner_vehicle_id を含む）
  const [mRow, lines, fees, payments, damagePins, editable, vehiclesList, accountsList, contactsList] = await Promise.all([
    db.select({
      m:       maintenance_records,
      vehicle: customer_vehicles,
      account: { id: accounts.id, name: accounts.name, phone: accounts.phone, address: accounts.address },
      contact: { id: contacts.id, full_name: contacts.full_name, email: contacts.email, phone: contacts.phone },
    })
      .from(maintenance_records)
      .leftJoin(customer_vehicles, eq(maintenance_records.customer_vehicle_id, customer_vehicles.id))
      .leftJoin(accounts, eq(maintenance_records.account_id, accounts.id))
      .leftJoin(contacts, eq(maintenance_records.contact_id, contacts.id))
      .where(eq(maintenance_records.id, maintenanceId))
      .then((r) => r[0] ?? null),
    db.select().from(maintenance_line_items)
      .where(eq(maintenance_line_items.maintenance_id, maintenanceId))
      .orderBy(asc(maintenance_line_items.sort_order)),
    db.select().from(maintenance_fees)
      .where(eq(maintenance_fees.maintenance_id, maintenanceId))
      .orderBy(asc(maintenance_fees.sort_order)),
    db.select().from(maintenance_payments)
      .where(eq(maintenance_payments.maintenance_id, maintenanceId))
      .orderBy(asc(maintenance_payments.payment_date)),
    db.select().from(maintenance_damage_pins)
      .where(eq(maintenance_damage_pins.maintenance_id, maintenanceId))
      .orderBy(asc(maintenance_damage_pins.view), asc(maintenance_damage_pins.sort_order)),
    canEdit(),
    // 顧客・車両 編集モーダル用ピッカーデータ
    // プレビュー表示で詳細を出すため、選択用フィールドだけでなく
    // 連絡先・住所・車検満了など主要フィールドも合わせて取得
    db.select({
      id:                  customer_vehicles.id,
      plate_number:        customer_vehicles.plate_number,
      car_name:            customer_vehicles.car_name,
      car_model:           customer_vehicles.car_model,
      grade:               customer_vehicles.grade,
      vehicle_kind:        customer_vehicles.vehicle_kind,
      body_shape:          customer_vehicles.body_shape,
      vin:                 customer_vehicles.vin,
      type_designation:    customer_vehicles.type_designation,
      inspection_due_date: customer_vehicles.inspection_due_date,
      account_id:          customer_vehicles.account_id,
      contact_id:          customer_vehicles.contact_id,
    })
      .from(customer_vehicles)
      .orderBy(asc(customer_vehicles.plate_number)),
    db.select({
      id:       accounts.id,
      name:     accounts.name,
      phone:    accounts.phone,
      address:  accounts.address,
      industry: accounts.industry,
      website:  accounts.website,
    })
      .from(accounts)
      .where(eq(accounts.status, 'active'))
      .orderBy(asc(accounts.name)),
    db.select({
      id:         contacts.id,
      full_name:  contacts.full_name,
      account_id: contacts.account_id,
      email:      contacts.email,
      phone:      contacts.phone,
      title:      contacts.title,
      department: contacts.department,
    })
      .from(contacts)
      .orderBy(asc(contacts.full_name)),
  ])

  // 顧客車両ピッカー用ラベル整形（追加詳細は別途渡す）
  const vehicleOptions = vehiclesList.map((v) => ({
    id:                  v.id,
    label:               [v.plate_number ?? '—', v.car_model].filter(Boolean).join(' / ') || '車両',
    account_id:          v.account_id,
    contact_id:          v.contact_id,
    plate_number:        v.plate_number,
    car_name:            v.car_name,
    car_model:           v.car_model,
    grade:               v.grade,
    vehicle_kind:        v.vehicle_kind,
    body_shape:          v.body_shape,
    vin:                 v.vin,
    type_designation:    v.type_designation,
    inspection_due_date: v.inspection_due_date,
  }))

  if (!mRow) return null
  const m = mRow.m
  const v = mRow.vehicle
  const account = mRow.account?.id ? mRow.account : null
  const contact = mRow.contact?.id ? mRow.contact : null

  // 代車選択肢: 在庫車両 + 現在この整備に割当中の代車（リストから消えないように）
  const loanerVehicleOptions = await db.select({
    id:            vehicles.id,
    maker:         vehicles.maker,
    model:         vehicles.model,
    license_plate: vehicles.license_plate,
    status:        vehicles.status,
  })
    .from(vehicles)
    .where(
      m.loaner_vehicle_id
        ? or(eq(vehicles.status, '在庫'), eq(vehicles.id, m.loaner_vehicle_id))
        : eq(vehicles.status, '在庫'),
    )
    .orderBy(asc(vehicles.license_plate))

  // 現在の代車情報（表示用）
  const currentLoaner = m.loaner_vehicle_id
    ? loanerVehicleOptions.find((vh) => vh.id === m.loaner_vehicle_id) ?? null
    : null

  // 取引先が「個人」プレースホルダ or 未設定なら ToC 扱いで顧客名は contact を主とする
  const accountIsPersonal = isPersonalAccount(account)

  // 請求先（別途指定されていれば accountsList から名前を引く）
  const billingAccount = m.billing_account_id
    ? accountsList.find((a) => a.id === m.billing_account_id) ?? null
    : null
  const billingAccountIsPersonal = isPersonalAccount(billingAccount)

  const receptionName = m.reception_owner_id ? users.find((u) => u.id === m.reception_owner_id)?.name ?? '—' : '—'
  const workerName    = m.worker_owner_id    ? users.find((u) => u.id === m.worker_owner_id)?.name    ?? '—' : '—'

  // ─── 集計 ──────────────────────────────────────
  let laborSum = 0, partsSum = 0, partsCost = 0
  for (const l of lines) {
    if (l.is_excluded) continue
    const labor = Number(l.labor_amount ?? 0)
    const qty   = Number(l.parts_qty ?? 0)
    const unit  = Number(l.parts_unit_price ?? 0)
    const cost  = Number(l.cost_unit_price ?? 0)
    if (Number.isFinite(labor)) laborSum += labor
    if (Number.isFinite(qty) && Number.isFinite(unit)) partsSum += qty * unit
    if (Number.isFinite(qty) && Number.isFinite(cost)) partsCost += qty * cost
  }
  const linesTotal = laborSum + partsSum

  let taxableFees = 0, nontaxableFees = 0
  for (const f of fees) {
    const a = Number(f.amount ?? 0)
    if (f.category === '課税') {
      if (Number.isFinite(a)) taxableFees += a
    } else if (f.category === '非課税') {
      if (Number.isFinite(a)) nontaxableFees += a
    }
  }

  const taxRate = TAX_RATES[m.tax_mode ?? '税別10%'] ?? 10
  const isTaxExternal = m.tax_mode?.startsWith('税別')
  const consumptionTax = isTaxExternal
    ? Math.floor((linesTotal + taxableFees) * (taxRate / 100))
    : 0
  const grandTotal = linesTotal + taxableFees + consumptionTax + nontaxableFees

  const paidSum = payments.reduce((acc, p) => acc + Number(p.amount ?? 0), 0)
  const balance = grandTotal - paidSum

  const grossProfit = linesTotal - partsCost
  // 計算結果を子コンポーネント (payments editor) で参照する用
  const invoiceTotal = linesTotal + taxableFees + nontaxableFees

  async function changeStatus(status: string) {
    'use server'
    await updateMaintenanceStatus(maintenanceId, status)
  }

  // ════════════════════════════════════════════════
  //  各セクションの閲覧ビュー
  // ════════════════════════════════════════════════

  const customerVehicleView = (
    <>
      {/* 顧客 */}
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">顧客</p>
      {(account && !accountIsPersonal) ? (
        <>
          <p className="text-[10px] text-zinc-500 mb-0.5">取引先</p>
          <Link href={`/accounts/${account.id}`} className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline">
            {AB_ICONS.account} {account.name}
          </Link>
          {contact && (
            <>
              <p className="text-[10px] text-zinc-500 mt-2 mb-0.5">顧客担当者</p>
              <Link href={`/contacts/${contact.id}`} className="text-xs text-zinc-700 hover:text-blue-700 hover:underline">
                {AB_ICONS.contact} {contact.full_name}
              </Link>
            </>
          )}
          <dl className="space-y-1 text-xs mt-2">
            {(contact?.phone || account.phone) && (
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500 shrink-0 inline-flex items-center gap-1"><NavIcon icon="📞" className="w-3 h-3 shrink-0" /> 電話</dt>
                <dd className="text-zinc-800 text-right truncate">{contact?.phone ?? account.phone}</dd>
              </div>
            )}
            {contact?.email && (
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500 shrink-0 inline-flex items-center gap-1"><NavIcon icon="✉️" className="w-3 h-3 shrink-0" /> Email</dt>
                <dd className="text-zinc-800 text-right truncate">{contact.email}</dd>
              </div>
            )}
            {account.address && (
              <div>
                <dt className="text-zinc-500 text-[10px] inline-flex items-center gap-1"><NavIcon icon="📍" className="w-2.5 h-2.5 shrink-0" /> 住所</dt>
                <dd className="text-zinc-700 text-[11px] mt-0.5 wrap-break-word">{account.address}</dd>
              </div>
            )}
          </dl>
        </>
      ) : contact ? (
        <>
          <p className="text-[10px] text-zinc-500 mb-0.5">顧客</p>
          <Link href={`/contacts/${contact.id}`} className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline">
            {AB_ICONS.contact} {contact.full_name}
          </Link>
          <dl className="space-y-1 text-xs mt-2">
            {contact.phone && (
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500 shrink-0 inline-flex items-center gap-1"><NavIcon icon="📞" className="w-3 h-3 shrink-0" /> 電話</dt>
                <dd className="text-zinc-800 text-right truncate">{contact.phone}</dd>
              </div>
            )}
            {contact.email && (
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500 shrink-0 inline-flex items-center gap-1"><NavIcon icon="✉️" className="w-3 h-3 shrink-0" /> Email</dt>
                <dd className="text-zinc-800 text-right truncate">{contact.email}</dd>
              </div>
            )}
          </dl>
        </>
      ) : (
        <p className="text-xs text-zinc-400">—</p>
      )}

      {/* 請求先（別途指定 かつ 個人プレースホルダでない場合のみ表示） */}
      {billingAccount && !billingAccountIsPersonal && billingAccount.id !== account?.id && (
        <div className="mt-3 pt-2 border-t border-zinc-100">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">請求先（別指定）</p>
          <Link href={`/accounts/${billingAccount.id}`} className="text-xs text-blue-600 hover:text-blue-800 hover:underline">
            {AB_ICONS.account} {billingAccount.name}
          </Link>
        </div>
      )}

      {/* 車両 */}
      <div className="mt-3 pt-3 border-t border-zinc-200">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">車両</p>
        {v ? (
          <>
            <Link href={`/customer-vehicles/${v.id}`} className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline">
              {AB_ICONS.customerVehicle} {v.plate_number ?? '—'}
            </Link>
            <p className="text-xs text-zinc-600 mt-1">{[v.car_name, v.car_model, v.grade].filter(Boolean).join(' / ') || '—'}</p>
            <dl className="space-y-1 text-xs mt-2">
              {v.vin && <KV label="車台番号" value={v.vin} />}
              {v.type_designation && <KV label="型式" value={v.type_designation} />}
              {(v.first_registration_year || v.first_registration_month) && (
                <KV label="初年度" value={[v.first_registration_year, v.first_registration_month].filter(Boolean).join('/')} />
              )}
              {v.inspection_due_date && (
                <KV label={`${AB_ICONS.warning} 車検満了`} value={v.inspection_due_date} />
              )}
            </dl>
            {v.memo && <p className="text-[11px] text-zinc-500 mt-2 whitespace-pre-wrap bg-zinc-50 rounded p-2 flex items-start gap-1"><NavIcon icon="📝" className="w-3 h-3 shrink-0 mt-0.5" /> {v.memo}</p>}
          </>
        ) : <p className="text-xs text-zinc-400">—</p>}
      </div>
    </>
  )

  const loanerView = currentLoaner ? (
    <>
      <Link href={`/vehicles/${currentLoaner.id}`} className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1">
        <NavIcon icon="🚙" className="w-3.5 h-3.5 shrink-0" /> {currentLoaner.license_plate ?? '—'}
      </Link>
      <p className="text-xs text-zinc-600 mt-1">
        {[currentLoaner.maker, currentLoaner.model].filter(Boolean).join(' ') || '—'}
      </p>
      <dl className="space-y-1 text-xs mt-2">
        <KV label="貸出日時" value={m.loaner_handover_at ? new Date(m.loaner_handover_at).toLocaleString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'} />
        <KV label="返却日時" value={m.loaner_return_at ? new Date(m.loaner_return_at).toLocaleString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'} />
        <KV label="貸出時メーター" value={m.loaner_mileage_out != null ? `${Number(m.loaner_mileage_out).toLocaleString()} km` : '—'} />
        <KV label="返却時メーター" value={m.loaner_mileage_in != null ? `${Number(m.loaner_mileage_in).toLocaleString()} km` : '—'} />
        <KV label="走行距離" value={m.loaner_mileage_out != null && m.loaner_mileage_in != null ? `${(Number(m.loaner_mileage_in) - Number(m.loaner_mileage_out)).toLocaleString()} km` : '—'} />
        <KV label="貸出時燃料" value={m.loaner_fuel_out ?? '—'} />
        <KV label="返却時燃料" value={m.loaner_fuel_in ?? '—'} />
      </dl>
      <div className="mt-2">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">メモ</p>
        <p className="text-[11px] text-zinc-700 whitespace-pre-wrap bg-zinc-50 rounded p-2 min-h-8">
          {m.loaner_notes ? <span className="inline-flex items-start gap-1"><NavIcon icon="📝" className="w-3 h-3 shrink-0 mt-0.5" /> {m.loaner_notes}</span> : <span className="text-zinc-300">—</span>}
        </p>
      </div>
    </>
  ) : (
    <p className="text-xs text-zinc-400">代車の割り当てなし</p>
  )

  const maintenanceView = (
    <>
      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2 text-xs">
        <Item label="拠点" value={m.branch_id ?? '—'} />
        <Item label="入庫区分" value={m.intake_category ?? '—'} />
        <Item label="入庫日時" value={`${m.intake_date ?? '—'}${m.intake_time ? ` ${m.intake_time}` : ''}`} />
        <Item label="納車日時" value={`${m.delivery_date ?? '—'}${m.delivery_time ? ` ${m.delivery_time}` : ''}`} />
        <Item label="走行距離" value={m.mileage != null ? `${Number(m.mileage).toLocaleString()} km` : '—'} />
        <Item label="売上計上日" value={m.sales_recording_date ?? '—'} />
        <Item label="引取場所" value={m.pickup_location ?? '—'} />
        <Item label="引渡場所" value={m.delivery_location ?? '—'} />
        <Item label="受付担当" value={receptionName} />
        <Item label="作業担当" value={workerName} />
        <Item label="消費税区分" value={m.tax_mode ?? '—'} />
        <Item label="消費税端数" value={m.tax_rounding ?? '—'} />
        <Item label="レバーレート" value={m.lever_rate ? `¥${Number(m.lever_rate).toLocaleString()}` : '—'} />
        <Item label="登録日" value={m.created_at ? new Date(m.created_at).toLocaleDateString('ja-JP') : '—'} />
      </dl>
      {(m.internal_memo || m.work_order_note || m.general_note) && (
        <div className="mt-4 pt-3 border-t border-zinc-100">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">メモ</p>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <Memo label="整備メモ（印字なし）" value={m.internal_memo} />
            <Memo label="作業指示備考" value={m.work_order_note} />
            <Memo label="備考（見積書に印字）" value={m.general_note} />
          </dl>
        </div>
      )}
    </>
  )

  const damageView = (
    <>
      <MaintenanceDamageMapPreview pins={damagePins} bodyShape={v?.body_shape} />
      {damagePins.length === 0 ? (
        <p className="text-xs text-zinc-400 py-3 mt-3 text-center border-t border-zinc-100">
          損傷箇所はまだ記録されていません — 右上の「編集」から追加できます
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 text-xs mt-3 pt-3 border-t border-zinc-100">
          {damagePins.map((p, i) => {
            const sevColor =
              p.severity === '大' ? 'text-rose-700 bg-rose-50 border-rose-200' :
              p.severity === '中' ? 'text-orange-700 bg-orange-50 border-orange-200' :
                                    'text-blue-600 bg-zinc-50 border-zinc-200'
            const viewLabel: Record<string, string> = { top: '俯瞰', front: '前面', back: '後面', left: '左側面', right: '右側面' }
            return (
              <li key={p.id} className="py-1.5 flex items-center gap-2">
                <span className="text-zinc-400 font-mono w-6 shrink-0">#{i + 1}</span>
                <span className="text-[10px] px-1 py-0.5 rounded bg-zinc-100 text-zinc-700 shrink-0">{viewLabel[p.view] ?? p.view}</span>
                <span className="text-zinc-800 shrink-0">{p.category}</span>
                <span className={`text-[10px] px-1 py-0.5 rounded border ${sevColor} shrink-0`}>{p.severity}</span>
                {p.note && <span className="text-zinc-500 truncate italic">「{p.note}」</span>}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )

  const billingView = (
    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2 text-xs">
      <Item label="請求先" value={m.billing_target ?? '—'} />
      <Item label="請求書番号" value={m.invoice_no ?? '—'} />
      <Item label="支払状況" value={m.payment_status ?? '— (自動判定)'} />
      <Item label="請求書発行日" value={m.invoice_issued_at ?? '—'} />
      <Item label="支払期限" value={m.payment_due_date ?? '—'} />
      <Item label="支払条件" value={m.payment_terms ?? '—'} />
    </dl>
  )

  // ─── レンダー ──────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ステータス遷移バー（全幅・矢羽） */}
      <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-3">
        <StageBar stages={STATUS_STAGES} currentStage={m.status} updateAction={changeStatus} />
      </div>

      {/* 帳票ボタン群 */}
      <div className="bg-white border border-zinc-200 rounded-lg px-3 py-2">
        <Link
          href={`/maintenance/${maintenanceId}/documents`}
          className="text-[10px] uppercase tracking-wider text-zinc-500 hover:text-blue-600 inline-block mb-1.5"
          title="全帳票一覧"
        >
          {AB_ICONS.document} 帳票（クリックで別タブ印刷プレビュー）
        </Link>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
          {DOCUMENT_TYPES.map((d) => (
            <Link
              key={d.type}
              href={`/maintenance/${maintenanceId}/documents/${d.type}`}
              target="_blank"
              className="px-2 py-1.5 text-[11px] text-zinc-700 bg-zinc-50 border border-zinc-200 rounded text-center hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors truncate"
              title={`${d.label} を別タブで印刷プレビュー`}
            >
              {d.label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── 上段: 顧客・車両 / 代車 / 合計 を横並び ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
        <InlineSection
          title="顧客・車両"
          icon={<span>{AB_ICONS.account}</span>}
          canEdit={editable}
          view={customerVehicleView}
        >
          <MaintenanceCustomerVehicleEditForm
            maintenanceId={maintenanceId}
            initial={{
              customer_vehicle_id: m.customer_vehicle_id,
              account_id:          m.account_id,
              contact_id:          m.contact_id,
              billing_account_id:  m.billing_account_id,
            }}
            vehicles={vehicleOptions}
            accounts={accountsList}
            contacts={contactsList}
          />
        </InlineSection>

        <InlineSection
          title="代車"
          icon={<NavIcon icon="🚙" className="w-4 h-4" />}
          canEdit={editable}
          view={loanerView}
        >
          <MaintenanceLoanerEditForm
            maintenanceId={maintenanceId}
            initial={{
              loaner_vehicle_id:  m.loaner_vehicle_id,
              loaner_handover_at: m.loaner_handover_at,
              loaner_return_at:   m.loaner_return_at,
              loaner_mileage_out: m.loaner_mileage_out,
              loaner_mileage_in:  m.loaner_mileage_in,
              loaner_fuel_out:    m.loaner_fuel_out,
              loaner_fuel_in:     m.loaner_fuel_in,
              loaner_notes:       m.loaner_notes,
            }}
            vehicles={loanerVehicleOptions}
          />
        </InlineSection>

        {/* 合計サマリー（閲覧専用） */}
        <section className="bg-linear-to-br from-zinc-50 to-zinc-100 border border-zinc-200 rounded-lg p-4 self-stretch">
          <p className="text-[10px] uppercase tracking-wider text-blue-600 mb-2">請求合計</p>
          <p className="text-2xl font-bold font-mono text-zinc-700">{yen(grandTotal)}</p>
          <dl className="mt-3 space-y-1 text-xs">
            <Row label="入金額" value={yen(paidSum)} />
            <Row label="残額" value={yen(balance)} valueClass={balance > 0 ? 'text-rose-700 font-bold' : 'text-emerald-700 font-bold'} />
            <Row label="粗利益" value={yen(grossProfit)} valueClass="text-zinc-600" />
          </dl>
        </section>
      </div>

      {/* 整備（基本情報 + メモ） */}
      <InlineSection
        title="整備"
        icon={<span>{AB_ICONS.maintenance}</span>}
        canEdit={editable}
        view={maintenanceView}
      >
        <MaintenanceBasicInfoEditForm
          maintenanceId={maintenanceId}
          initial={{
            intake_date:          m.intake_date,
            intake_time:          m.intake_time,
            delivery_date:        m.delivery_date,
            delivery_time:        m.delivery_time,
            pickup_location:      m.pickup_location,
            delivery_location:    m.delivery_location,
            sales_recording_date: m.sales_recording_date,
            mileage:              m.mileage,
            branch_id:            m.branch_id,
            intake_category:      m.intake_category,
            reception_owner_id:   m.reception_owner_id,
            worker_owner_id:      m.worker_owner_id,
            internal_memo:        m.internal_memo,
            work_order_note:      m.work_order_note,
            general_note:         m.general_note,
            tax_mode:             m.tax_mode,
            tax_rounding:         m.tax_rounding,
            lever_rate:           m.lever_rate,
          }}
          users={users}
        />
      </InlineSection>

      {/* 損傷箇所 */}
      <InlineSection
        title={`損傷箇所（${damagePins.length} 件）`}
        icon={<NavIcon icon="📍" className="w-4 h-4" />}
        canEdit={editable}
        view={damageView}
      >
        <MaintenanceDamageMap maintenanceId={maintenanceId} canEdit={editable} bodyShape={v?.body_shape} />
      </InlineSection>

      {/* 作業項目（ステージング表エディタを直接表示） */}
      <section className="bg-white border border-zinc-200 rounded-lg shadow-xs">
        <div className="px-4 py-2.5 border-b border-zinc-100">
          <h2 className="text-sm font-bold text-zinc-700 flex items-center gap-1.5">{AB_ICONS.lineItem}<span>作業項目</span></h2>
        </div>
        <div className="p-4">
          <MaintenanceLineItemsEditor maintenanceId={maintenanceId} canEdit={editable} leverRate={m.lever_rate} />
        </div>
      </section>

      {/* 諸費用 / 請求・支払 / 入金 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* 諸費用（エディタ直接） */}
        <section className="bg-white border border-zinc-200 rounded-lg shadow-xs">
          <div className="px-4 py-2.5 border-b border-zinc-100">
            <h2 className="text-sm font-bold text-zinc-700 flex items-center gap-1.5">{AB_ICONS.fee}<span>諸費用</span></h2>
          </div>
          <div className="p-4">
            <MaintenanceFeesEditor maintenanceId={maintenanceId} canEdit={editable} />
          </div>
        </section>

        {/* 請求・支払（フィールド系・インライン編集） */}
        <InlineSection
          title="請求・支払"
          icon={<NavIcon icon="💳" className="w-4 h-4" />}
          canEdit={editable}
          view={billingView}
        >
          <MaintenanceBillingEditForm
            maintenanceId={maintenanceId}
            initial={{
              billing_target:    m.billing_target,
              invoice_no:        m.invoice_no,
              invoice_issued_at: m.invoice_issued_at,
              payment_due_date:  m.payment_due_date,
              payment_status:    m.payment_status,
              payment_terms:     m.payment_terms,
            }}
          />
        </InlineSection>

        {/* 入金・預かり金（エディタ直接） */}
        <section className="bg-white border border-zinc-200 rounded-lg shadow-xs">
          <div className="px-4 py-2.5 border-b border-zinc-100">
            <h2 className="text-sm font-bold text-zinc-700 flex items-center gap-1.5">{AB_ICONS.payment}<span>入金・預かり金</span></h2>
          </div>
          <div className="p-4">
            <MaintenancePaymentsEditor maintenanceId={maintenanceId} canEdit={editable} users={users} invoiceTotal={invoiceTotal} />
          </div>
        </section>
      </div>
    </div>
  )
}

// ─── Presentation helpers ─────────────────────────────────
function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] text-zinc-400 mb-0.5">{label}</dt>
      <dd className="text-zinc-800">{value || '—'}</dd>
    </div>
  )
}

function Memo({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-[10px] text-zinc-400 mb-0.5">{label}</dt>
      <dd className="text-xs text-zinc-700 whitespace-pre-wrap bg-zinc-50 rounded px-2 py-1.5 min-h-10">{value || <span className="text-zinc-300">—</span>}</dd>
    </div>
  )
}

function KV({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-zinc-500 shrink-0">{label}</dt>
      <dd className="text-zinc-800 text-right truncate">{value || '—'}</dd>
    </div>
  )
}

function Row({ label, value, valueClass = 'text-zinc-700' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-zinc-600">{label}</dt>
      <dd className={`font-mono ${valueClass}`}>{value}</dd>
    </div>
  )
}
