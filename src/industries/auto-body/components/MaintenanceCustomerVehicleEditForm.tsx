'use client'

/**
 * 顧客・車両セクションの編集フォーム（モーダル内で使用）。
 *
 * レイアウト: 2 カラム
 *   左: 設定箇所（取引先 / 顧客担当者 / 請求先別指定 / 顧客車両）
 *   右: 設定後の反映プレビュー（選択中レコードの詳細を保存前に確認）
 *
 * 顧客の表記ロジック:
 *   - BtoB（取引先に会社を選択）: 「顧客担当者」ラベル。会社配下の人物を絞り込み
 *   - BtoC（取引先 = 空）: 「顧客」ラベル。親を持たない人物（ToC 顧客）のみ表示
 *
 * - 即時保存ではなく「保存」「キャンセル」を明示
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SearchableSelect from '@/components/SearchableSelect'
import { AB_ICONS } from '@/industries/auto-body/lib/icons'
import { NavIcon } from '@/lib/navIcon'
import { updateMaintenanceCustomerVehicle } from '@/industries/auto-body/actions/maintenance'
import { useSectionModal } from './SectionEditModal'

export type VehicleOption = {
  id:                  string
  label:               string
  account_id:          string | null
  contact_id?:         string | null
  plate_number?:       string | null
  car_name?:           string | null
  car_model?:          string | null
  grade?:              string | null
  vehicle_kind?:       string | null
  body_shape?:         string | null
  vin?:                string | null
  type_designation?:   string | null
  inspection_due_date?:string | null
}
export type AccountOption = {
  id:       string
  name:     string
  phone?:   string | null
  address?: string | null
  industry?:string | null
  website?: string | null
}
export type ContactOption = {
  id:         string
  full_name:  string
  account_id: string | null
  email?:     string | null
  phone?:     string | null
  title?:     string | null
  department?:string | null
}

type Props = {
  maintenanceId: string
  initial: {
    customer_vehicle_id: string | null
    account_id:          string | null
    contact_id:          string | null
    billing_account_id:  string | null
  }
  vehicles: VehicleOption[]
  accounts: AccountOption[]
  contacts: ContactOption[]
}

export default function MaintenanceCustomerVehicleEditForm({
  maintenanceId, initial, vehicles, accounts, contacts,
}: Props) {
  const [vehicleId, setVehicleId] = useState<string>(initial.customer_vehicle_id ?? '')
  const [accountId, setAccountId] = useState<string>(initial.account_id ?? '')
  const [contactId, setContactId] = useState<string>(initial.contact_id ?? '')
  const [billingAccountId, setBillingAccountId] = useState<string>(initial.billing_account_id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const modal = useSectionModal()

  // 車両選択 → その車両の所有者を顧客に自動入力（顧客が未設定の場合のみ）
  function onVehicleChange(id: string) {
    setVehicleId(id)
    const v = vehicles.find((x) => x.id === id)
    if (!v) return
    if (v.account_id && !accountId) setAccountId(v.account_id)
    if (v.contact_id && !contactId && !accountId) setContactId(v.contact_id)
  }

  // 顧客担当者（人物）の絞り込み:
  //   - 取引先選択中: その会社の人物のみ
  //   - 取引先空（BtoC）: 親を持たない人物 = ToC 顧客のみ
  const filteredContacts = accountId
    ? contacts.filter((c) => c.account_id === accountId)
    : contacts.filter((c) => !c.account_id)

  const dirty =
    vehicleId         !== (initial.customer_vehicle_id ?? '') ||
    accountId         !== (initial.account_id ?? '') ||
    contactId         !== (initial.contact_id ?? '') ||
    billingAccountId  !== (initial.billing_account_id ?? '')

  // 取引先が空のときは「顧客」、入っているときは「顧客担当者」と表示
  const contactLabel = accountId ? '顧客担当者' : '顧客'
  const isToC = !accountId

  // プレビュー用に選択中レコードを ID から逆引き
  const selAccount = accounts.find((a) => a.id === accountId)
  const selContact = contacts.find((c) => c.id === contactId)
  const selVehicle = vehicles.find((v) => v.id === vehicleId)
  const selBilling = accounts.find((a) => a.id === billingAccountId)

  function handleSave() {
    setError(null)
    if (!vehicleId) { setError('顧客車両は必須です'); return }
    if (!accountId && !contactId) {
      setError(`${contactLabel}は必須です（取引先 or 人物 のいずれか）`); return
    }
    startTransition(async () => {
      try {
        await updateMaintenanceCustomerVehicle(maintenanceId, {
          customer_vehicle_id: vehicleId,
          account_id:          accountId || null,
          contact_id:          contactId || null,
          billing_account_id:  billingAccountId || null,
        })
        router.refresh()
        modal?.close()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })
  }

  function handleCancel() {
    if (dirty && !confirm('変更が破棄されます。よろしいですか？')) return
    modal?.close()
  }

  return (
    <div className="flex flex-col h-full">
      {/* 本文: 2 カラム */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-md mb-4">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ━━━ 左: 設定箇所 ━━━ */}
          <div className="space-y-4">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wide pb-1 border-b border-zinc-200 flex items-center gap-1">
              <NavIcon icon="✏️" className="w-3.5 h-3.5" /> 設定
            </div>

            {/* 顧客ブロック */}
            <section className="bg-white border border-zinc-200 rounded-lg">
              <div className="px-4 pt-3 pb-2 border-b border-zinc-100 bg-zinc-50/40 rounded-t-lg">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide inline-flex items-center gap-1"><NavIcon icon={AB_ICONS.account} className="w-3.5 h-3.5" />顧客</h3>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  BtoB は取引先（会社）を選択。BtoC（個人）は取引先を空のままに
                </p>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    取引先 <span className="text-zinc-400 font-normal">（空でも可・BtoC のとき）</span>
                  </label>
                  <SearchableSelect
                    key={`account-${accountId}`}
                    name="account_id"
                    defaultValue={accountId || undefined}
                    options={accounts.map((a) => ({ value: a.id, label: a.name }))}
                    placeholder="— （個人のお客様）"
                    onSelect={(id) => {
                      setAccountId(id)
                      if (id !== accountId) setContactId('')
                    }}
                  />
                  <p className="text-[11px] text-zinc-400 mt-1 flex items-center gap-2">
                    <span>会社名なら BtoB / 空なら BtoC</span>
                    <Link href="/accounts/new" target="_blank" className="text-blue-600 hover:underline shrink-0">
                      ＋ 新規登録（別タブ）
                    </Link>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    {contactLabel}
                    {isToC && <span className="text-red-500"> *</span>}
                  </label>
                  <SearchableSelect
                    key={`contact-${accountId}-${contactId}`}
                    name="contact_id"
                    defaultValue={contactId || undefined}
                    options={filteredContacts.map((c) => ({ value: c.id, label: c.full_name }))}
                    placeholder={isToC ? '本人を選択（ToC 顧客）' : '—'}
                    onSelect={(id) => setContactId(id)}
                  />
                  <p className="text-[11px] text-zinc-400 mt-1 flex items-center gap-2">
                    <span>
                      {isToC ? '親なし人物 (ToC) のみ表示' : '選択中取引先の人物のみ表示'}
                    </span>
                    <Link
                      href={accountId ? `/contacts/new?account_id=${accountId}` : '/contacts/new'}
                      target="_blank"
                      className="text-blue-600 hover:underline shrink-0"
                    >
                      ＋ 新規登録（別タブ）
                    </Link>
                  </p>
                </div>

                <div className="pt-2 border-t border-zinc-100">
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    請求先別指定
                  </label>
                  <SearchableSelect
                    key={`billing-${billingAccountId}`}
                    name="billing_account_id"
                    defaultValue={billingAccountId || undefined}
                    options={accounts.map((a) => ({ value: a.id, label: a.name }))}
                    placeholder="—（指定なし。顧客と同じ）"
                    onSelect={(id) => setBillingAccountId(id)}
                  />
                  <p className="text-[11px] text-zinc-400 mt-1">
                    代金請求先が顧客と異なる場合のみ指定（例: 保険会社）
                  </p>
                </div>
              </div>
            </section>

            {/* 車両ブロック */}
            <section className="bg-white border border-zinc-200 rounded-lg">
              <div className="px-4 pt-3 pb-2 border-b border-zinc-100 bg-zinc-50/40 rounded-t-lg">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide inline-flex items-center gap-1"><NavIcon icon={AB_ICONS.customerVehicle} className="w-3.5 h-3.5" />車両</h3>
              </div>
              <div className="p-4">
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  顧客車両 <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  name="customer_vehicle_id"
                  defaultValue={vehicleId || undefined}
                  options={vehicles.map((v) => ({ value: v.id, label: v.label }))}
                  placeholder="選択してください"
                  onSelect={onVehicleChange}
                />
                <p className="text-xs text-zinc-400 mt-1">
                  <Link href="/customer-vehicles/new" target="_blank" className="text-blue-600 hover:underline">
                    ＋ 新しい顧客車両を登録（別タブ）
                  </Link>
                  <span className="ml-2 text-[11px]">車両を選ぶと所有者が顧客欄に自動入力</span>
                </p>
              </div>
            </section>
          </div>

          {/* ━━━ 右: 設定後の反映プレビュー ━━━ */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 uppercase tracking-wide pb-1 border-b border-zinc-200">
              <NavIcon icon="👁" className="w-3.5 h-3.5 shrink-0" />保存後の反映プレビュー
            </div>

            {/* 取引先プレビュー */}
            <PreviewCard
              title={<span className="inline-flex items-center gap-1"><NavIcon icon={AB_ICONS.account} className="w-3.5 h-3.5" />取引先</span>}
              emptyText={accountId ? '取引先が見つかりません' : '— (BtoC = 個人のお客様)'}
              link={selAccount ? `/accounts/${selAccount.id}` : null}
            >
              {selAccount && (
                <dl className="space-y-1.5">
                  <Row label="会社名" value={selAccount.name} bold />
                  {selAccount.industry && <Row label="業種" value={selAccount.industry} />}
                  {selAccount.phone && <Row label={<><NavIcon icon="📞" className="w-3 h-3 shrink-0" /> 電話</>} value={selAccount.phone} />}
                  {selAccount.website && <Row label={<><NavIcon icon="🌐" className="w-3 h-3 shrink-0" /> Web</>} value={selAccount.website} />}
                  {selAccount.address && <Row label={<><NavIcon icon="📍" className="w-3 h-3 shrink-0" /> 住所</>} value={selAccount.address} />}
                </dl>
              )}
            </PreviewCard>

            {/* 顧客担当者 / 顧客プレビュー */}
            <PreviewCard
              title={<span className="inline-flex items-center gap-1"><NavIcon icon={AB_ICONS.contact} className="w-3.5 h-3.5" />{contactLabel}</span>}
              emptyText={isToC ? '顧客（本人）が未選択' : '担当者なし'}
              link={selContact ? `/contacts/${selContact.id}` : null}
            >
              {selContact && (
                <dl className="space-y-1.5">
                  <Row label="氏名" value={selContact.full_name} bold />
                  {selContact.department && <Row label="部署" value={selContact.department} />}
                  {selContact.title && <Row label="役職" value={selContact.title} />}
                  {selContact.email && <Row label={<><NavIcon icon="✉️" className="w-3 h-3 shrink-0" /> Email</>} value={selContact.email} />}
                  {selContact.phone && <Row label={<><NavIcon icon="📞" className="w-3 h-3 shrink-0" /> 電話</>} value={selContact.phone} />}
                </dl>
              )}
            </PreviewCard>

            {/* 請求先プレビュー（指定があるときだけ） */}
            {billingAccountId && (
              <PreviewCard
                title={<span className="inline-flex items-center gap-1"><NavIcon icon="💳" className="w-3.5 h-3.5 shrink-0" />請求先（別指定）</span>}
                emptyText="—"
                link={selBilling ? `/accounts/${selBilling.id}` : null}
              >
                {selBilling && (
                  <dl className="space-y-1.5">
                    <Row label="会社名" value={selBilling.name} bold />
                    {selBilling.phone && <Row label={<><NavIcon icon="📞" className="w-3 h-3 shrink-0" /> 電話</>} value={selBilling.phone} />}
                    {selBilling.address && <Row label={<><NavIcon icon="📍" className="w-3 h-3 shrink-0" /> 住所</>} value={selBilling.address} />}
                  </dl>
                )}
              </PreviewCard>
            )}

            {/* 車両プレビュー */}
            <PreviewCard
              title={<span className="inline-flex items-center gap-1"><NavIcon icon={AB_ICONS.customerVehicle} className="w-3.5 h-3.5" />車両</span>}
              emptyText="車両を選択してください"
              link={selVehicle ? `/customer-vehicles/${selVehicle.id}` : null}
            >
              {selVehicle && (
                <dl className="space-y-1.5">
                  <Row label="ナンバー" value={selVehicle.plate_number ?? '—'} bold />
                  <Row label="車名 / 車種" value={[selVehicle.car_name, selVehicle.car_model, selVehicle.grade].filter(Boolean).join(' / ') || '—'} />
                  {selVehicle.vehicle_kind && <Row label="種別" value={selVehicle.vehicle_kind} />}
                  {selVehicle.body_shape && <Row label="車体形状" value={selVehicle.body_shape} />}
                  {selVehicle.vin && <Row label="車台番号" value={selVehicle.vin} mono />}
                  {selVehicle.type_designation && <Row label="型式" value={selVehicle.type_designation} />}
                  {selVehicle.inspection_due_date && <Row label={<><NavIcon icon="⚠️" className="w-3 h-3 shrink-0" /> 車検満了</>} value={selVehicle.inspection_due_date} />}
                </dl>
              )}
            </PreviewCard>
          </div>
        </div>
      </div>

      {/* フッタ */}
      <div className="mt-4 pt-3 border-t border-zinc-200 flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          {dirty
            ? <><span className="text-amber-700 font-semibold">●</span> 未保存の変更があります</>
            : '変更なし'}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm border border-zinc-300 rounded-md hover:bg-zinc-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending || !dirty}
            className="px-4 py-2 text-sm bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 shadow-sm"
          >
            {pending ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── プレビュー用カード ──────────────────────────────────
function PreviewCard({
  title, emptyText, link, children,
}: {
  title:     React.ReactNode
  emptyText: string
  link:      string | null
  children?: React.ReactNode
}) {
  const isEmpty = !children
  return (
    <section className="bg-white border border-zinc-200 rounded-lg">
      <div className="px-4 pt-3 pb-2 border-b border-zinc-100 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{title}</h3>
        {link && (
          <Link href={link} target="_blank" className="text-[10px] text-blue-600 hover:underline">
            詳細ページ →
          </Link>
        )}
      </div>
      <div className="p-4">
        {isEmpty ? (
          <p className="text-xs text-zinc-400 italic">{emptyText}</p>
        ) : children}
      </div>
    </section>
  )
}

function Row({ label, value, bold, mono }: { label: React.ReactNode; value: string; bold?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <dt className="text-zinc-500 w-20 shrink-0 inline-flex items-center gap-1">{label}</dt>
      <dd className={`flex-1 ${bold ? 'font-semibold text-zinc-900' : 'text-zinc-700'} ${mono ? 'font-mono' : ''} break-words`}>
        {value}
      </dd>
    </div>
  )
}
