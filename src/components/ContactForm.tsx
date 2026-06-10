'use client'

import { useActionState, useState, useRef } from 'react'
import Link from 'next/link'
import type { FieldDef } from '@/lib/objectMetadata'
import SearchableSelect from '@/components/SearchableSelect'
import CustomFieldsFields from '@/components/CustomFieldsFields'
import FormFillModal from '@/components/FormFillModal'
import CreateFeedback from '@/components/CreateFeedback'
import FormSection from '@/components/FormSection'
import type { CreateAction } from '@/lib/duplicateTypes'

type Account    = { id: string; name: string }
type UserOption = { id: string; name: string }

type ContactFormProps = {
  action: CreateAction
  cancelHref: string
  accounts: Account[]
  users?: UserOption[]
  customFields?: FieldDef[]
  customValues?: Record<string, string | null>
  defaultValues?: {
    contact_type?: string | null
    full_name?: string
    email?: string | null
    phone?: string | null
    title?: string | null
    department?: string | null
    birthday?: string | null
    description?: string | null
    account_id?: string | null
    owner_id?: string | null
  }
}

export default function ContactForm({ action, cancelHref, accounts, users = [], defaultValues = {}, customFields = [], customValues = {} }: ContactFormProps) {
  const [state, formAction, pending] = useActionState(action, null)
  const [contactType, setContactType] = useState<string>(defaultValues.contact_type ?? 'business')
  const formRef = useRef<HTMLFormElement>(null)

  const field = 'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const lbl   = 'block text-sm font-medium text-zinc-700 mb-1'

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
            csvFormat="氏名,役職,部署,メール,電話番号,誕生日,メモ"
            fieldMap={{
              '氏名': 'full_name', '役職': 'title', '部署': 'department',
              'メール': 'email', '電話番号': 'phone', '誕生日': 'birthday', 'メモ': 'description',
            }}
            customFields={customFields}
          />
        }
      >
        <div className="space-y-4">
      {/* 人物タイプ */}
      <div>
        <label className={lbl}>人物タイプ</label>
        <div className="flex gap-0 rounded-md border border-zinc-300 overflow-hidden w-fit">
          {[
            { value: 'business', label: '法人担当（ToB）' },
            { value: 'consumer', label: '個人顧客（ToC）' },
          ].map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setContactType(value)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                contactType === value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input type="hidden" name="contact_type" value={contactType} />
      </div>

      {/* 氏名 */}
      <div>
        <label className={lbl}>氏名 <span className="text-red-500">*</span></label>
        <input
          name="full_name"
          defaultValue={defaultValues.full_name ?? ''}
          required
          className={field}
          placeholder="例: 田中 太郎"
        />
      </div>

      {/* 法人担当のみ: 取引先・役職・部署 */}
      {contactType === 'business' && (
        <>
          <div>
            <label className={lbl}>取引先</label>
            <SearchableSelect
              name="account_id"
              defaultValue={defaultValues.account_id}
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
              placeholder="選択してください"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>役職</label>
              <input
                name="title"
                defaultValue={defaultValues.title ?? ''}
                className={field}
                placeholder="例: 営業部長"
              />
            </div>
            <div>
              <label className={lbl}>部署</label>
              <input
                name="department"
                defaultValue={defaultValues.department ?? ''}
                className={field}
                placeholder="例: 営業部"
              />
            </div>
          </div>
        </>
      )}

      {/* 共通: メール・電話 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={lbl}>メールアドレス</label>
          <input
            name="email"
            type="email"
            defaultValue={defaultValues.email ?? ''}
            className={field}
            placeholder="例: tanaka@example.com"
          />
        </div>
        <div>
          <label className={lbl}>電話番号</label>
          <input
            name="phone"
            defaultValue={defaultValues.phone ?? ''}
            className={field}
            placeholder="例: 090-1234-5678"
          />
        </div>
      </div>

      {/* 共通: 誕生日 */}
      <div>
        <label className={lbl}>誕生日</label>
        <input
          name="birthday"
          type="date"
          defaultValue={defaultValues.birthday ?? ''}
          className={field}
        />
      </div>

      {/* 担当者 */}
      <div>
        <label className={lbl}>担当者</label>
        <select
          name="owner_id"
          defaultValue={defaultValues.owner_id ?? ''}
          className={`${field} bg-white`}
        >
          <option value="">未設定</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      {/* 共通: メモ */}
      <div>
        <label className={lbl}>メモ</label>
        <textarea
          name="description"
          rows={3}
          defaultValue={defaultValues.description ?? ''}
          className={`${field} resize-none`}
          placeholder="メモを記入してください..."
        />
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
