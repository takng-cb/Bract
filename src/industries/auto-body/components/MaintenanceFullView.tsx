/**
 * 整備の「全体」ビュー。
 *
 * レイアウト（#整備レイアウト改修 / REQ-0038）:
 *   - 上段に 顧客 / 車両 / 代車 の 3 カードを横並び（請求合計はページ上部の KPI サマリーへ）
 *   - その下に 整備 → 損傷 → 作業項目 → 諸費用/請求支払/入金 を全幅で縦積み
 *
 * 編集 UX:
 *   - フィールド系（整備 / 顧客 / 車両 / 代車 / 請求・支払 / 損傷）は InlineSection で
 *     「閲覧⇄編集」をその場トグル（他ブックの EditableInfoCard と同じ作法）。
 *   - 明細系（作業項目 / 諸費用 / 入金）は専用エディタ（ステージング表）を直接表示する。
 */
import { db } from '@/lib/db'
import {
  maintenance_records, customer_vehicles, accounts, contacts,
  maintenance_line_items, maintenance_fees, maintenance_payments,
  maintenance_damage_pins, vehicles,
} from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
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
import { CustomerInlineEditor, VehicleInlineEditor } from './MaintenanceCustomerVehicleInline'
import MaintenanceBasicInfoEditForm from './MaintenanceBasicInfoEditForm'
import MaintenanceLoanerEditForm from './MaintenanceLoanerEditForm'
import StageBar, { type StageConfig } from '@/components/StageBar'
import { requestStatusChange } from '@/app/actions/approvals'
import ApprovalSection from '@/components/approvals/ApprovalSection'
import { computeMaintenanceTotals } from '@/industries/auto-body/lib/maintenanceTotals'
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


export default async function MaintenanceFullView({ maintenanceId, users }: Props) {
  // 1 回目のクエリ群: 整備本体 + 関連情報を取得（loaner_vehicle_id を含む）
  const [mRow, lines, fees, payments, damagePins, editable, accountsList] = await Promise.all([
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
    // 顧客セクションのインライン編集用（請求先別指定・担当者の選択肢）
    // 車両はオンデマンド検索（findCustomerVehicleCandidates）のため事前取得しない（REQ-0042）
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
  ])

  if (!mRow) return null
  const m = mRow.m
  const v = mRow.vehicle
  const account = mRow.account?.id ? mRow.account : null
  const contact = mRow.contact?.id ? mRow.contact : null

  // 現在の代車情報（表示用）。候補はオンデマンド検索（findLoanerVehicleCandidates）のため事前取得しない
  const currentLoaner = m.loaner_vehicle_id
    ? await db.select({
        id:            vehicles.id,
        maker:         vehicles.maker,
        model:         vehicles.model,
        license_plate: vehicles.license_plate,
      })
        .from(vehicles)
        .where(eq(vehicles.id, m.loaner_vehicle_id))
        .then((r) => r[0] ?? null)
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

  // ─── 集計（maintenanceTotals.ts に共通化。KPI サマリーと同じ計算）────
  const { invoiceTotal } = computeMaintenanceTotals({ lines, fees, payments, taxMode: m.tax_mode })

  async function changeStatus(status: string) {
    'use server'
    // 承認ゲート（REQ-0037）：遷移ルールにマッチしたら承認待ちを作成して保留
    return await requestStatusChange('maintenance_records', maintenanceId, 'status', status)
  }

  // ════════════════════════════════════════════════
  //  各セクションの閲覧ビュー
  // ════════════════════════════════════════════════

  const customerView = (
    <>
      {(account && !accountIsPersonal) ? (
        <>
          <p className="text-[10px] text-zinc-500 mb-0.5">取引先</p>
          <Link href={`/accounts/${account.id}`} className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline">
            <NavIcon icon={AB_ICONS.account} className="w-3.5 h-3.5 inline-block -mt-0.5 mr-1" />{account.name}
          </Link>
          {contact && (
            <>
              <p className="text-[10px] text-zinc-500 mt-2 mb-0.5">顧客担当者</p>
              <Link href={`/contacts/${contact.id}`} className="text-xs text-zinc-700 hover:text-blue-700 hover:underline">
                <NavIcon icon={AB_ICONS.contact} className="w-3.5 h-3.5 inline-block -mt-0.5 mr-1" />{contact.full_name}
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
            <NavIcon icon={AB_ICONS.contact} className="w-3.5 h-3.5 inline-block -mt-0.5 mr-1" />{contact.full_name}
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
            <NavIcon icon={AB_ICONS.account} className="w-3.5 h-3.5 inline-block -mt-0.5 mr-1" />{billingAccount.name}
          </Link>
        </div>
      )}
    </>
  )

  const vehicleView = v ? (
    <>
      <Link href={`/customer-vehicles/${v.id}`} className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline">
        <NavIcon icon={AB_ICONS.customerVehicle} className="w-3.5 h-3.5 inline-block -mt-0.5 mr-1" />{v.plate_number ?? '—'}
      </Link>
      <p className="text-xs text-zinc-600 mt-1">{[v.car_name, v.car_model, v.grade].filter(Boolean).join(' / ') || '—'}</p>
      <dl className="space-y-1 text-xs mt-2">
        {v.vin && <KV label="車台番号" value={v.vin} />}
        {v.type_designation && <KV label="型式" value={v.type_designation} />}
        {(v.first_registration_year || v.first_registration_month) && (
          <KV label="初年度" value={[v.first_registration_year, v.first_registration_month].filter(Boolean).join('/')} />
        )}
        {v.inspection_due_date && (
          <KV label={<span className="inline-flex items-center gap-1"><NavIcon icon={AB_ICONS.warning} className="w-3 h-3" />車検満了</span>} value={v.inspection_due_date} />
        )}
      </dl>
      {v.memo && <p className="text-[11px] text-zinc-500 mt-2 whitespace-pre-wrap bg-zinc-50 rounded p-2 flex items-start gap-1"><NavIcon icon="📝" className="w-3 h-3 shrink-0 mt-0.5" /> {v.memo}</p>}
    </>
  ) : <p className="text-xs text-zinc-400">—</p>

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

      {/* 承認（遷移ルール設定時のみ表示） */}
      <ApprovalSection objectType="maintenance_records" objectId={maintenanceId} />

      {/* 帳票ボタン群 */}
      <div className="bg-white border border-zinc-200 rounded-lg px-3 py-2">
        <Link
          href={`/maintenance/${maintenanceId}/documents`}
          className="text-[10px] uppercase tracking-wider text-zinc-500 hover:text-blue-600 inline-block mb-1.5"
          title="全帳票一覧"
        >
          <NavIcon icon={AB_ICONS.document} className="w-3.5 h-3.5 inline-block -mt-0.5 mr-1" />帳票（クリックで別タブ印刷プレビュー）
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

      {/* ── 上段: 顧客 / 車両 / 代車 を横並び（請求合計はページ上部の KPI サマリーへ移設・REQ-0038）──
           顧客・車両は編集ボタンで「検索→なければ新規」エディタを開き、保存で閲覧表示へ戻る（REQ-0042） */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
        <InlineSection
          title="顧客"
          icon={<NavIcon icon={AB_ICONS.account} className="w-4 h-4" />}
          canEdit={editable}
          view={customerView}
        >
          <CustomerInlineEditor
            maintenanceId={maintenanceId}
            initial={{
              customer_vehicle_id: m.customer_vehicle_id,
              account_id:          m.account_id,
              contact_id:          m.contact_id,
              billing_account_id:  m.billing_account_id,
            }}
            currentAccountName={account?.name ?? null}
            currentContactName={contact?.full_name ?? null}
            currentBillingName={billingAccount?.name ?? null}
          />
        </InlineSection>

        <InlineSection
          title="車両"
          icon={<NavIcon icon={AB_ICONS.customerVehicle} className="w-4 h-4" />}
          canEdit={editable}
          view={vehicleView}
        >
          <VehicleInlineEditor
            maintenanceId={maintenanceId}
            initial={{
              customer_vehicle_id: m.customer_vehicle_id,
              account_id:          m.account_id,
              contact_id:          m.contact_id,
              billing_account_id:  m.billing_account_id,
            }}
            currentVehicleLabel={v ? ([v.plate_number, v.car_name ?? v.car_model].filter(Boolean).join(' / ') || '（無名車両）') : null}
          />
        </InlineSection>

        {/* 代車のフォームは1カラムで収まるため、その場（カード内）で編集する（全幅化しない） */}
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
            currentLoanerLabel={currentLoaner
              ? `${currentLoaner.license_plate ?? '—'} / ${[currentLoaner.maker, currentLoaner.model].filter(Boolean).join(' ') || '車両'}`
              : null}
          />
        </InlineSection>
      </div>

      {/* 整備（基本情報 + メモ） */}
      <InlineSection
        title="整備"
        icon={<NavIcon icon={AB_ICONS.maintenance} className="w-4 h-4" />}
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
          <h2 className="text-sm font-bold text-zinc-700 flex items-center gap-1.5"><NavIcon icon={AB_ICONS.lineItem} className="w-4 h-4" /><span>作業項目</span></h2>
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
            <h2 className="text-sm font-bold text-zinc-700 flex items-center gap-1.5"><NavIcon icon={AB_ICONS.fee} className="w-4 h-4" /><span>諸費用</span></h2>
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
            <h2 className="text-sm font-bold text-zinc-700 flex items-center gap-1.5"><NavIcon icon={AB_ICONS.payment} className="w-4 h-4" /><span>入金・預かり金</span></h2>
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

