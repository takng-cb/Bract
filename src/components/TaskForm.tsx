'use client'

/**
 * ToDo の新規作成/編集フォーム（REQ-0051）。
 *
 * レコード詳細ページと同じ見た目に揃える:
 *   - RecordColumns（左=ToDo情報・関連レコードの dense カード / 右=件名・詳細メモの広いカード）
 *   - カードは EditableInfoCard（編集モード）と同じスタイル（CreateInfoCard）
 *   - 保存/キャンセルはページヘッダ（RecordHeader actions、form 属性で紐付け）と
 *     フォーム末尾の両方に置く
 */
import { useActionState, useRef } from 'react'
import Link from 'next/link'
import FormFillModal from '@/components/FormFillModal'
import SearchableSelect from '@/components/SearchableSelect'
import CreateInfoCard from '@/components/create/CreateInfoCard'
import { RecordColumns } from '@/components/record/RecordUI'
import RelatedRecordsPicker, {
  type ObjectTypeOption,
  type RecordOption,
  type RelatedRecordSelection,
} from '@/components/RelatedRecordsPicker'

type TaskFormProps = {
  action:          (prevState: string | null, formData: FormData) => Promise<string | null>
  cancelHref:      string
  objectTypes:     ObjectTypeOption[]
  /** @deprecated オンデマンド検索化により未使用 */
  recordsByObject?: Record<string, RecordOption[]>
  users:           { id: string; name: string }[]
  /** ページヘッダの保存ボタンと紐付ける form id */
  formId?: string
  defaultValues?: {
    title?:           string
    description?:     string | null
    due_date?:        string | null
    priority?:        string
    owner_id?:        string | null
    related_records?: RelatedRecordSelection[]
  }
}

const PRIORITIES = [
  { value: 'high',   label: '高', color: 'text-red-600',    dot: 'bg-red-500' },
  { value: 'medium', label: '中', color: 'text-yellow-600', dot: 'bg-amber-400' },
  { value: 'low',    label: '低', color: 'text-green-600',  dot: 'bg-green-500' },
]

export default function TaskForm({ action, cancelHref, objectTypes, recordsByObject, users, defaultValues = {}, formId = 'record-create-form' }: TaskFormProps) {
  const [error, formAction, pending] = useActionState(action, null)
  const formRef = useRef<HTMLFormElement>(null)

  // 「テキストから入力」（全フィールドを1フォームに流し込むため、どのカードからでも同じ動作）
  const fillButton = (
    <FormFillModal
      formRef={formRef}
      csvFormat="タイトル,期日,優先度,詳細"
      fieldMap={{ 'タイトル': 'title', '期日': 'due_date', '優先度': 'priority', '詳細': 'description' }}
      valueMap={{ priority: { '高': 'high', '中': 'medium', '低': 'low' } }}
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
              title="ToDo情報"
              action={fillButton}
              fields={[
                { label: '期限', name: 'due_date', kind: 'date', defaultValue: defaultValues.due_date },
              ]}
            >
              {/* 優先度（色付きラジオ。詳細ページのバッジ配色に合わせる） */}
              <div>
                <span className="block text-[12px] text-zinc-500 mb-1">優先度</span>
                <div className="flex gap-4">
                  {PRIORITIES.map((p) => (
                    <label key={p.value} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="priority"
                        value={p.value}
                        defaultChecked={(defaultValues.priority ?? 'medium') === p.value}
                        className="accent-blue-600"
                      />
                      <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${p.color}`}>
                        <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${p.dot}`} aria-hidden />
                        {p.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 担当者（検索付きセレクト） */}
              <div>
                <span className="block text-[12px] text-zinc-500 mb-1">担当者</span>
                <SearchableSelect
                  name="owner_id"
                  defaultValue={defaultValues.owner_id ?? undefined}
                  options={users.map((u) => ({ value: u.id, label: u.name }))}
                  placeholder="—"
                />
              </div>
            </CreateInfoCard>

            {/* 関連レコード（詳細ページと同じく左カラムの独立カード） */}
            <CreateInfoCard dense title="関連レコード" fields={[]}>
              <div>
                <span className="block text-[12px] text-zinc-500 mb-1">標準 / カスタムオブジェクトのレコードを複数選択できます</span>
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
          title="ToDo内容"
          action={fillButton}
          fields={[
            { label: 'タイトル', name: 'title', defaultValue: defaultValues.title, required: true, placeholder: '例: 提案書を作成する', fullWidth: true },
            { label: '詳細・メモ（任意・複数行可）', name: 'description', kind: 'textarea', defaultValue: defaultValues.description, placeholder: '例: 添付の見積書をベースに、特記事項として配送料を別途記載する', fullWidth: true },
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
