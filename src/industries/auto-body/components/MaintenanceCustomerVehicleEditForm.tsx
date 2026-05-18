'use client'

/**
 * 顧客・車両セクションの編集フォーム（モーダル内で使用）。
 *
 * - 顧客車両 / 顧客（取引先） / 顧客担当者 / 請求先別指定 を編集
 * - 即時保存ではなく「保存」「キャンセル」を明示
 * - 既存 MaintenanceForm と同じく SearchableSelect ピッカーを利用
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SearchableSelect from '@/components/SearchableSelect'
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

  const filteredContacts = accountId
    ? contacts.filter((c) => c.account_id === accountId)
    : contacts

  const dirty =
    vehicleId         !== (initial.customer_vehicle_id ?? '') ||
    accountId         !== (initial.account_id ?? '') ||
    contactId         !== (initial.contact_id ?? '') ||
    billingAccountId  !== (initial.billing_account_id ?? '')

  function handleSave() {
    setError(null)
    if (!vehicleId) { setError('顧客車両は必須です'); return }
    if (!accountId) { setError('顧客（取引先）は必須です'); return }
    startTransition(async () => {
      try {
        await updateMaintenanceCustomerVehicle(maintenanceId, {
          customer_vehicle_id: vehicleId,
          account_id:          accountId,
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
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
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              顧客（取引先） <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              key={`account-${accountId}`}
              name="account_id"
              defaultValue={accountId || undefined}
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
              placeholder="選択してください"
              onSelect={setAccountId}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">顧客担当者</label>
            <SearchableSelect
              key={`contact-${accountId}-${contactId}`}
              name="contact_id"
              defaultValue={contactId || undefined}
              options={filteredContacts.map((c) => ({ value: c.id, label: c.full_name }))}
              placeholder="—"
              onSelect={(id) => setContactId(id)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">請求先別指定</label>
            <SearchableSelect
              key={`billing-${billingAccountId}`}
              name="billing_account_id"
              defaultValue={billingAccountId || undefined}
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
              placeholder="—（指定なし。顧客と同じ）"
              onSelect={(id) => setBillingAccountId(id)}
            />
          </div>
        </div>
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
