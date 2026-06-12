'use client'

/**
 * 人物の新規作成・編集フォーム（REQ-0051）。
 *
 * レコード詳細ページと同じ見た目に揃える:
 *   - RecordColumns（左=取引先・基本情報の dense カード / 右=人物タイプ・人物情報・メモの広いカード）
 *   - カードは EditableInfoCard（編集モード）と同じスタイル（CreateInfoCard）
 *   - 保存/キャンセルはページヘッダ（RecordHeader actions、form 属性で紐付け）と
 *     フォーム末尾の両方に置く
 */
import { useActionState, useState, useRef } from 'react'
import Link from 'next/link'
import type { FieldDef } from '@/lib/objectMetadata'
import SearchableSelect from '@/components/SearchableSelect'
import CustomFieldsFields from '@/components/CustomFieldsFields'
import FormFillModal from '@/components/FormFillModal'
import CreateFeedback from '@/components/CreateFeedback'
import CreateInfoCard from '@/components/create/CreateInfoCard'
import { RecordColumns } from '@/components/record/RecordUI'
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
  /** ページヘッダの保存ボタンと紐付ける form id */
  formId?: string
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

export default function ContactForm({ action, cancelHref, accounts, users = [], defaultValues = {}, customFields = [], customValues = {}, formId = 'record-create-form' }: ContactFormProps) {
  const [state, formAction, pending] = useActionState(action, null)
  const [contactType, setContactType] = useState<string>(defaultValues.contact_type ?? 'business')
  const formRef = useRef<HTMLFormElement>(null)

  const isBiz = contactType === 'business'

  // 「テキストから入力」（全フィールドを1フォームに流し込むため、どのカードからでも同じ動作）
  const fillButton = (
    <FormFillModal
      formRef={formRef}
      csvFormat="氏名,役職,部署,メール,電話番号,誕生日,メモ"
      fieldMap={{
        '氏名': 'full_name', '役職': 'title', '部署': 'department',
        'メール': 'email', '電話番号': 'phone', '誕生日': 'birthday', 'メモ': 'description',
      }}
      customFields={customFields}
    />
  )

  return (
    <form id={formId} ref={formRef} action={formAction}>
      <CreateFeedback state={state} formRef={formRef} />

      <RecordColumns
        narrow
        left={
          <>
            {/* 法人担当のみ: 所属取引先（検索付きセレクトのため children で差し込む） */}
            {isBiz && (
              <CreateInfoCard dense title="取引先" fields={[]}>
                <SearchableSelect
                  name="account_id"
                  defaultValue={defaultValues.account_id}
                  options={accounts.map((a) => ({ value: a.id, label: a.name }))}
                  placeholder="選択してください"
                />
              </CreateInfoCard>
            )}

            <CreateInfoCard
              dense
              title="基本情報"
              action={fillButton}
              fields={[
                ...(isBiz ? [
                  { label: '役職', name: 'title', defaultValue: defaultValues.title, placeholder: '例: 営業部長' },
                  { label: '部署', name: 'department', defaultValue: defaultValues.department, placeholder: '例: 営業部' },
                ] : []),
                { label: '誕生日', name: 'birthday', kind: 'date', defaultValue: defaultValues.birthday },
                { label: 'メールアドレス', name: 'email', kind: 'email', defaultValue: defaultValues.email, placeholder: '例: tanaka@example.com' },
                { label: '電話番号', name: 'phone', kind: 'tel', defaultValue: defaultValues.phone, placeholder: '例: 090-1234-5678' },
                { label: '担当者', name: 'owner_id', kind: 'select', defaultValue: defaultValues.owner_id, options: users.map((u) => ({ value: u.id, label: u.name })), emptyOption: '未設定' },
              ]}
            />
          </>
        }
      >
        {/* 人物タイプ（法人担当/個人顧客の切替。左カラムの所属系フィールドが連動して切り替わる） */}
        <CreateInfoCard title="人物タイプ" fields={[]}>
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
        </CreateInfoCard>

        <CreateInfoCard
          title="人物情報"
          action={fillButton}
          fields={[
            { label: '氏名', name: 'full_name', defaultValue: defaultValues.full_name, required: true, placeholder: '例: 田中 太郎', fullWidth: true },
            { label: 'メモ', name: 'description', kind: 'textarea', defaultValue: defaultValues.description, placeholder: 'メモを記入してください...', fullWidth: true },
          ]}
        />

        {customFields.length > 0 && (
          <CreateInfoCard title="カスタム項目" fields={[]}>
            <CustomFieldsFields fields={customFields} values={customValues} />
          </CreateInfoCard>
        )}
      </RecordColumns>

      {/* 保存/キャンセルはページ最下部（2カラムの外・全幅）に置く */}
      <div className="mt-6 flex justify-center gap-3 border-t border-zinc-200 pt-5">
        <button
          type="submit"
          disabled={pending}
          className="px-8 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {pending ? '保存中...' : '保存'}
        </button>
        <Link href={cancelHref} className="px-6 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">
          キャンセル
        </Link>
      </div>
    </form>
  )
}
