'use client'

import { useActionState, useState, useTransition } from 'react'
import Link from 'next/link'
import { Plus, Loader2, X } from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'
import {
  inlineCreateAccount, inlineCreateCustomerVehicle, findAccountCandidates,
} from '@/industries/auto-body/actions/maintenanceInline'

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

const STATUSES = ['予約', '受付', '作業中', '部品待ち', '納車待ち', '完了', 'キャンセル']
const TAX_MODES = ['税別10%', '税別8%', '税込10%', '税込8%', '非課税']
const TAX_ROUNDINGS = ['切り捨て', '四捨五入', '切り上げ']

export default function MaintenanceForm({
  action, cancelHref, vehicles, accounts, contacts, users, defaultValues = {},
}: Props) {
  const [error, formAction, pending] = useActionState(action, null)
  const [selectedAccountId, setSelectedAccountId] = useState(defaultValues.account_id ?? '')
  const [selectedVehicleId, setSelectedVehicleId] = useState(defaultValues.customer_vehicle_id ?? '')

  // 新規作成で増えた選択肢をローカルに保持
  const [accountOpts, setAccountOpts] = useState<AccountOption[]>(accounts)
  const [vehicleOpts, setVehicleOpts] = useState<VehicleOption[]>(vehicles)

  // 車両選択 → その車両の所有者を顧客に自動入力
  function onVehicleChange(id: string) {
    setSelectedVehicleId(id)
    const v = vehicleOpts.find((x) => x.id === id)
    if (v && v.account_id && !selectedAccountId) {
      setSelectedAccountId(v.account_id)
    }
  }

  const filteredContacts = selectedAccountId
    ? contacts.filter((c) => c.account_id === selectedAccountId)
    : contacts

  function addAccountOption(o: AccountOption) {
    setAccountOpts((prev) => prev.some((a) => a.id === o.id) ? prev : [o, ...prev])
    setSelectedAccountId(o.id)
  }
  function addVehicleOption(o: VehicleOption) {
    setVehicleOpts((prev) => prev.some((v) => v.id === o.id) ? prev : [o, ...prev])
    setSelectedVehicleId(o.id)
  }

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
      <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6">
        <h2 className="text-sm font-bold text-zinc-700 mb-4">対象</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              顧客車両 <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              key={`veh-${selectedVehicleId}`}
              name="customer_vehicle_id"
              defaultValue={selectedVehicleId || undefined}
              options={vehicleOpts.map((v) => ({ value: v.id, label: v.label }))}
              placeholder="選択してください"
              onSelect={onVehicleChange}
            />
            <VehicleInline accountId={selectedAccountId} onCreated={addVehicleOption} />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              顧客（取引先） <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              key={selectedAccountId}
              name="account_id"
              defaultValue={selectedAccountId || defaultValues.account_id || undefined}
              options={accountOpts.map((a) => ({ value: a.id, label: a.name }))}
              placeholder="選択してください"
              onSelect={setSelectedAccountId}
            />
            <AccountInline onCreated={addAccountOption} />
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
              options={accountOpts.map((a) => ({ value: a.id, label: a.name }))}
              placeholder="—（指定なし）"
            />
          </div>
        </div>
      </div>

      {/* 日時・場所 */}
      <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6">
        <h2 className="text-sm font-bold text-zinc-700 mb-4">日時・場所</h2>
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
      <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6">
        <h2 className="text-sm font-bold text-zinc-700 mb-4">担当</h2>
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
      <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6">
        <h2 className="text-sm font-bold text-zinc-700 mb-4">メモ</h2>
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
      <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6">
        <h2 className="text-sm font-bold text-zinc-700 mb-4">税 / ステータス</h2>
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

// ── インライン作成（#45）─────────────────────────────────────────────
function InlineToggle({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" onClick={onToggle}
      className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
      {open ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}{open ? '閉じる' : label}
    </button>
  )
}

function inlineInputCls() {
  return 'w-full border border-zinc-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
}

function AccountInline({ onCreated }: { onCreated: (o: AccountOption) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [candidates, setCandidates] = useState<{ id: string; name: string }[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const onNameChange = (v: string) => {
    setName(v); setMsg(null)
    start(async () => { setCandidates(await findAccountCandidates(v)) })
  }
  const create = () => {
    if (!name.trim()) { setMsg('取引先名を入力してください'); return }
    start(async () => {
      try {
        const r = await inlineCreateAccount({ name, phone })
        onCreated({ id: r.id, name: r.name })
        setOpen(false); setName(''); setPhone(''); setCandidates([])
      } catch (e) { setMsg(e instanceof Error ? e.message : String(e)) }
    })
  }

  return (
    <div>
      <InlineToggle open={open} onToggle={() => setOpen((o) => !o)} label="＋ 取引先を新規作成" />
      {open && (
        <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 space-y-2">
          <input className={inlineInputCls()} placeholder="取引先名（必須）" value={name} onChange={(e) => onNameChange(e.target.value)} />
          <input className={inlineInputCls()} placeholder="電話（任意）" value={phone} onChange={(e) => setPhone(e.target.value)} />
          {candidates.length > 0 && (
            <div className="rounded border border-amber-200 bg-amber-50 p-2 space-y-1">
              <p className="text-[11px] text-amber-700">同名・類似の取引先があります（重複作成を避けるには選択）:</p>
              {candidates.map((c) => (
                <button key={c.id} type="button" onClick={() => { onCreated({ id: c.id, name: c.name }); setOpen(false) }}
                  className="block w-full text-left text-xs text-blue-700 hover:underline">✓ 既存「{c.name}」を使う</button>
              ))}
            </div>
          )}
          {msg && <p className="text-xs text-red-600">{msg}</p>}
          <button type="button" onClick={create} disabled={pending}
            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {pending && <Loader2 className="w-3 h-3 animate-spin" />}この内容で作成
          </button>
        </div>
      )}
    </div>
  )
}

function VehicleInline({ accountId, onCreated }: { accountId: string; onCreated: (o: VehicleOption) => void }) {
  const [open, setOpen] = useState(false)
  const [plate, setPlate] = useState('')
  const [carName, setCarName] = useState('')
  const [carModel, setCarModel] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const create = () => {
    if (!accountId) { setMsg('先に顧客（取引先）を選択してください'); return }
    if (!plate.trim() && !carName.trim() && !carModel.trim()) { setMsg('ナンバー・車名・型式のいずれかを入力してください'); return }
    start(async () => {
      try {
        const r = await inlineCreateCustomerVehicle({ plate_number: plate, car_name: carName, car_model: carModel, account_id: accountId })
        onCreated({ id: r.id, label: r.label, account_id: accountId })
        setOpen(false); setPlate(''); setCarName(''); setCarModel('')
      } catch (e) { setMsg(e instanceof Error ? e.message : String(e)) }
    })
  }

  return (
    <div>
      <InlineToggle open={open} onToggle={() => setOpen((o) => !o)} label="＋ 顧客車両を新規作成" />
      {open && (
        <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 space-y-2">
          {!accountId && <p className="text-[11px] text-amber-600">先に「顧客（取引先）」を選択するとここに保存されます。</p>}
          <input className={inlineInputCls()} placeholder="ナンバー（例: 品川 300 あ 12-34）" value={plate} onChange={(e) => setPlate(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input className={inlineInputCls()} placeholder="車名" value={carName} onChange={(e) => setCarName(e.target.value)} />
            <input className={inlineInputCls()} placeholder="型式" value={carModel} onChange={(e) => setCarModel(e.target.value)} />
          </div>
          {msg && <p className="text-xs text-red-600">{msg}</p>}
          <button type="button" onClick={create} disabled={pending}
            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {pending && <Loader2 className="w-3 h-3 animate-spin" />}この内容で作成
          </button>
        </div>
      )}
    </div>
  )
}
