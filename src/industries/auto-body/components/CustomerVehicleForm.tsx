'use client'

/**
 * 顧客車両（customer_vehicles）の新規・編集フォーム。
 * 板金・自動車整備業の業務オーバーレイ。
 */
import { useActionState } from 'react'
import Link from 'next/link'
import SearchableSelect from '@/components/SearchableSelect'

export type CustomerVehicleFormDefaults = {
  account_id?: string | null
  transport_branch?: string | null
  classification_number?: string | null
  kana?: string | null
  plate_number?: string | null
  car_name?: string | null
  car_model?: string | null
  grade?: string | null
  vehicle_kind?: string | null
  vehicle_usage?: string | null
  private_business?: string | null
  body_shape?: string | null
  vin?: string | null
  type_designation?: string | null
  class_category?: string | null
  first_registration_year?: string | null
  first_registration_month?: string | null
  inspection_due_date?: string | null
  memo?: string | null
  owner_id?: string | null
}

type Props = {
  action:        (prevState: string | null, formData: FormData) => Promise<string | null>
  cancelHref:    string
  accounts:      { id: string; name: string }[]
  users:         { id: string; name: string }[]
  defaultValues?: CustomerVehicleFormDefaults
}

export default function CustomerVehicleForm({ action, cancelHref, accounts, users, defaultValues = {} }: Props) {
  const [error, formAction, pending] = useActionState(action, null)

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

      {/* 顧客（取引先） */}
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">顧客</h2>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            取引先 <span className="text-red-500">*</span>
          </label>
          <SearchableSelect
            name="account_id"
            defaultValue={defaultValues.account_id ?? undefined}
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            placeholder="選択してください"
          />
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-zinc-700 mb-1">担当</label>
          <SearchableSelect
            name="owner_id"
            defaultValue={defaultValues.owner_id ?? undefined}
            options={users.map((u) => ({ value: u.id, label: u.name }))}
            placeholder="—"
          />
        </div>
      </div>

      {/* ナンバープレート */}
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">ナンバープレート</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">運輸支局</label>
            <input name="transport_branch" defaultValue={defaultValues.transport_branch ?? ''}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例: 名古屋" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">分類番号</label>
            <input name="classification_number" defaultValue={defaultValues.classification_number ?? ''}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例: 300" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">かな</label>
            <input name="kana" defaultValue={defaultValues.kana ?? ''}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例: あ" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">
              ナンバー <span className="text-red-500">*</span>
            </label>
            <input name="plate_number" defaultValue={defaultValues.plate_number ?? ''} required
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例: 12-34" />
          </div>
        </div>
      </div>

      {/* 車両基本情報 */}
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">車両情報</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">車名</label>
            <input name="car_name" defaultValue={defaultValues.car_name ?? ''}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">
              車種 <span className="text-red-500">*</span>
            </label>
            <input name="car_model" defaultValue={defaultValues.car_model ?? ''} required
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">グレード</label>
            <input name="grade" defaultValue={defaultValues.grade ?? ''}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">種別</label>
            <input name="vehicle_kind" defaultValue={defaultValues.vehicle_kind ?? ''}
              placeholder="軽・小型・普通"
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">用途</label>
            <input name="vehicle_usage" defaultValue={defaultValues.vehicle_usage ?? ''}
              placeholder="乗用・貨物"
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">自家・事業</label>
            <input name="private_business" defaultValue={defaultValues.private_business ?? ''}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">車体の形状</label>
            <input name="body_shape" defaultValue={defaultValues.body_shape ?? ''}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">車台番号</label>
            <input name="vin" defaultValue={defaultValues.vin ?? ''}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">型式</label>
            <input name="type_designation" defaultValue={defaultValues.type_designation ?? ''}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">類別区分</label>
            <input name="class_category" defaultValue={defaultValues.class_category ?? ''}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">初年度（年）</label>
            <input name="first_registration_year" defaultValue={defaultValues.first_registration_year ?? ''}
              placeholder="令和7 / 2025"
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">初年度（月）</label>
            <input name="first_registration_month" defaultValue={defaultValues.first_registration_month ?? ''}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">車検満了日</label>
            <input type="date" name="inspection_due_date" defaultValue={defaultValues.inspection_due_date ?? ''}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs text-zinc-500 mb-1">車両メモ</label>
          <textarea name="memo" defaultValue={defaultValues.memo ?? ''} rows={3}
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
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
