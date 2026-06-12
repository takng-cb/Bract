'use client'

/**
 * スタッフの新規作成・編集フォーム（Issue #69 / REQ-0051）。
 *
 * レコード詳細ページと同じ見た目に揃える:
 *   - RecordColumns（左=スタッフ情報の dense カード / 右=基本情報・メモの広いカード）
 *   - カードは EditableInfoCard（編集モード）と同じスタイル（CreateInfoCard）
 *   - 保存/キャンセルはページヘッダ（RecordHeader actions、form 属性で紐付け）と
 *     フォーム末尾の両方に置く
 */
import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import CreateInfoCard from '@/components/create/CreateInfoCard'
import { RecordColumns } from '@/components/record/RecordUI'

const STATUSES = ['稼働中', '一時休止', '引退']
const GENDERS  = ['男', '女', 'その他']

export type StaffInitial = {
  name?:                  string | null
  name_kana?:             string | null
  belong_account_id?:     string | null
  gender?:                string | null
  birth_date?:            string | null
  phone?:                 string | null
  email?:                 string | null
  skills?:                string[] | null  // ['介護初任者研修','英語']
  available_areas?:       string[] | null
  default_hourly_rate?:   string | number | null
  default_cost_per_hour?: string | number | null
  status?:                string | null
  notes?:                 string | null
}

type Props = {
  action:      (formData: FormData) => Promise<void> | Promise<string>
  cancelHref:  string
  initial?:    StaffInitial
  accounts:    { id: string; name: string }[]
  /** ページヘッダの保存ボタンと紐付ける form id */
  formId?: string
}

export default function StaffForm({ action, cancelHref, initial, accounts, formId = 'record-create-form' }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function toStrArray(v: string[] | null | undefined): string {
    return v && v.length > 0 ? v.join(', ') : ''
  }
  function toStr(v: string | number | null | undefined): string {
    return v == null ? '' : String(v)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        const r = await action(fd)
        // 新規作成時は action 内 redirect されないので、ここで遷移
        if (typeof r === 'string') {
          router.push(`/staff/${r}`)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    })
  }

  const opt = (v: string) => ({ value: v, label: v })

  return (
    <form id={formId} onSubmit={handleSubmit}>
      {error && (
        <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm px-3 py-2 rounded-md">{error}</div>
      )}

      <RecordColumns
        narrow
        left={
          <CreateInfoCard
            dense
            title="スタッフ情報"
            fields={[
              { label: '所属人材会社', name: 'belong_account_id', kind: 'select', defaultValue: toStr(initial?.belong_account_id), options: accounts.map((a) => ({ value: a.id, label: a.name })), emptyOption: '— 未設定 —', hint: '取引先（人材会社）から選択' },
              { label: '状態', name: 'status', kind: 'select', defaultValue: initial?.status ?? '稼働中', options: STATUSES.map(opt), emptyOption: null },
              { label: '性別', name: 'gender', kind: 'select', defaultValue: toStr(initial?.gender), options: GENDERS.map(opt) },
              { label: '生年月日', name: 'birth_date', kind: 'date', defaultValue: toStr(initial?.birth_date) },
              { label: '電話', name: 'phone', kind: 'tel', defaultValue: toStr(initial?.phone) },
              { label: 'メール', name: 'email', kind: 'email', defaultValue: toStr(initial?.email) },
              { label: '標準時給（請求）', name: 'default_hourly_rate', kind: 'number', min: 0, defaultValue: toStr(initial?.default_hourly_rate), hint: '顧客への請求時給の参考値' },
              { label: '標準時給（仕入）', name: 'default_cost_per_hour', kind: 'number', min: 0, defaultValue: toStr(initial?.default_cost_per_hour), hint: '人材会社への支払時給の参考値' },
              { label: 'スキル', name: 'skills', defaultValue: toStrArray(initial?.skills), placeholder: '例: 介護初任者研修, 英語', hint: 'カンマ区切り（例: 介護初任者研修, 英語, 接客5年）' },
              { label: '対応エリア', name: 'available_areas', defaultValue: toStrArray(initial?.available_areas), placeholder: '例: 東京, 神奈川', hint: 'カンマ区切り（例: 東京, 神奈川）' },
            ]}
          />
        }
      >
        <CreateInfoCard
          title="基本情報"
          fields={[
            { label: '氏名', name: 'name', defaultValue: toStr(initial?.name), required: true, fullWidth: true },
            { label: 'フリガナ', name: 'name_kana', defaultValue: toStr(initial?.name_kana), fullWidth: true },
            { label: 'メモ', name: 'notes', kind: 'textarea', defaultValue: toStr(initial?.notes), fullWidth: true },
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
