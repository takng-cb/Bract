'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import SearchableSelect from '@/components/SearchableSelect'

type VehicleOption = { id: string; label: string; account_id: string | null }
type AccountOption = { id: string; name: string }
type ContactOption = { id: string; full_name: string; account_id: string | null }
type UserOption    = { id: string; name: string }

export type MaintenanceFormDefaults = {
  customer_vehicle_id?: string | null
  account_id?: string | null
  contact_id?: string | null
  billing_account_id?: string | null
  intake_date?: string | null
  intake_time?: string | null
  delivery_date?: string | null
  delivery_time?: string | null
  pickup_location?: string | null
  delivery_location?: string | null
  sales_recording_date?: string | null
  mileage?: number | null
  branch_id?: string | null
  intake_category?: string | null
  reception_owner_id?: string | null
  worker_owner_id?: string | null
  internal_memo?: string | null
  work_order_note?: string | null
  general_note?: string | null
  tax_mode?: string | null
  tax_rounding?: string | null
  lever_rate?: string | null
  status?: string | null
  owner_id?: string | null
}

type Props = {
  action:        (prevState: string | null, formData: FormData) => Promise<string | null>
  cancelHref:    string
  vehicles:      VehicleOption[]
  accounts:      AccountOption[]
  contacts:      ContactOption[]
  users:         UserOption[]
  defaultValues?: MaintenanceFormDefaults
}

const STATUSES = ['予約', '受付', '作業中', '納車待ち', '完了', 'キャンセル']
const TAX_MODES = ['税別10%', '税別8%', '税込10%', '税込8%', '非課税']
const TAX_ROUNDINGS = ['切り捨て', '四捨五入', '切り上げ']

export default function MaintenanceForm({
  action, cancelHref, vehicles, accounts, contacts, users, defaultValues = {},
}: Props) {
  const [error, formAction, pending] = useActionState(action, null)
  const [selectedVehicleId, setSelectedVehicleId] = useState(defaultValues.customer_vehicle_id ?? '')
  const [selectedAccountId, setSelectedAccountId] = useState(defaultValues.account_id ?? '')

  // 車両選択 → その車両の所有者を顧客に自動入力
  function onVehicleChange(id: string) {
    setSelectedVehicleId(id)
    const v = vehicles.find((x) => x.id === id)
    if (v && v.account_id && !selectedAccountId) {
      setSelectedAccountId(v.account_id)
    }
  }

  const filteredContacts = selectedAccountId
    ? contacts.filter((c) => c.account_id === selectedAccountId)
    : contacts

  return (
    <form action={formAction} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={pending}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {pending ? '保存中...' : '保存'}
        </button>
        <Link href={cancelHref} className="px-5 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">
          キャンセル
        </Link>
      </div>

      {/* 顧客車両 + 顧客 */}
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">対象</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              顧客車両 <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              name="customer_vehicle_id"
              defaultValue={defaultValues.customer_vehicle_id ?? undefined}
              options={vehicles.map((v) => ({ value: v.id, label: v.label }))}
              placeholder="選択してください"
              onSelect={onVehicleChange}
            />
            <p className="text-xs text-zinc-400 mt-1">
              <Link href="/customer-vehicles/new" className="text-blue-600 hover:underline">＋ 新しい顧客車両を登録</Link>
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              顧客（取引先） <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              key={selectedAccountId}
              name="account_id"
              defaultValue={selectedAccountId || defaultValues.account_id || undefined}
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
              placeholder="選択してください"
              onSelect={setSelectedAccountId}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">顧客担当者</label>
            <SearchableSelect
              key={`contact-${selectedAccountId}`}
              name="contact_id"
              defaultValue={defaultValues.contact_id ?? undefined}
              options={filteredContacts.map((c) => ({ value: c.id, label: c.full_name }))}
              placeholder="—"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">請求先別指定</label>
            <SearchableSelect
              name="billing_account_id"
              defaultValue={defaultValues.billing_account_id ?? undefined}
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
              placeholder="—（指定なし）"
            />
          </div>
        </div>
      </div>

      {/* 日時・場所 */}
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">日時・場所</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">入庫日</label>
            <input type="date" name="intake_date" defaultValue={defaultValues.intake_date ?? ''}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">入庫時間</label>
            <input type="time" name="intake_time" defaultValue={defaultValues.intake_time ?? ''}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">納車日</label>
            <input type="date" name="delivery_date" defaultValue={defaultValues.delivery_date ?? ''}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">納車時間</label>
            <input type="time" name="delivery_time" defaultValue={defaultValues.delivery_time ?? ''}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">引取場所</label>
            <input name="pickup_location" defaultValue={defaultValues.pickup_location ?? ''}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">引渡場所</label>
            <input name="delivery_location" defaultValue={defaultValues.delivery_location ?? ''}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">売上計上日</label>
            <input type="date" name="sales_recording_date" defaultValue={defaultValues.sales_recording_date ?? ''}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">総走行距離 (km)</label>
            <input type="number" name="mileage" defaultValue={defaultValues.mileage ?? ''} min="0"
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">拠点</label>
            <input name="branch_id" defaultValue={defaultValues.branch_id ?? ''}
              placeholder="例: 本店"
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">入庫区分</label>
            <input name="intake_category" defaultValue={defaultValues.intake_category ?? ''}
              placeholder="例: 車検 / 一般整備 / 板金"
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      {/* 担当 */}
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">担当</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">受付担当者</label>
            <SearchableSelect name="reception_owner_id" defaultValue={defaultValues.reception_owner_id ?? undefined}
              options={users.map((u) => ({ value: u.id, label: u.name }))} placeholder="—" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">作業担当者</label>
            <SearchableSelect name="worker_owner_id" defaultValue={defaultValues.worker_owner_id ?? undefined}
              options={users.map((u) => ({ value: u.id, label: u.name }))} placeholder="—" />
          </div>
        </div>
      </div>

      {/* メモ */}
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">メモ</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">整備メモ <span className="text-zinc-400 font-normal">（印字なし）</span></label>
            <textarea name="internal_memo" defaultValue={defaultValues.internal_memo ?? ''} rows={2}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">作業指示備考 <span className="text-zinc-400 font-normal">（作業指示書に印字）</span></label>
            <textarea name="work_order_note" defaultValue={defaultValues.work_order_note ?? ''} rows={2}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">備考 <span className="text-zinc-400 font-normal">（見積書等に印字）</span></label>
            <textarea name="general_note" defaultValue={defaultValues.general_note ?? ''} rows={2}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>
      </div>

      {/* 税・ステータス */}
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">税 / ステータス</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">消費税区分</label>
            <select name="tax_mode" defaultValue={defaultValues.tax_mode ?? '税別10%'}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {TAX_MODES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">消費税端数</label>
            <select name="tax_rounding" defaultValue={defaultValues.tax_rounding ?? '切り捨て'}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {TAX_ROUNDINGS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">レバーレート（税別）</label>
            <input type="number" name="lever_rate" defaultValue={defaultValues.lever_rate ?? ''} min="0"
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">ステータス</label>
            <select name="status" defaultValue={defaultValues.status ?? '予約'}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={pending}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {pending ? '保存中...' : '保存'}
        </button>
        <Link href={cancelHref} className="px-5 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">
          キャンセル
        </Link>
      </div>
    </form>
  )
}
