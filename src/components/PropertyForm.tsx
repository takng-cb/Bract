'use client'

import { useActionState, useState, useRef } from 'react'
import Link from 'next/link'
import type { FieldDef } from '@/lib/objectMetadata'
import SearchableSelect from '@/components/SearchableSelect'
import CustomFieldsFields from '@/components/CustomFieldsFields'
import FormFillModal from '@/components/FormFillModal'

const PROPERTY_TYPES  = ['土地・建物', '建物のみ', '土地のみ', 'その他']
const STATUSES_RE     = ['募集中', '交渉中', '成約', '管理中', '終了']
const STATUSES_OTHER  = ['提案中', '交渉中', '成約', '終了']
const TX_TYPES_RE     = ['売買', '賃貸']
const TX_TYPES_OTHER  = ['売買', '賃貸', 'サービス提供', 'その他']

type Account = { id: string; name: string }
type Contact = { id: string; full_name: string; account_id?: string | null }

interface DefaultValues {
  product_category?:  string
  name?:              string
  property_type?:     string
  transaction_type?:  string
  status?:            string
  price?:             number | null
  account_id?:        string | null
  contact_id?:        string | null
  seller_scrivener_account_id?: string | null
  seller_scrivener_contact_id?: string | null
  buyer_scrivener_account_id?:  string | null
  buyer_scrivener_contact_id?:  string | null
  // 土地 表題部
  land_fudosan_number?: string | null
  address?:             string | null
  land_chiban?:         string | null
  chimoku?:             string | null
  area?:                number | null
  land_cause?:          string | null
  // 土地 甲区
  land_owner_name?:           string | null
  land_owner_address?:        string | null
  land_acquisition_reason?:   string | null
  land_acquisition_date?:     string | null
  land_seizure?:              boolean | null
  land_seizure_release_date?: string | null
  // 建物 表題部
  building_fudosan_number?:        string | null
  building_location?:              string | null
  building_kaoku_number?:          string | null
  building_shurui?:                string | null
  structure?:                      string | null
  building_floor_area_1f?:         number | null
  building_floor_area_2f?:         number | null
  building_floor_area_3f?:         number | null
  building_new_construction_date?: string | null
  // 建物 甲区
  building_owner_name?:           string | null
  building_owner_address?:        string | null
  building_acquisition_reason?:   string | null
  building_acquisition_date?:     string | null
  building_seizure?:              boolean | null
  building_seizure_release_date?: string | null
  // 建物 乙区
  building_lien_type?:               string | null
  building_lien_holder?:             string | null
  building_debt_amount?:             number | null
  building_damage_rate?:             number | null
  building_joint_collateral_number?: string | null
  description?: string | null
}

interface Props {
  action:            (_: string | null, formData: FormData) => Promise<string | null>
  cancelHref:        string
  accounts:          Account[]
  contacts:          Contact[]
  scrivenerAccounts: Account[]
  scrivenerContacts: Contact[]
  defaultValues?:    DefaultValues
  customFields?:     FieldDef[]
  customValues?:     Record<string, string | null>
}

export default function PropertyForm({
  action, cancelHref, accounts, contacts,
  scrivenerAccounts, scrivenerContacts, defaultValues = {},
  customFields = [], customValues = {},
}: Props) {
  const [error, formAction, pending] = useActionState(action, null)
  const [category, setCategory] = useState<string>(defaultValues.product_category ?? 'real_estate')
  const [selectedAccountId, setSelectedAccountId] = useState(defaultValues.account_id ?? '')
  const filteredContacts = selectedAccountId
    ? contacts.filter((c) => c.account_id === selectedAccountId)
    : contacts
  const formRef = useRef<HTMLFormElement | null>(null)
  const d = defaultValues

  const field = 'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const lbl   = 'block text-sm font-medium text-zinc-700 mb-1'
  const sec   = 'border border-zinc-200 rounded-lg p-5 space-y-4 bg-zinc-50'
  const secH  = 'text-sm font-semibold text-zinc-700'
  const subH  = 'text-xs font-semibold text-zinc-500 border-b border-zinc-200 pb-1 mb-3'

  const isRE     = category === 'real_estate'
  const statuses = isRE ? STATUSES_RE : STATUSES_OTHER
  const txTypes  = isRE ? TX_TYPES_RE : TX_TYPES_OTHER

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>
      )}

      <div className="flex gap-3">
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

      <div className="flex items-center gap-3">
        <div className="w-1 h-5 rounded-full bg-blue-500 shrink-0" />
        <span className="text-sm font-bold text-zinc-700 tracking-wide">基本情報</span>
        <div className="flex-1 h-px bg-zinc-200" />
        <FormFillModal
          formRef={formRef}
          csvFormat="件名,物件種別,取引種別,ステータス,価格(円),土地不動産番号,土地所在,地番,地目,地積(㎡),原因及びその日付,土地現所有者名,土地所有者住所,土地所有権取得原因,土地所有権取得日,土地直近差押解除日,建物不動産番号,建物所在,家屋番号,種類,構造,床面積1階(㎡),床面積2階(㎡),床面積3階(㎡),新築年月日,建物現所有者名,建物所有者住所,建物所有権取得原因,建物所有権取得日,建物直近差押解除日,登記種別,権利者名,債権額(円),損害金率(%),共同担保目録番号,備考"
          fieldMap={{
            '件名': 'name', '物件種別': 'property_type', '取引種別': 'transaction_type',
            'ステータス': 'status', '価格(円)': 'price',
            '土地不動産番号': 'land_fudosan_number', '土地所在': 'address',
            '地番': 'land_chiban', '地目': 'chimoku', '地積(㎡)': 'area',
            '原因及びその日付': 'land_cause',
            '土地現所有者名': 'land_owner_name', '土地所有者住所': 'land_owner_address',
            '土地所有権取得原因': 'land_acquisition_reason', '土地所有権取得日': 'land_acquisition_date',
            '土地直近差押解除日': 'land_seizure_release_date',
            '建物不動産番号': 'building_fudosan_number', '建物所在': 'building_location',
            '家屋番号': 'building_kaoku_number', '種類': 'building_shurui', '構造': 'structure',
            '床面積1階(㎡)': 'building_floor_area_1f', '床面積2階(㎡)': 'building_floor_area_2f',
            '床面積3階(㎡)': 'building_floor_area_3f', '新築年月日': 'building_new_construction_date',
            '建物現所有者名': 'building_owner_name', '建物所有者住所': 'building_owner_address',
            '建物所有権取得原因': 'building_acquisition_reason', '建物所有権取得日': 'building_acquisition_date',
            '建物直近差押解除日': 'building_seizure_release_date',
            '登記種別': 'building_lien_type', '権利者名': 'building_lien_holder',
            '債権額(円)': 'building_debt_amount', '損害金率(%)': 'building_damage_rate',
            '共同担保目録番号': 'building_joint_collateral_number', '備考': 'description',
          }}
          valueMap={{
            property_type:    { '土地・建物': '土地・建物', '建物のみ': '建物のみ', '土地のみ': '土地のみ', 'その他': 'その他' },
            transaction_type: { '売買': '売買', '賃貸': '賃貸', 'サービス提供': 'サービス提供', 'その他': 'その他' },
            status:           { '募集中': '募集中', '交渉中': '交渉中', '成約': '成約', '管理中': '管理中', '終了': '終了', '提案中': '提案中' },
          }}
          customFields={customFields}
        />
      </div>

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

      {/* 関連取引先 / 関連人物 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>関連取引先</label>
          <SearchableSelect
            name="account_id"
            defaultValue={d.account_id}
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            placeholder="— 選択しない —"
            onSelect={setSelectedAccountId}
          />
        </div>
        <div>
          <label className={lbl}>関連人物</label>
          <SearchableSelect
            key={selectedAccountId}
            name="contact_id"
            defaultValue={d.contact_id}
            options={filteredContacts.map((c) => ({ value: c.id, label: c.full_name }))}
            placeholder="— 選択しない —"
          />
        </div>
      </div>

      {/* 物件種別 / 取引種別 / ステータス */}
      {isRE ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={lbl}>物件種別</label>
            <select name="property_type" defaultValue={d.property_type ?? '土地・建物'} className={`${field} bg-white`}>
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

      {/* ════════════════════════════════════════════════
          不動産のみ：土地の登記
      ════════════════════════════════════════════════ */}
      {isRE && (
        <div className={sec}>
          <h3 className={secH}>🗺️ 土地の登記</h3>

          {/* 表題部 */}
          <p className={subH}>表題部（土地の表示）</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>不動産番号</label>
              <input type="text" name="land_fudosan_number"
                defaultValue={d.land_fudosan_number ?? ''}
                placeholder="例：1234567890123" maxLength={13} className={field} />
            </div>
            <div>
              <label className={lbl}>所在</label>
              <input type="text" name="address"
                defaultValue={d.address ?? ''}
                placeholder="例：東京都渋谷区○○一丁目" className={field} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={lbl}>地番</label>
              <input type="text" name="land_chiban"
                defaultValue={d.land_chiban ?? ''}
                placeholder="例：123番4" className={field} />
            </div>
            <div>
              <label className={lbl}>地目</label>
              <input type="text" name="chimoku"
                defaultValue={d.chimoku ?? ''}
                placeholder="例：宅地" className={field} />
            </div>
            <div>
              <label className={lbl}>地積（㎡）</label>
              <input type="number" name="area"
                defaultValue={d.area ?? ''}
                min="0" step="0.01" placeholder="例：165.00" className={field} />
            </div>
          </div>
          <div>
            <label className={lbl}>原因及びその日付</label>
            <input type="text" name="land_cause"
              defaultValue={d.land_cause ?? ''}
              placeholder="例：令和○年○月○日売買" className={field} />
          </div>

          {/* 甲区 */}
          <p className={`${subH} mt-2`}>権利部（甲区）</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>現所有者名</label>
              <input type="text" name="land_owner_name"
                defaultValue={d.land_owner_name ?? ''} className={field} />
            </div>
            <div>
              <label className={lbl}>所有者住所</label>
              <input type="text" name="land_owner_address"
                defaultValue={d.land_owner_address ?? ''} className={field} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={lbl}>所有権取得原因</label>
              <input type="text" name="land_acquisition_reason"
                defaultValue={d.land_acquisition_reason ?? ''}
                placeholder="例：売買、相続" className={field} />
            </div>
            <div>
              <label className={lbl}>所有権取得日</label>
              <input type="date" name="land_acquisition_date"
                defaultValue={d.land_acquisition_date ?? ''} className={field} />
            </div>
            <div>
              <label className={lbl}>直近差押解除日</label>
              <input type="date" name="land_seizure_release_date"
                defaultValue={d.land_seizure_release_date ?? ''} className={field} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" name="land_seizure" id="land_seizure"
              defaultChecked={d.land_seizure ?? false}
              className="w-4 h-4 rounded border-zinc-300 text-blue-600" />
            <label htmlFor="land_seizure" className="text-sm text-zinc-700">差押あり</label>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          不動産のみ：建物の登記
      ════════════════════════════════════════════════ */}
      {isRE && (
        <div className={sec}>
          <h3 className={secH}>🏠 建物の登記</h3>

          {/* 表題部 */}
          <p className={subH}>表題部（建物の表示）</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>不動産番号</label>
              <input type="text" name="building_fudosan_number"
                defaultValue={d.building_fudosan_number ?? ''}
                placeholder="例：1234567890123" maxLength={13} className={field} />
            </div>
            <div>
              <label className={lbl}>所在</label>
              <input type="text" name="building_location"
                defaultValue={d.building_location ?? ''}
                placeholder="例：東京都渋谷区○○一丁目123番地4" className={field} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>家屋番号</label>
              <input type="text" name="building_kaoku_number"
                defaultValue={d.building_kaoku_number ?? ''}
                placeholder="例：123番4の301" className={field} />
            </div>
            <div>
              <label className={lbl}>種類</label>
              <input type="text" name="building_shurui"
                defaultValue={d.building_shurui ?? ''}
                placeholder="例：居宅、共同住宅" className={field} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>構造</label>
              <input type="text" name="structure"
                defaultValue={d.structure ?? ''}
                placeholder="例：鉄筋コンクリート造" className={field} />
            </div>
            <div>
              <label className={lbl}>新築年月日</label>
              <input type="date" name="building_new_construction_date"
                defaultValue={d.building_new_construction_date ?? ''} className={field} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={lbl}>床面積・1階（㎡）</label>
              <input type="number" name="building_floor_area_1f"
                defaultValue={d.building_floor_area_1f ?? ''}
                min="0" step="0.01" placeholder="例：65.50" className={field} />
            </div>
            <div>
              <label className={lbl}>床面積・2階（㎡）</label>
              <input type="number" name="building_floor_area_2f"
                defaultValue={d.building_floor_area_2f ?? ''}
                min="0" step="0.01" placeholder="例：60.00" className={field} />
            </div>
            <div>
              <label className={lbl}>床面積・3階（㎡）</label>
              <input type="number" name="building_floor_area_3f"
                defaultValue={d.building_floor_area_3f ?? ''}
                min="0" step="0.01" placeholder="例：55.00" className={field} />
            </div>
          </div>

          {/* 甲区 */}
          <p className={`${subH} mt-2`}>所有権・権利状態（甲区）</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>現所有者名</label>
              <input type="text" name="building_owner_name"
                defaultValue={d.building_owner_name ?? ''} className={field} />
            </div>
            <div>
              <label className={lbl}>所有者住所</label>
              <input type="text" name="building_owner_address"
                defaultValue={d.building_owner_address ?? ''} className={field} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={lbl}>所有権取得原因</label>
              <input type="text" name="building_acquisition_reason"
                defaultValue={d.building_acquisition_reason ?? ''}
                placeholder="例：売買、相続" className={field} />
            </div>
            <div>
              <label className={lbl}>所有権取得日</label>
              <input type="date" name="building_acquisition_date"
                defaultValue={d.building_acquisition_date ?? ''} className={field} />
            </div>
            <div>
              <label className={lbl}>直近差押解除日</label>
              <input type="date" name="building_seizure_release_date"
                defaultValue={d.building_seizure_release_date ?? ''} className={field} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" name="building_seizure" id="building_seizure"
              defaultChecked={d.building_seizure ?? false}
              className="w-4 h-4 rounded border-zinc-300 text-blue-600" />
            <label htmlFor="building_seizure" className="text-sm text-zinc-700">差押あり</label>
          </div>

          {/* 乙区 */}
          <p className={`${subH} mt-2`}>担保・権利制限（乙区）</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>登記種別</label>
              <input type="text" name="building_lien_type"
                defaultValue={d.building_lien_type ?? ''}
                placeholder="例：抵当権設定" className={field} />
            </div>
            <div>
              <label className={lbl}>権利者名</label>
              <input type="text" name="building_lien_holder"
                defaultValue={d.building_lien_holder ?? ''} className={field} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={lbl}>債権額（円）</label>
              <input type="number" name="building_debt_amount"
                defaultValue={d.building_debt_amount ?? ''}
                min="0" placeholder="例：30000000" className={field} />
            </div>
            <div>
              <label className={lbl}>損害金率（%）</label>
              <input type="number" name="building_damage_rate"
                defaultValue={d.building_damage_rate ?? ''}
                min="0" step="0.01" placeholder="例：14.6" className={field} />
            </div>
            <div>
              <label className={lbl}>共同担保目録番号</label>
              <input type="text" name="building_joint_collateral_number"
                defaultValue={d.building_joint_collateral_number ?? ''} className={field} />
            </div>
          </div>
        </div>
      )}

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

      <CustomFieldsFields fields={customFields} values={customValues} />

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
