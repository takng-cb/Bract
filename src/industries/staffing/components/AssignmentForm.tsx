'use client'

/**
 * 案件の新規作成/編集フォーム（REQ-0051）。重複検出 → 確認画面に対応（REQ-0018）。
 *
 * レコード詳細ページと同じ見た目に揃える:
 *   - RecordColumns（左=案件情報の dense カード / 右=業務内容・メモの広いカード）
 *   - カードは EditableInfoCard（編集モード）と同じスタイル（CreateInfoCard）
 *   - time 入力（開始/終了時間）は CreateInfoCard 未対応のため children として差し込む
 *   - 保存/キャンセルはページヘッダ（RecordHeader actions、form 属性で紐付け）と
 *     フォーム末尾の両方に置く
 */
import { useActionState, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import CreateFeedback from '@/components/CreateFeedback'
import CreateInfoCard from '@/components/create/CreateInfoCard'
import { RecordColumns } from '@/components/record/RecordUI'
import type { CreateAction } from '@/lib/duplicateTypes'

/** 新規（予約/確定のみ）と編集（全ステータス）で選択肢が異なる */
const STATUS_OPTIONS_CREATE = ['予約', '確定']
const STATUS_OPTIONS_EDIT   = ['予約', '確定', '実施中', '完了', 'キャンセル']

/** CreateInfoCard の入力欄と同じ見た目（time 入力等の生 input 用） */
const INPUT = 'w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 transition-colors'

/** dense カード内のラベル付きフィールド（time 入力等を包むための薄いラッパ） */
function DenseField({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <span className="block text-[12px] text-zinc-500 mb-1">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </div>
  )
}

type AssignmentFormProps = {
  action: CreateAction
  cancelHref: string
  clientAccounts: { id: string; name: string }[]
  /** 'edit' でステータス全選択肢＋編集用ラベルに切替（既定 'create'） */
  mode?: 'create' | 'edit'
  /** ページヘッダの保存ボタンと紐付ける form id */
  formId?: string
  defaultValues?: {
    client_account_id?: string | null
    service_date?: string | null
    service_start_time?: string | null
    service_end_time?: string | null
    service_type?: string | null
    service_location?: string | null
    service_description?: string | null
    staff_count_required?: number | null
    client_total_fee?: number | string | null
    status?: string | null
    internal_memo?: string | null
  }
}

export default function AssignmentForm({ action, cancelHref, clientAccounts, mode = 'create', defaultValues = {}, formId = 'record-create-form' }: AssignmentFormProps) {
  const [state, formAction, pending] = useActionState(action, null)
  const formRef = useRef<HTMLFormElement>(null)

  const isEdit = mode === 'edit'
  const statusOptions = isEdit ? STATUS_OPTIONS_EDIT : STATUS_OPTIONS_CREATE

  return (
    <form id={formId} ref={formRef} action={formAction}>
      <CreateFeedback state={state} formRef={formRef} />

      <RecordColumns
        narrow
        left={
          <CreateInfoCard dense title="案件情報" fields={[]}>
            <DenseField label="派遣先（取引先）" required>
              <select name="client_account_id" required defaultValue={defaultValues.client_account_id ?? ''} className={INPUT}>
                <option value="">{isEdit ? '— 選択 —' : '— 選択してください —'}</option>
                {clientAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </DenseField>
            <DenseField label="業務日">
              <input type="date" name="service_date" defaultValue={defaultValues.service_date ?? ''} className={INPUT} />
            </DenseField>
            <DenseField label="開始時間">
              <input type="time" name="service_start_time" defaultValue={defaultValues.service_start_time ?? ''} className={INPUT} />
            </DenseField>
            <DenseField label="終了時間">
              <input type="time" name="service_end_time" defaultValue={defaultValues.service_end_time ?? ''} className={INPUT} />
            </DenseField>
            <DenseField label="業務区分">
              <input name="service_type" defaultValue={defaultValues.service_type ?? ''} placeholder="例: 接客 / 介護補助 / レセプション" className={INPUT} />
            </DenseField>
            <DenseField label="場所">
              <input name="service_location" defaultValue={defaultValues.service_location ?? ''} placeholder="例: 〇〇病院 3階" className={INPUT} />
            </DenseField>
            <DenseField label="募集人数">
              <input type="number" name="staff_count_required" min={isEdit ? undefined : 1} defaultValue={defaultValues.staff_count_required ?? ''} className={INPUT} />
            </DenseField>
            <DenseField label={isEdit ? '請求総額' : '請求総額（派遣先からの受取）'}>
              <input type="number" name="client_total_fee" min={isEdit ? undefined : 0} defaultValue={defaultValues.client_total_fee ?? ''} className={INPUT} />
            </DenseField>
            <DenseField label="ステータス">
              <select name="status" defaultValue={defaultValues.status ?? '予約'} className={INPUT}>
                {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </DenseField>
          </CreateInfoCard>
        }
      >
        <CreateInfoCard
          title="業務内容・メモ"
          fields={[
            { label: '業務内容', name: 'service_description', kind: 'textarea', defaultValue: defaultValues.service_description, fullWidth: true },
            { label: '内部メモ', name: 'internal_memo', kind: 'textarea', defaultValue: defaultValues.internal_memo, fullWidth: true },
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
