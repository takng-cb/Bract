'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import SearchableSelect from '@/components/SearchableSelect'
import { VEHICLE_STATUSES } from '@/industries/auto-body/lib/autoBodyService'

type Account    = { id: string; name: string }
type UserOption = { id: string; name: string }

type VehicleFormProps = {
  action: (prevState: string | null, formData: FormData) => Promise<string | null>
  cancelHref: string
  accounts: Account[]
  users?: UserOption[]
  defaultValues?: {
    maker?: string | null
    model?: string | null
    year?: number | null
    mileage?: number | null
    color?: string | null
    license_plate?: string | null
    vin?: string | null
    status?: string | null
    purchase_date?: string | null
    purchase_price?: number | string | null
    supplier_account_id?: string | null
    sale_price?: number | string | null
    sold_date?: string | null
    sold_price?: number | string | null
    buyer_account_id?: string | null
    next_inspection_date?: string | null
    description?: string | null
    owner_id?: string | null
  }
}

const inputClass =
  'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

function Section({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="w-1 h-5 rounded-full bg-blue-500 shrink-0" />
      <span className="text-sm font-bold text-zinc-700 tracking-wide">{title}</span>
      <div className="flex-1 h-px bg-zinc-200" />
    </div>
  )
}

export default function VehicleForm({
  action, cancelHref, accounts, users = [], defaultValues = {},
}: VehicleFormProps) {
  const [error, formAction, pending] = useActionState(action, null)
  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }))

  return (
    <form action={formAction} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={pending}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">
          {pending ? '保存中...' : '保存'}
        </button>
        <Link href={cancelHref}
          className="px-5 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50">
          キャンセル
        </Link>
      </div>

      <Section title="車両情報" />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            メーカー <span className="text-red-500">*</span>
          </label>
          <input name="maker" required defaultValue={defaultValues.maker ?? ''} placeholder="例: トヨタ" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            車種 <span className="text-red-500">*</span>
          </label>
          <input name="model" required defaultValue={defaultValues.model ?? ''} placeholder="例: アルファード" className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">年式</label>
          <input name="year" type="number" min="1950" max="2100" defaultValue={defaultValues.year ?? ''} placeholder="例: 2020" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">走行距離（km）</label>
          <input name="mileage" type="number" min="0" defaultValue={defaultValues.mileage ?? ''} placeholder="例: 50000" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">色</label>
          <input name="color" defaultValue={defaultValues.color ?? ''} placeholder="例: パールホワイト" className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">ナンバー</label>
          <input name="license_plate" defaultValue={defaultValues.license_plate ?? ''} placeholder="例: 品川 300 あ 12-34" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">車台番号</label>
          <input name="vin" defaultValue={defaultValues.vin ?? ''} placeholder="例: AGH30-0123456" className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">状態</label>
          <select name="status" defaultValue={defaultValues.status ?? '在庫'} className={`${inputClass} bg-white`}>
            {VEHICLE_STATUSES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">担当者</label>
          <select name="owner_id" defaultValue={defaultValues.owner_id ?? ''} className={`${inputClass} bg-white`}>
            <option value="">未設定</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </div>

      <Section title="仕入" />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">仕入日</label>
          <input name="purchase_date" type="date" defaultValue={defaultValues.purchase_date ?? ''} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">仕入価格（円・税抜）</label>
          <input name="purchase_price" type="number" min="0" defaultValue={defaultValues.purchase_price ?? ''} placeholder="例: 1500000" className={inputClass} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">仕入元</label>
        <SearchableSelect
          name="supplier_account_id"
          defaultValue={defaultValues.supplier_account_id}
          options={accountOptions}
          placeholder="取引先から選択"
        />
      </div>

      <Section title="販売" />

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">希望売価（円・税抜）</label>
          <input name="sale_price" type="number" min="0" defaultValue={defaultValues.sale_price ?? ''} placeholder="例: 2200000" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">売却日</label>
          <input name="sold_date" type="date" defaultValue={defaultValues.sold_date ?? ''} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">売却価格（円・税抜）</label>
          <input name="sold_price" type="number" min="0" defaultValue={defaultValues.sold_price ?? ''} placeholder="売却時に入力" className={inputClass} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">売却先</label>
        <SearchableSelect
          name="buyer_account_id"
          defaultValue={defaultValues.buyer_account_id}
          options={accountOptions}
          placeholder="取引先から選択（販売済時）"
        />
      </div>

      <Section title="車検・備考" />

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">次回車検期日</label>
        <input name="next_inspection_date" type="date" defaultValue={defaultValues.next_inspection_date ?? ''} className={inputClass} />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">備考</label>
        <textarea name="description" rows={3} defaultValue={defaultValues.description ?? ''}
          placeholder="装備、修復歴、特記事項など" className={`${inputClass} resize-none`} />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={pending}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">
          {pending ? '保存中...' : '保存'}
        </button>
        <Link href={cancelHref}
          className="px-5 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50">
          キャンセル
        </Link>
      </div>
    </form>
  )
}
