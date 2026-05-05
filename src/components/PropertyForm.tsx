'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'

const PROPERTY_TYPES  = ['土地・建物', '建物のみ', '土地のみ', 'その他']
const STATUSES_RE     = ['募集中', '交渉中', '成約', '管理中', '終了']
const STATUSES_OTHER  = ['提案中', '交渉中', '成約', '終了']
const TX_TYPES_RE     = ['売買', '賃貸']
const TX_TYPES_OTHER  = ['売買', '賃貸', 'サービス提供', 'その他']


type Account = { id: string; name: string }
type Contact = { id: string; full_name: string }

interface DefaultValues {
  product_category?:           string
  name?:                       string
  property_type?:              string
  transaction_type?:           string
  status?:                     string
  // 土地の登記
  address?:                    string | null
  land_chiban?:                string | null
  chimoku?:                    string | null
  area?:                       number | null   // 地積
  rights_status?:              string | null
  // 建物の登記
  building_kaoku_number?:      string | null
  building_shurui?:            string | null
  structure?:                  string | null
  building_floor_area?:        number | null  // 床面積
  floor?:                      number | null
  total_floors?:               number | null
  built_year?:                 number | null
  // 価格・関連
  price?:                      number | null
  account_id?:                 string | null
  contact_id?:                 string | null
  seller_scrivener_account_id?: string | null
  seller_scrivener_contact_id?: string | null
  buyer_scrivener_account_id?:  string | null
  buyer_scrivener_contact_id?:  string | null
  description?:                string | null
}

interface Props {
  action:             (_: string | null, formData: FormData) => Promise<string | null>
  cancelHref:         string
  accounts:           Account[]
  contacts:           Contact[]
  scrivenerAccounts:  Account[]
  scrivenerContacts:  Contact[]
  defaultValues?:     DefaultValues
}

export default function PropertyForm({
  action, cancelHref, accounts, contacts,
  scrivenerAccounts, scrivenerContacts, defaultValues = {},
}: Props) {
  const [error, formAction, pending] = useActionState(action, null)
  const [category, setCategory] = useState<string>(defaultValues.product_category ?? 'real_estate')
  const d = defaultValues

  const field = 'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const lbl   = 'block text-sm font-medium text-zinc-700 mb-1'

  const isRE     = category === 'real_estate'
  const statuses = isRE ? STATUSES_RE : STATUSES_OTHER
  const txTypes  = isRE ? TX_TYPES_RE : TX_TYPES_OTHER

  return (
    <form action={formAction} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>
      )}

      {/* カテゴリ切り替え */}
      <div>
        <label className={lbl}>カテゴリ</label>
        <div className="flex gap-0 rounded-md border border-zinc-300 overflow-hidden w-fit">
          {[
            { value: 'real_estate', label: '🏠 不動産' },
            { value: 'other',       label: '📦 その他商品' },
          ].map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                category === value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input type="hidden" name="product_category" value={category} />
      </div>

      {/* 物件名 */}
      <div>
        <label className={lbl}>{isRE ? '物件名' : '件名'} <span className="text-red-500">*</span></label>
        <input
          type="text"
          name="name"
          required
          defaultValue={d.name ?? ''}
          placeholder={isRE ? '例：○○マンション301号室' : '例：コンサルティング契約'}
          className={field}
        />
      </div>

      {/* 物件種別 / 取引種別 / ステータス */}
      {isRE ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={lbl}>物件種別</label>
            <select name="property_type" defaultValue={d.property_type ?? 'その他'} className={`${field} bg-white`}>
              {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>取引種別</label>
            <select name="transaction_type" defaultValue={d.transaction_type ?? '売買'} className={`${field} bg-white`}>
              {txTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>ステータス</label>
            <select name="status" defaultValue={d.status ?? '募集中'} className={`${field} bg-white`}>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>取引種別</label>
            <select name="transaction_type" defaultValue={d.transaction_type ?? 'その他'} className={`${field} bg-white`}>
              {txTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>ステータス</label>
            <select name="status" defaultValue={d.status ?? '提案中'} className={`${field} bg-white`}>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* 価格 */}
      <div>
        <label className={lbl}>{isRE ? '価格 / 賃料（円）' : '金額（円）'}</label>
        <input type="number" name="price" defaultValue={d.price ?? ''} min="0" placeholder="例：50000000" className={field} />
      </div>

      {/* ═══════════════════════════════════════════
          不動産のみ：土地の登記
      ═══════════════════════════════════════════ */}
      {isRE && (
        <div className="border border-zinc-200 rounded-lg p-5 space-y-4 bg-zinc-50">
          <h3 className="text-sm font-semibold text-zinc-700 flex items-center gap-1.5">
            🗺️ 土地の登記
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>所在</label>
              <input
                type="text" name="address"
                defaultValue={d.address ?? ''}
                placeholder="例：東京都渋谷区○○一丁目"
                className={field}
              />
            </div>
            <div>
              <label className={lbl}>地番</label>
              <input
                type="text" name="land_chiban"
                defaultValue={d.land_chiban ?? ''}
                placeholder="例：123番4"
                className={field}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={lbl}>地目</label>
              <input
                type="text" name="chimoku"
                defaultValue={d.chimoku ?? ''}
                placeholder="例：宅地、農地、山林"
                className={field}
              />
            </div>
            <div>
              <label className={lbl}>地積（㎡）</label>
              <input
                type="number" name="area"
                defaultValue={d.area ?? ''}
                min="0" step="0.01"
                placeholder="例：165.00"
                className={field}
              />
            </div>
            <div>
              <label className={lbl}>権利状況</label>
              <input
                type="text" name="rights_status"
                defaultValue={d.rights_status ?? ''}
                placeholder="例：所有権、借地権"
                className={field}
              />
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          不動産のみ：建物の登記
      ═══════════════════════════════════════════ */}
      {isRE && (
        <div className="border border-zinc-200 rounded-lg p-5 space-y-4 bg-zinc-50">
          <h3 className="text-sm font-semibold text-zinc-700 flex items-center gap-1.5">
            🏠 建物の登記
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>家屋番号</label>
              <input
                type="text" name="building_kaoku_number"
                defaultValue={d.building_kaoku_number ?? ''}
                placeholder="例：123番4の301"
                className={field}
              />
            </div>
            <div>
              <label className={lbl}>種類</label>
              <input
                type="text" name="building_shurui"
                defaultValue={d.building_shurui ?? ''}
                placeholder="例：居宅、共同住宅、店舗"
                className={field}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>構造</label>
              <input
                type="text" name="structure"
                defaultValue={d.structure ?? ''}
                placeholder="例：鉄筋コンクリート造、木造"
                className={field}
              />
            </div>
            <div>
              <label className={lbl}>床面積（㎡）</label>
              <input
                type="number" name="building_floor_area"
                defaultValue={d.building_floor_area ?? ''}
                min="0" step="0.01"
                placeholder="例：65.50"
                className={field}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={lbl}>所在階</label>
              <input
                type="number" name="floor"
                defaultValue={d.floor ?? ''}
                min="1" placeholder="例：3"
                className={field}
              />
            </div>
            <div>
              <label className={lbl}>総階数</label>
              <input
                type="number" name="total_floors"
                defaultValue={d.total_floors ?? ''}
                min="1" placeholder="例：10"
                className={field}
              />
            </div>
            <div>
              <label className={lbl}>築年（西暦）</label>
              <input
                type="number" name="built_year"
                defaultValue={d.built_year ?? ''}
                min="1900" max={new Date().getFullYear()}
                placeholder="例：2005"
                className={field}
              />
            </div>
          </div>
        </div>
      )}

      {/* 関連取引先 / 関連人物 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>関連取引先</label>
          <select name="account_id" defaultValue={d.account_id ?? ''} className={`${field} bg-white`}>
            <option value="">— 選択しない —</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>関連人物</label>
          <select name="contact_id" defaultValue={d.contact_id ?? ''} className={`${field} bg-white`}>
            <option value="">— 選択しない —</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
        </div>
      </div>

      {/* 不動産のみ: 司法書士情報 */}
      {isRE && (
        <div className="border border-zinc-200 rounded-lg p-4 space-y-4 bg-zinc-50">
          <h3 className="text-sm font-semibold text-zinc-700">⚖️ 司法書士情報</h3>

          {scrivenerAccounts.length === 0 ? (
            <p className="text-xs text-zinc-400">
              業種「司法書士」の取引先が登録されていません。
              <a href="/accounts/new" className="text-blue-600 hover:underline ml-1" target="_blank" rel="noopener">取引先を追加</a>
            </p>
          ) : (
            <>
              <div>
                <p className="text-xs font-medium text-zinc-500 mb-2">売り方司法書士</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>事務所（取引先）</label>
                    <select name="seller_scrivener_account_id" defaultValue={d.seller_scrivener_account_id ?? ''} className={`${field} bg-white`}>
                      <option value="">— 選択しない —</option>
                      {scrivenerAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>担当者</label>
                    <select name="seller_scrivener_contact_id" defaultValue={d.seller_scrivener_contact_id ?? ''} className={`${field} bg-white`}>
                      <option value="">— 選択しない —</option>
                      {scrivenerContacts.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-zinc-500 mb-2">買い方司法書士</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>事務所（取引先）</label>
                    <select name="buyer_scrivener_account_id" defaultValue={d.buyer_scrivener_account_id ?? ''} className={`${field} bg-white`}>
                      <option value="">— 選択しない —</option>
                      {scrivenerAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>担当者</label>
                    <select name="buyer_scrivener_contact_id" defaultValue={d.buyer_scrivener_contact_id ?? ''} className={`${field} bg-white`}>
                      <option value="">— 選択しない —</option>
                      {scrivenerContacts.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 備考 */}
      <div>
        <label className={lbl}>備考</label>
        <textarea
          name="description"
          rows={4}
          defaultValue={d.description ?? ''}
          placeholder={isRE ? '物件の詳細情報、特記事項など' : '商品・サービスの詳細情報など'}
          className={`${field} resize-none`}
        />
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
