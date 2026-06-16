'use client'

/**
 * 活動履歴の新規作成/編集フォーム（REQ-0051）。
 *
 * レコード詳細ページと同じ見た目に揃える:
 *   - RecordColumns（左=活動情報・関連レコードの dense カード / 右=件名・内容の広いカード）
 *   - カードは EditableInfoCard（編集モード）と同じスタイル（CreateInfoCard）
 *   - 保存/キャンセルはページヘッダ（RecordHeader actions、form 属性で紐付け）と
 *     フォーム末尾の両方に置く
 */
import { useActionState, useRef } from 'react'
import Link from 'next/link'
import FormFillModal from '@/components/FormFillModal'
import PlaudImportButton from '@/components/PlaudImportButton'
import SearchableSelect from '@/components/SearchableSelect'
import CreateInfoCard from '@/components/create/CreateInfoCard'
import { RecordColumns } from '@/components/record/RecordUI'
import RelatedRecordsPicker, {
  type ObjectTypeOption,
  type RecordOption,
  type RelatedRecordSelection,
} from '@/components/RelatedRecordsPicker'
import type { ActivityType } from '@/lib/activityTypes'
import { NavIcon } from '@/lib/navIcon'

type ActivityFormProps = {
  action:          (prevState: string | null, formData: FormData) => Promise<string | null>
  cancelHref:      string
  /** 選択可能なオブジェクト種別（標準 + 有効カスタム） */
  objectTypes:     ObjectTypeOption[]
  /** オブジェクト api_name → そのレコード一覧 */
  /** @deprecated オンデマンド検索化により未使用 */
  recordsByObject?: Record<string, RecordOption[]>
  /** /admin/books で編集される活動種別。サーバ側から流す。 */
  activityTypes:   ActivityType[]
  /** 担当者ピッカー用ユーザー一覧 */
  users:           { id: string; name: string }[]
  /** ページヘッダの保存ボタンと紐付ける form id */
  formId?: string
  /** PLAUD 取り込み機能の有効可否（コンテナ別フラグ plaud_import。サーバ側で hasFeature 判定） */
  plaudEnabled?: boolean
  defaultValues?: {
    type?:            string
    subject?:         string
    body?:            string | null
    occurred_at?:     string
    owner_id?:        string | null
    related_records?: RelatedRecordSelection[]
  }
}

// CreateInfoCard（dense）の入力欄と同じスタイル（children で手書きする入力に使う）
const INPUT = 'w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 transition-colors'

export default function ActivityForm({
  action,
  cancelHref,
  objectTypes,
  recordsByObject,
  activityTypes,
  users,
  defaultValues = {},
  formId = 'record-create-form',
  plaudEnabled = false,
}: ActivityFormProps) {
  // 表示用に value→label / label→value Map を作成（FormFillModal で使用）
  const typeValueToLabel: Record<string, string> = {}
  const labelToValue: Record<string, string> = {}
  for (const t of activityTypes) {
    typeValueToLabel[t.value] = t.label
    labelToValue[t.label] = t.value
  }
  const [error, formAction, pending] = useActionState(action, null)
  const formRef = useRef<HTMLFormElement>(null)

  const now = new Date()
  const localDatetime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)

  // 「テキストから入力」＋（有効時）「PLAUD取込」。全フィールドを1フォームに流し込む。
  const fillButton = (
    <div className="flex items-center gap-1.5">
      {plaudEnabled && <PlaudImportButton formRef={formRef} />}
      <FormFillModal
        formRef={formRef}
        csvFormat="種別,件名,内容,日時"
        fieldMap={{ '種別': 'type', '件名': 'subject', '内容': 'body', '日時': 'occurred_at' }}
        valueMap={{ type: labelToValue }}
      />
    </div>
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
            <CreateInfoCard dense title="活動情報" action={fillButton} fields={[]}>
              {/* 種別（/admin/books で編集される動的ラベル＋アイコンのラジオ） */}
              <div>
                <span className="block text-[12px] text-zinc-500 mb-1">
                  種別<span className="text-red-500"> *</span>
                </span>
                <div className="flex gap-2 flex-wrap">
                  {activityTypes.map((t) => (
                    <label key={t.value} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="type"
                        value={t.value}
                        defaultChecked={(defaultValues.type ?? activityTypes[0]?.value ?? '') === t.value}
                        className="accent-blue-600"
                      />
                      <span className="text-sm inline-flex items-center gap-1"><NavIcon icon={t.icon} className="w-4 h-4 shrink-0" />{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 日時（既定は現在時刻。defaultValues はローカルタイムに補正して表示） */}
              <label className="block">
                <span className="block text-[12px] text-zinc-500 mb-1">日時</span>
                <input
                  name="occurred_at"
                  type="datetime-local"
                  defaultValue={defaultValues.occurred_at
                    ? new Date(new Date(defaultValues.occurred_at).getTime() - new Date(defaultValues.occurred_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
                    : localDatetime}
                  className={INPUT}
                />
              </label>

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
          title="内容・メモ"
          action={fillButton}
          fields={[
            { label: '件名', name: 'subject', defaultValue: defaultValues.subject, required: true, placeholder: '例: 初回ヒアリング実施', fullWidth: true },
            { label: '内容', name: 'body', kind: 'textarea', defaultValue: defaultValues.body, placeholder: '活動の詳細を記入してください...', fullWidth: true },
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
