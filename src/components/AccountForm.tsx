'use client'

/**
 * 取引先の新規作成フォーム（REQ-0051）。
 *
 * レコード詳細ページと同じ見た目に揃える:
 *   - RecordColumns（左=取引先情報の dense カード / 右=会社情報・メモの広いカード）
 *   - カードは EditableInfoCard（編集モード）と同じスタイル（CreateInfoCard）
 *   - 保存/キャンセルはページヘッダ（RecordHeader actions、form 属性で紐付け）と
 *     フォーム末尾の両方に置く
 */
import { useActionState, useRef } from 'react'
import Link from 'next/link'
import type { FieldDef } from '@/lib/objectMetadata'
import CustomFieldsFields from '@/components/CustomFieldsFields'
import FormFillModal from '@/components/FormFillModal'
import CreateFeedback from '@/components/CreateFeedback'
import CreateInfoCard from '@/components/create/CreateInfoCard'
import { RecordColumns } from '@/components/record/RecordUI'
import type { CreateAction } from '@/lib/duplicateTypes'

type UserOption = { id: string; name: string }

type AccountFormProps = {
  action: CreateAction
  cancelHref: string
  users?: UserOption[]
  customFields?: FieldDef[]
  customValues?: Record<string, string | null>
  /** ページヘッダの保存ボタンと紐付ける form id */
  formId?: string
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

export default function AccountForm({ action, cancelHref, users = [], defaultValues = {}, customFields = [], customValues = {}, formId = 'record-create-form' }: AccountFormProps) {
  const [state, formAction, pending] = useActionState(action, null)
  const formRef = useRef<HTMLFormElement>(null)

  const opt = (v: string) => ({ value: v, label: v })

  return (
    <form id={formId} ref={formRef} action={formAction}>
      <CreateFeedback state={state} formRef={formRef} />

      <RecordColumns
        narrow
        left={
          <CreateInfoCard
            dense
            title="取引先情報"
            fields={[
              { label: '取引先種別', name: 'type', kind: 'select', defaultValue: defaultValues.type, options: ACCOUNT_TYPES.map(opt), emptyOption: '選択してください' },
              { label: '業種', name: 'industry', kind: 'select', defaultValue: defaultValues.industry, options: INDUSTRIES.map(opt), emptyOption: '選択してください' },
              { label: '電話番号', name: 'phone', kind: 'tel', defaultValue: defaultValues.phone, placeholder: '例: 03-1234-5678' },
              { label: 'Webサイト', name: 'website', defaultValue: defaultValues.website, placeholder: '例: https://example.com' },
              { label: '住所', name: 'address', defaultValue: defaultValues.address, placeholder: '例: 東京都渋谷区...' },
              { label: '年間売上（円）', name: 'annual_revenue', kind: 'number', min: 0, defaultValue: defaultValues.annual_revenue, placeholder: '例: 100000000' },
              { label: '従業員数', name: 'employee_count', kind: 'number', min: 0, defaultValue: defaultValues.employee_count, placeholder: '例: 50' },
              { label: '担当者', name: 'owner_id', kind: 'select', defaultValue: defaultValues.owner_id, options: users.map((u) => ({ value: u.id, label: u.name })), emptyOption: '未設定' },
              {
                label: 'ステータス', name: 'status', kind: 'select', defaultValue: defaultValues.status ?? 'active', emptyOption: null,
                options: [
                  { value: 'prospect', label: '見込み' },
                  { value: 'active',   label: '有効' },
                  { value: 'inactive', label: '無効' },
                ],
              },
            ]}
          />
        }
      >
        <CreateInfoCard
          title="会社情報"
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
          fields={[
            { label: '会社名', name: 'name', defaultValue: defaultValues.name, required: true, placeholder: '例: 株式会社サンプル', fullWidth: true },
            { label: '概要・メモ', name: 'description', kind: 'textarea', defaultValue: defaultValues.description, placeholder: '取引先に関するメモを記入してください...', fullWidth: true },
          ]}
        />

        {customFields.length > 0 && (
          <CreateInfoCard title="カスタム項目" fields={[]}>
            <CustomFieldsFields fields={customFields} values={customValues} />
          </CreateInfoCard>
        )}

        {/* フォーム末尾の保存/キャンセル（ヘッダと同じ動作） */}
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
      </RecordColumns>
    </form>
  )
}
