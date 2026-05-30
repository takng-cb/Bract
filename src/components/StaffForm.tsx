'use client'

/**
 * スタッフフォーム (Issue #69)
 * 新規作成・編集 両用
 */
import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'

const FIELD_CLS = 'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

const STATUSES = ['稼働中', '一時休止', '引退']
const GENDERS  = ['男', '女', 'その他']

function Cell({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-xs text-zinc-500 mb-1">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-zinc-400 mt-0.5">{hint}</p>}
    </div>
  )
}

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
}

export default function StaffForm({ action, cancelHref, initial, accounts }: Props) {
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

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm px-3 py-2 rounded-md">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Cell label="氏名 *">
          <input name="name" required defaultValue={toStr(initial?.name)} className={FIELD_CLS} />
        </Cell>
        <Cell label="フリガナ">
          <input name="name_kana" defaultValue={toStr(initial?.name_kana)} className={FIELD_CLS} />
        </Cell>

        <Cell label="所属人材会社" hint="取引先（人材会社）から選択">
          <select name="belong_account_id" defaultValue={toStr(initial?.belong_account_id)} className={`${FIELD_CLS} bg-white`}>
            <option value="">— 未設定 —</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Cell>
        <Cell label="状態">
          <select name="status" defaultValue={initial?.status ?? '稼働中'} className={`${FIELD_CLS} bg-white`}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Cell>

        <Cell label="性別">
          <select name="gender" defaultValue={toStr(initial?.gender)} className={`${FIELD_CLS} bg-white`}>
            <option value="">—</option>
            {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </Cell>
        <Cell label="生年月日">
          <input type="date" name="birth_date" defaultValue={toStr(initial?.birth_date)} className={FIELD_CLS} />
        </Cell>

        <Cell label="電話">
          <input name="phone" defaultValue={toStr(initial?.phone)} className={FIELD_CLS} />
        </Cell>
        <Cell label="メール">
          <input type="email" name="email" defaultValue={toStr(initial?.email)} className={FIELD_CLS} />
        </Cell>

        <Cell label="標準時給（請求）" hint="顧客への請求時給の参考値">
          <input type="number" name="default_hourly_rate" min="0" defaultValue={toStr(initial?.default_hourly_rate)} className={FIELD_CLS} />
        </Cell>
        <Cell label="標準時給（仕入）" hint="人材会社への支払時給の参考値">
          <input type="number" name="default_cost_per_hour" min="0" defaultValue={toStr(initial?.default_cost_per_hour)} className={FIELD_CLS} />
        </Cell>

        <Cell label="スキル" hint="カンマ区切り（例: 介護初任者研修, 英語, 接客5年）">
          <input name="skills" defaultValue={toStrArray(initial?.skills)} className={FIELD_CLS} placeholder="例: 介護初任者研修, 英語" />
        </Cell>
        <Cell label="対応エリア" hint="カンマ区切り（例: 東京, 神奈川）">
          <input name="available_areas" defaultValue={toStrArray(initial?.available_areas)} className={FIELD_CLS} placeholder="例: 東京, 神奈川" />
        </Cell>

        <div className="sm:col-span-2">
          <Cell label="メモ">
            <textarea name="notes" defaultValue={toStr(initial?.notes)} rows={3} className={`${FIELD_CLS} resize-y`} />
          </Cell>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
        <button type="button" onClick={() => router.push(cancelHref)} className="px-4 py-2 text-sm border border-zinc-300 rounded-md hover:bg-zinc-50">
          キャンセル
        </button>
        <button type="submit" disabled={pending} className="px-4 py-2 text-sm bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">
          {pending ? '保存中…' : '保存'}
        </button>
      </div>
    </form>
  )
}
