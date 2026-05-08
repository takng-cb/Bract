'use client'

import { useActionState, useRef } from 'react'
import Link from 'next/link'
import type { FieldDef } from '@/lib/objectMetadata'
import CustomFieldsFields from '@/components/CustomFieldsFields'
import FormFillModal from '@/components/FormFillModal'

type UserOption = { id: string; name: string }

type AccountFormProps = {
  action: (prevState: string | null, formData: FormData) => Promise<string | null>
  cancelHref: string
  users?: UserOption[]
  customFields?: FieldDef[]
  customValues?: Record<string, string | null>
  defaultValues?: {
    name?: string
    type?: string | null
    industry?: string | null
    phone?: string | null
    website?: string | null
    address?: string | null
    annual_revenue?: number | null
    employee_count?: number | null
    description?: string | null
    status?: string
    owner_id?: string | null
  }
}

const INDUSTRIES = [
  'IT・ソフトウェア', '製造業', '商社', '金融・保険', '医療・ヘルスケア',
  '広告・マーケティング', '小売・EC', '食品・飲料', 'エネルギー', '教育', '不動産',
  '弁護士', '司法書士', '税理士', '行政書士', 'その他',
]

const ACCOUNT_TYPES = ['顧客', '見込み客', 'パートナー', '競合他社', 'その他']

export default function AccountForm({ action, cancelHref, users = [], defaultValues = {}, customFields = [], customValues = {} }: AccountFormProps) {
  const [error, formAction, pending] = useActionState(action, null)
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {pending ? '保存中...' : '保存'}
        </button>
        <Link href={cancelHref} className="px-5 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">
          キャンセル
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-1 h-5 rounded-full bg-blue-500 shrink-0" />
        <span className="text-sm font-bold text-zinc-700 tracking-wide">基本情報</span>
        <div className="flex-1 h-px bg-zinc-200" />
        <FormFillModal
          formRef={formRef}
          csvFormat="会社名,種別,業種,電話番号,Webサイト,住所,年間売上,従業員数,ステータス,メモ"
          fieldMap={{
            '会社名': 'name', '種別': 'type', '業種': 'industry', '電話番号': 'phone',
            'Webサイト': 'website', '住所': 'address', '年間売上': 'annual_revenue',
            '従業員数': 'employee_count', 'ステータス': 'status', 'メモ': 'description',
          }}
          valueMap={{ status: { '見込み': 'prospect', '有効': 'active', '無効': 'inactive' } }}
          customFields={customFields}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          会社名 <span className="text-red-500">*</span>
        </label>
        <input
          name="name"
          defaultValue={defaultValues.name ?? ''}
          required
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="例: 株式会社サンプル"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">取引先種別</label>
          <select
            name="type"
            defaultValue={defaultValues.type ?? ''}
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">選択してください</option>
            {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">業種</label>
          <select
            name="industry"
            defaultValue={defaultValues.industry ?? ''}
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">選択してください</option>
            {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">電話番号</label>
          <input
            name="phone"
            defaultValue={defaultValues.phone ?? ''}
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: 03-1234-5678"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Webサイト</label>
          <input
            name="website"
            defaultValue={defaultValues.website ?? ''}
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: https://example.com"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">住所</label>
        <input
          name="address"
          defaultValue={defaultValues.address ?? ''}
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="例: 東京都渋谷区..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">年間売上（円）</label>
          <input
            name="annual_revenue"
            type="number"
            min="0"
            defaultValue={defaultValues.annual_revenue ?? ''}
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: 100000000"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">従業員数</label>
          <input
            name="employee_count"
            type="number"
            min="0"
            defaultValue={defaultValues.employee_count ?? ''}
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: 50"
          />
        </div>
      </div>

      {users.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">担当者</label>
          <select
            name="owner_id"
            defaultValue={defaultValues.owner_id ?? ''}
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">未設定</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">概要・メモ</label>
        <textarea
          name="description"
          rows={3}
          defaultValue={defaultValues.description ?? ''}
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="取引先に関するメモを記入してください..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">ステータス</label>
        <select
          name="status"
          defaultValue={defaultValues.status ?? 'active'}
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="prospect">見込み</option>
          <option value="active">有効</option>
          <option value="inactive">無効</option>
        </select>
      </div>

      <CustomFieldsFields fields={customFields} values={customValues} />

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {pending ? '保存中...' : '保存'}
        </button>
        <Link
          href={cancelHref}
          className="px-5 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors"
        >
          キャンセル
        </Link>
      </div>
    </form>
  )
}
