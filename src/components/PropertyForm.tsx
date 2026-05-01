'use client'

import { useActionState } from 'react'
import Link from 'next/link'

const PROPERTY_TYPES = ['マンション', '戸建て', '土地', 'ビル', '店舗', '倉庫', 'その他']
const TRANSACTION_TYPES = ['売買', '賃貸']
const STATUSES = ['募集中', '交渉中', '成約', '管理中', '終了']

type Account  = { id: string; name: string }
type Contact  = { id: string; full_name: string }

interface DefaultValues {
  name?:             string
  property_type?:    string
  transaction_type?: string
  status?:           string
  address?:          string | null
  area?:             number | null
  price?:            number | null
  floor?:            number | null
  total_floors?:     number | null
  built_year?:       number | null
  account_id?:       string | null
  contact_id?:       string | null
  description?:      string | null
}

interface Props {
  action:        (_: string | null, formData: FormData) => Promise<string | null>
  cancelHref:    string
  accounts:      Account[]
  contacts:      Contact[]
  defaultValues?: DefaultValues
}

export default function PropertyForm({ action, cancelHref, accounts, contacts, defaultValues = {} }: Props) {
  const [error, formAction, pending] = useActionState(action, null)
  const d = defaultValues

  const field = 'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const label = 'block text-sm font-medium text-zinc-700 mb-1'

  return (
    <form action={formAction} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>
      )}

      {/* 物件名 */}
      <div>
        <label className={label}>物件名 <span className="text-red-500">*</span></label>
        <input type="text" name="name" required defaultValue={d.name ?? ''} placeholder="例：○○マンション301号室" className={field} />
      </div>

      {/* 種別 / 取引種別 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>物件種別</label>
          <select name="property_type" defaultValue={d.property_type ?? 'その他'} className={field}>
            {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>取引種別</label>
          <select name="transaction_type" defaultValue={d.transaction_type ?? '売買'} className={field}>
            {TRANSACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* ステータス */}
      <div>
        <label className={label}>ステータス</label>
        <select name="status" defaultValue={d.status ?? '募集中'} className={field}>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* 所在地 */}
      <div>
        <label className={label}>所在地</label>
        <input type="text" name="address" defaultValue={d.address ?? ''} placeholder="例：東京都渋谷区○○1-2-3" className={field} />
      </div>

      {/* 面積 / 価格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>面積（㎡）</label>
          <input type="number" name="area" defaultValue={d.area ?? ''} min="0" step="0.01" placeholder="例：65.5" className={field} />
        </div>
        <div>
          <label className={label}>価格 / 賃料（円）</label>
          <input type="number" name="price" defaultValue={d.price ?? ''} min="0" placeholder="例：50000000" className={field} />
        </div>
      </div>

      {/* 所在階 / 総階数 / 築年 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={label}>所在階</label>
          <input type="number" name="floor" defaultValue={d.floor ?? ''} min="1" placeholder="例：3" className={field} />
        </div>
        <div>
          <label className={label}>総階数</label>
          <input type="number" name="total_floors" defaultValue={d.total_floors ?? ''} min="1" placeholder="例：10" className={field} />
        </div>
        <div>
          <label className={label}>築年（西暦）</label>
          <input type="number" name="built_year" defaultValue={d.built_year ?? ''} min="1900" max={new Date().getFullYear()} placeholder="例：2005" className={field} />
        </div>
      </div>

      {/* 関連取引先 / 関連担当者 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>関連取引先</label>
          <select name="account_id" defaultValue={d.account_id ?? ''} className={field}>
            <option value="">— 選択しない —</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>関連担当者</label>
          <select name="contact_id" defaultValue={d.contact_id ?? ''} className={field}>
            <option value="">— 選択しない —</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
        </div>
      </div>

      {/* 備考 */}
      <div>
        <label className={label}>備考</label>
        <textarea name="description" rows={4} defaultValue={d.description ?? ''} placeholder="物件の詳細情報、特記事項など" className={`${field} resize-none`} />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? '保存中...' : '保存'}
        </button>
        <Link href={cancelHref} className="px-4 py-2 border border-zinc-300 text-sm rounded-md hover:bg-zinc-50 transition-colors">
          キャンセル
        </Link>
      </div>
    </form>
  )
}
