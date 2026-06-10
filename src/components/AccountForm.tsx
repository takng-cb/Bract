'use client'

import { useActionState, useRef } from 'react'
import Link from 'next/link'
import type { FieldDef } from '@/lib/objectMetadata'
import CustomFieldsFields from '@/components/CustomFieldsFields'
import FormFillModal from '@/components/FormFillModal'
import CreateFeedback from '@/components/CreateFeedback'
import FormSection from '@/components/FormSection'
import type { CreateAction } from '@/lib/duplicateTypes'

type UserOption = { id: string; name: string }

type AccountFormProps = {
  action: CreateAction
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
  const [state, formAction, pending] = useActionState(action, null)
  const formRef = useRef<HTMLFormElement>(null)

  const labelCls = 'block text-sm font-medium text-zinc-700 mb-1'
  const inputCls = 'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const selectCls = `${inputCls} bg-white`

  const actions = (
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
  )

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <CreateFeedback state={state} formRef={formRef} />

      {actions}

      <FormSection
        title="基本情報"
        action={
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
        }
      >
        <div className="space-y-4">
          <div>
            <label className={labelCls}>会社名 <span className="text-red-500">*</span></label>
            <input name="name" defaultValue={defaultValues.name ?? ''} required className={inputCls} placeholder="例: 株式会社サンプル" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>取引先種別</label>
              <select name="type" defaultValue={defaultValues.type ?? ''} className={selectCls}>
                <option value="">選択してください</option>
                {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>業種</label>
              <select name="industry" defaultValue={defaultValues.industry ?? ''} className={selectCls}>
                <option value="">選択してください</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>電話番号</label>
              <input name="phone" defaultValue={defaultValues.phone ?? ''} className={inputCls} placeholder="例: 03-1234-5678" />
            </div>
            <div>
              <label className={labelCls}>Webサイト</label>
              <input name="website" defaultValue={defaultValues.website ?? ''} className={inputCls} placeholder="例: https://example.com" />
            </div>
          </div>

          <div>
            <label className={labelCls}>住所</label>
            <input name="address" defaultValue={defaultValues.address ?? ''} className={inputCls} placeholder="例: 東京都渋谷区..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>年間売上（円）</label>
              <input name="annual_revenue" type="number" min="0" defaultValue={defaultValues.annual_revenue ?? ''} className={inputCls} placeholder="例: 100000000" />
            </div>
            <div>
              <label className={labelCls}>従業員数</label>
              <input name="employee_count" type="number" min="0" defaultValue={defaultValues.employee_count ?? ''} className={inputCls} placeholder="例: 50" />
            </div>
          </div>

          <div>
            <label className={labelCls}>担当者</label>
            <select name="owner_id" defaultValue={defaultValues.owner_id ?? ''} className={selectCls}>
              <option value="">未設定</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>概要・メモ</label>
            <textarea name="description" rows={3} defaultValue={defaultValues.description ?? ''} className={`${inputCls} resize-none`} placeholder="取引先に関するメモを記入してください..." />
          </div>

          <div>
            <label className={labelCls}>ステータス</label>
            <select name="status" defaultValue={defaultValues.status ?? 'active'} className={selectCls}>
              <option value="prospect">見込み</option>
              <option value="active">有効</option>
              <option value="inactive">無効</option>
            </select>
          </div>
        </div>
      </FormSection>

      {customFields.length > 0 && (
        <FormSection title="カスタム項目">
          <CustomFieldsFields fields={customFields} values={customValues} />
        </FormSection>
      )}

      {actions}
    </form>
  )
}
