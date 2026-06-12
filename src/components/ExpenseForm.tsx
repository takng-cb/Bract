'use client'

/**
 * 経費の新規作成・編集フォーム（REQ-0051）。
 *
 * レコード詳細ページと同じ見た目に揃える:
 *   - RecordColumns（左=経費情報・関連レコードの dense カード / 右=件名・備考の広いカード）
 *   - カードは EditableInfoCard（編集モード）と同じスタイル（CreateInfoCard）
 *   - 保存/キャンセルはページヘッダ（RecordHeader actions、form 属性で紐付け）と
 *     フォーム末尾の両方に置く
 */
import { useActionState, useRef } from 'react'
import Link from 'next/link'
import FormFillModal from '@/components/FormFillModal'
import CreateInfoCard from '@/components/create/CreateInfoCard'
import { RecordColumns } from '@/components/record/RecordUI'
import RelatedRecordsPicker, {
  type ObjectTypeOption,
  type RecordOption,
  type RelatedRecordSelection,
} from '@/components/RelatedRecordsPicker'

type ExpenseFormProps = {
  action:          (prevState: string | null, formData: FormData) => Promise<string | null>
  cancelHref:      string
  objectTypes:     ObjectTypeOption[]
  /** @deprecated オンデマンド検索化により未使用 */
  recordsByObject?: Record<string, RecordOption[]>
  /** ページヘッダの保存ボタンと紐付ける form id */
  formId?: string
  defaultValues?: {
    title?:           string
    amount?:          number | null
    category?:        string
    expense_date?:    string
    notes?:           string | null
    related_records?: RelatedRecordSelection[]
  }
}

const CATEGORIES = ['交通費', '接待費', '通信費', '消耗品費', '広告費', '外注費', 'その他']

export default function ExpenseForm({
  action, cancelHref, objectTypes, recordsByObject, defaultValues = {}, formId = 'record-create-form',
}: ExpenseFormProps) {
  const [error, formAction, pending] = useActionState(action, null)
  const formRef = useRef<HTMLFormElement>(null)
  const today = new Date().toISOString().slice(0, 10)

  const opt = (v: string) => ({ value: v, label: v })

  // 「テキストから入力」（全フィールドを1フォームに流し込むため、どのカードからでも同じ動作）
  const fillButton = (
    <FormFillModal
      formRef={formRef}
      csvFormat="件名,金額,カテゴリ,日付,備考"
      fieldMap={{ '件名': 'title', '金額': 'amount', 'カテゴリ': 'category', '日付': 'expense_date', '備考': 'notes' }}
    />
  )

  return (
    <form id={formId} ref={formRef} action={formAction}>
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>
      )}

      <RecordColumns
        narrow
        left={
          <>
            <CreateInfoCard
              dense
              title="経費情報"
              action={fillButton}
              fields={[
                { label: '日付', name: 'expense_date', kind: 'date', defaultValue: defaultValues.expense_date ?? today },
                { label: '金額（円）', name: 'amount', kind: 'number', min: 1, defaultValue: defaultValues.amount, required: true, placeholder: '例: 15000' },
                { label: 'カテゴリ', name: 'category', kind: 'select', defaultValue: defaultValues.category ?? 'その他', options: CATEGORIES.map(opt), emptyOption: null },
              ]}
            />

            {/* 関連レコード（詳細ページと同じく左カラムの独立カード。Picker は children でそのまま差し込む） */}
            <CreateInfoCard dense title="関連レコード" fields={[]}>
              <div>
                <span className="block text-[12px] text-zinc-500 mb-1">標準 / カスタムブックのレコードを複数選択できます</span>
                <RelatedRecordsPicker
                  name="related_records"
                  objectTypes={objectTypes}
                  recordsByObject={recordsByObject}
                  defaultValue={defaultValues.related_records ?? []}
                />
              </div>
            </CreateInfoCard>
          </>
        }
      >
        <CreateInfoCard
          title="件名・備考"
          action={fillButton}
          fields={[
            { label: '件名', name: 'title', defaultValue: defaultValues.title, required: true, placeholder: '例: 顧客との会食', fullWidth: true },
            { label: '備考', name: 'notes', kind: 'textarea', defaultValue: defaultValues.notes, placeholder: '詳細や目的を記入してください...', fullWidth: true },
          ]}
        />
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
