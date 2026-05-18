'use client'

/**
 * 顧客・車両セクションの編集フォーム（モーダル内で使用）。
 *
 * レイアウトは表示パネル（左 sticky）と同じ「顧客が上、車両が下」の縦並び。
 *
 * 顧客の表記ロジック:
 *   - BtoB（取引先に会社を選択）: 「顧客担当者」ラベル。会社配下の人物を絞り込み
 *   - BtoC（取引先 = 空）: 「顧客」ラベル。親を持たない人物（ToC 顧客）のみ表示
 *
 * - 即時保存ではなく「保存」「キャンセル」を明示
 * - 既存 MaintenanceForm と同じく SearchableSelect ピッカーを利用
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SearchableSelect from '@/components/SearchableSelect'
import { AB_ICONS } from '@/industries/auto-body/lib/icons'
import { updateMaintenanceCustomerVehicle } from '@/industries/auto-body/actions/maintenance'
import { useSectionModal } from './SectionEditModal'

export type VehicleOption = { id: string; label: string; account_id: string | null }
export type AccountOption = { id: string; name: string }
export type ContactOption = { id: string; full_name: string; account_id: string | null }

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
    if (v && v.account_id && !accountId) {
      setAccountId(v.account_id)
    }
  }

  // 顧客担当者（人物）の絞り込み:
  //   - 取引先が選択されている: その会社の人物のみ
  //   - 取引先が空（BtoC）: 親を持たない人物 = ToC 顧客のみ
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

  function handleSave() {
    setError(null)
    if (!vehicleId) { setError('顧客車両は必須です'); return }
    // BtoB は取引先、BtoC は顧客（人物）が必須。どちらか必須。
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
      {/* 本文 */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-md">{error}</div>
        )}

        {/* ─── 顧客（上半分）─── */}
        <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <div className="px-4 pt-3 pb-2 border-b border-zinc-100 bg-zinc-50/40">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{AB_ICONS.account} 顧客</h3>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              BtoB は取引先（会社）を選択。BtoC（個人のお客様）は取引先を空のままにして、下の「顧客」欄で人物を選択してください。
            </p>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  // 取引先を変えたら、フィルタが効かなくなる担当者をリセット
                  if (id !== accountId) setContactId('')
                }}
              />
              <p className="text-[11px] text-zinc-400 mt-1">
                会社名なら BtoB。空のままなら BtoC（個人）
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
              <p className="text-[11px] text-zinc-400 mt-1">
                {isToC
                  ? '取引先を持たない人物（ToC 顧客）のみ表示。空のままだと保存できません'
                  : '選択中の取引先に紐付く担当者のみ表示'}
              </p>
            </div>

            <div className="sm:col-span-2 pt-2 border-t border-zinc-100">
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
                整備の代金請求先が顧客と異なる場合のみ指定（例: 保険会社・親会社）
              </p>
            </div>
          </div>
        </section>

        {/* ─── 車両（下半分）─── */}
        <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <div className="px-4 pt-3 pb-2 border-b border-zinc-100 bg-zinc-50/40">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{AB_ICONS.customerVehicle} 車両</h3>
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
              <Link
                href="/customer-vehicles/new"
                target="_blank"
                className="text-blue-600 hover:underline"
              >
                ＋ 新しい顧客車両を登録（別タブ）
              </Link>
              <span className="ml-2 text-[11px]">車両を選ぶと所有者の取引先が自動入力されます（顧客未設定時のみ）</span>
            </p>
          </div>
        </section>
      </div>

      {/* sticky フッタ */}
      <div className="sticky bottom-0 bg-white border-t border-zinc-200 mt-4 -mx-5 px-5 py-3 flex items-center justify-between">
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
            className="px-4 py-2 text-sm bg-amber-600 text-white font-medium rounded-md hover:bg-amber-700 disabled:opacity-50 shadow-sm"
          >
            {pending ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

