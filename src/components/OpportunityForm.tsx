'use client'

import { useActionState, useRef, useState } from 'react'
import Link from 'next/link'
import type { FieldDef } from '@/lib/objectMetadata'
import SearchableSelect from '@/components/SearchableSelect'
import CustomFieldsFields from '@/components/CustomFieldsFields'
import FormFillModal from '@/components/FormFillModal'
import {
  TRANSACTION_TYPES,
  brokerageTypesFor,
  defaultCommissionFee,
  commissionBreakdown,
  effectiveCommissionRatePct,
  effectiveCommissionMonths,
  calcProfit,
} from '@/industries/real-estate/lib/realEstateCommission'
import {
  SERVICE_TYPES,
  calcAutoBodyProfit,
} from '@/industries/auto-body/lib/autoBodyService'
import { activeIndustry } from '@/lib/industry'

type Account    = { id: string; name: string }
type Contact    = { id: string; full_name: string }
type UserOption = { id: string; name: string }

type OpportunityFormProps = {
  action: (prevState: string | null, formData: FormData) => Promise<string | null>
  cancelHref: string
  accounts: Account[]
  contacts?: Contact[]
  users?: UserOption[]
  customFields?: FieldDef[]
  customValues?: Record<string, string | null>
  /** 車両一覧（INDUSTRY=auto-body のとき必要） */
  vehicles?: { id: string; label: string }[]
  defaultValues?: {
    name?: string
    account_id?: string | null
    contact_id?: string | null
    stage?: string
    amount?: number | null
    close_date?: string | null
    probability?: number | null
    description?: string | null
    owner_id?: string | null
    transaction_type?: string | null
    commission_fee?: number | string | null
    brokerage_type?: string | null
    other_profit?: number | string | null
    service_type?: string | null
    vehicle_id?: string | null
    parts_cost?: number | string | null
  }
}

const STAGES = [
  { value: 'prospecting',   label: '見込み' },
  { value: 'qualification', label: '要件確認' },
  { value: 'proposal',      label: '提案' },
  { value: 'negotiation',   label: '交渉' },
  { value: 'closed_won',    label: '受注' },
  { value: 'closed_lost',   label: '失注' },
]

const yen = (n: number) => `¥${Math.round(n).toLocaleString('ja-JP')}`

export default function OpportunityForm({ action, cancelHref, accounts, contacts = [], users = [], vehicles = [], defaultValues = {}, customFields = [], customValues = {} }: OpportunityFormProps) {
  const [error, formAction, pending] = useActionState(action, null)
  const formRef = useRef<HTMLFormElement>(null)

  // ── 不動産用ライブ計算ステート ─────────────────────
  const initialAmount = defaultValues.amount != null ? String(defaultValues.amount) : ''
  const initialTxType = defaultValues.transaction_type === '賃貸' ? '賃貸' : '売買'

  const [transactionType, setTransactionType] = useState<string>(initialTxType)
  const [amount, setAmount] = useState<string>(initialAmount)
  const initialFeeAutoSync = defaultValues.commission_fee == null
  const initialFee = defaultValues.commission_fee != null
    ? String(defaultValues.commission_fee)
    : (() => {
        const auto = defaultCommissionFee(initialAmount ? Number(initialAmount) : null, initialTxType)
        return auto != null ? String(auto) : ''
      })()
  const [commissionFee, setCommissionFee] = useState<string>(initialFee)
  const [feeAutoSync, setFeeAutoSync] = useState<boolean>(initialFeeAutoSync)
  const [brokerageType, setBrokerageType] = useState<string>(
    defaultValues.brokerage_type ?? '',
  )
  const [otherProfit, setOtherProfit] = useState<string>(
    defaultValues.other_profit != null ? String(defaultValues.other_profit) : '',
  )

  // ── 板金屋・自動車整備業 (auto-body) ステート ──────
  const [serviceType, setServiceType] = useState<string>(defaultValues.service_type ?? '')
  const [vehicleId, setVehicleId] = useState<string>(defaultValues.vehicle_id ?? '')
  const [partsCost, setPartsCost] = useState<string>(
    defaultValues.parts_cost != null ? String(defaultValues.parts_cost) : '',
  )
  const autoBodyProfit = calcAutoBodyProfit(
    amount ? Number(amount) : null,
    partsCost ? Number(partsCost) : null,
  )

  const isRent = transactionType === '賃貸'

  const onTransactionTypeChange = (v: string) => {
    setTransactionType(v)
    // 取引区分を切り替えたら、自動同期中なら手数料を再計算
    if (feeAutoSync) {
      const fee = defaultCommissionFee(amount ? Number(amount) : null, v)
      setCommissionFee(fee != null ? String(fee) : '')
    }
    // 既存の仲介種別が新しい区分の選択肢に存在しなければクリア
    const allowed = brokerageTypesFor(v) as readonly string[]
    if (brokerageType && !allowed.includes(brokerageType)) {
      setBrokerageType('')
    }
  }

  const onAmountChange = (v: string) => {
    setAmount(v)
    if (feeAutoSync) {
      const fee = defaultCommissionFee(v ? Number(v) : null, transactionType)
      setCommissionFee(fee != null ? String(fee) : '')
    }
  }

  const onFeeChange = (v: string) => {
    setCommissionFee(v)
    setFeeAutoSync(false)
  }

  const resetFeeToAuto = () => {
    const fee = defaultCommissionFee(amount ? Number(amount) : null, transactionType)
    setCommissionFee(fee != null ? String(fee) : '')
    setFeeAutoSync(true)
  }

  const profit = calcProfit(
    commissionFee ? Number(commissionFee) : null,
    brokerageType,
    otherProfit ? Number(otherProfit) : null,
  )
  const breakdown = commissionBreakdown(amount ? Number(amount) : null, transactionType)
  const effRate = !isRent ? effectiveCommissionRatePct(
    amount ? Number(amount) : null,
    commissionFee ? Number(commissionFee) : null,
  ) : null
  const effMonths = isRent ? effectiveCommissionMonths(
    amount ? Number(amount) : null,
    commissionFee ? Number(commissionFee) : null,
  ) : null

  const amountLabel = isRent ? '月額賃料（円）' : '金額（円）'
  const amountHelper = isRent ? '賃貸 - 月額（税抜）' : '物件販売価格・税抜'
  const brokerageOptions = brokerageTypesFor(transactionType)

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>
      )}

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

      <div className="flex items-center gap-3">
        <div className="w-1 h-5 rounded-full bg-blue-500 shrink-0" />
        <span className="text-sm font-bold text-zinc-700 tracking-wide">基本情報</span>
        <div className="flex-1 h-px bg-zinc-200" />
        <FormFillModal
          formRef={formRef}
          csvFormat={activeIndustry === 'real-estate'
            ? "商談名,ステージ,金額,完了予定日,確度(%),説明,取引区分,仲介手数料,仲介種別,その他利益"
            : "商談名,ステージ,金額,完了予定日,確度(%),説明"}
          fieldMap={{
            '商談名': 'name', 'ステージ': 'stage', '金額': 'amount',
            '完了予定日': 'close_date', '確度(%)': 'probability', '説明': 'description',
            ...(activeIndustry === 'real-estate' ? {
              '取引区分': 'transaction_type',
              '仲介手数料': 'commission_fee', '仲介種別': 'brokerage_type', 'その他利益': 'other_profit',
            } : {}),
          }}
          valueMap={{
            stage: {
              '見込み': 'prospecting', '要件確認': 'qualification', '提案': 'proposal',
              '交渉': 'negotiation', '受注': 'closed_won', '失注': 'closed_lost',
            },
          }}
          customFields={customFields}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          商談名 <span className="text-red-500">*</span>
        </label>
        <input
          name="name"
          defaultValue={defaultValues.name ?? ''}
          required
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="例: クラウド移行プロジェクト"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">取引先</label>
        <SearchableSelect
          name="account_id"
          defaultValue={defaultValues.account_id}
          options={accounts.map((a) => ({ value: a.id, label: a.name }))}
          placeholder="選択してください"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">人物</label>
        <SearchableSelect
          name="contact_id"
          defaultValue={defaultValues.contact_id}
          options={contacts.map((c) => ({ value: c.id, label: c.full_name }))}
          placeholder="選択してください"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">担当者</label>
        <select
          name="owner_id"
          defaultValue={defaultValues.owner_id ?? ''}
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">未設定</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">ステージ</label>
        <select
          name="stage"
          defaultValue={defaultValues.stage ?? 'prospecting'}
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            {amountLabel}
            <span className="ml-2 text-xs font-normal text-zinc-400">{amountHelper}</span>
          </label>
          <input
            name="amount"
            type="number"
            min="0"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={isRent ? '例: 100000' : '例: 10000000'}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">確度（%）</label>
          <input
            name="probability"
            type="number"
            min="0"
            max="100"
            defaultValue={defaultValues.probability ?? ''}
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: 70"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">完了予定日</label>
        <input
          name="close_date"
          type="date"
          defaultValue={defaultValues.close_date ?? ''}
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">概要・メモ</label>
        <textarea
          name="description"
          rows={3}
          defaultValue={defaultValues.description ?? ''}
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="商談の詳細を記入してください..."
        />
      </div>

      {/* ── 不動産情報（INDUSTRY=real-estate のみ） ─── */}
      {activeIndustry === 'real-estate' && (<>
      <div className="flex items-center gap-3 pt-2">
        <div className="w-1 h-5 rounded-full bg-blue-500 shrink-0" />
        <span className="text-sm font-bold text-zinc-700 tracking-wide">不動産情報</span>
        <div className="flex-1 h-px bg-zinc-200" />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">取引区分</label>
        <select
          name="transaction_type"
          value={transactionType}
          onChange={(e) => onTransactionTypeChange(e.target.value)}
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {TRANSACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            仲介手数料（円）
            {feeAutoSync ? (
              <span className="ml-2 text-xs font-normal text-zinc-400">自動算出</span>
            ) : (
              <button
                type="button"
                onClick={resetFeeToAuto}
                className="ml-2 text-xs font-normal text-blue-600 hover:underline"
              >
                自動に戻す
              </button>
            )}
          </label>
          <input
            name="commission_fee"
            type="number"
            min="0"
            step="1"
            value={commissionFee}
            onChange={(e) => onFeeChange(e.target.value)}
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={isRent ? '例: 100000' : '例: 360000'}
          />
          {(breakdown || effRate != null || effMonths != null) && (
            <p className="text-[11px] text-zinc-400 mt-1">
              {breakdown}
              {breakdown && (effRate != null || effMonths != null) && ' ・ '}
              {effRate != null && `実効率 ${effRate.toFixed(2)}%`}
              {effMonths != null && `${effMonths.toFixed(2)}ヶ月分`}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">仲介種別</label>
          <select
            name="brokerage_type"
            value={brokerageType}
            onChange={(e) => setBrokerageType(e.target.value)}
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">— 未選択 —</option>
            {brokerageOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          その他利益（円）
          <span className="ml-2 text-xs font-normal text-zinc-400">税抜</span>
        </label>
        <input
          name="other_profit"
          type="number"
          min="0"
          value={otherProfit}
          onChange={(e) => setOtherProfit(e.target.value)}
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="0"
        />
      </div>

      <div className="bg-zinc-50 border border-zinc-200 rounded-md px-4 py-3">
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-zinc-500">利益（自動計算）</span>
          <span className={`text-lg font-bold ${profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {yen(profit)}
          </span>
        </div>
        <p className="text-[11px] text-zinc-400 mt-1">
          仲介手数料 × {brokerageType === '両手' ? '2（両手）' : '1'} ＋ その他利益
        </p>
      </div>
      </>)}
      {/* ── 不動産情報ここまで ─────────────────────── */}

      {/* ── 自動車整備情報（INDUSTRY=auto-body のみ） ─── */}
      {activeIndustry === 'auto-body' && (<>
      <div className="flex items-center gap-3 pt-2">
        <div className="w-1 h-5 rounded-full bg-blue-500 shrink-0" />
        <span className="text-sm font-bold text-zinc-700 tracking-wide">自動車整備情報</span>
        <div className="flex-1 h-px bg-zinc-200" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">サービス区分</label>
          <select
            name="service_type"
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">— 未選択 —</option>
            {SERVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">対象車両</label>
          <SearchableSelect
            name="vehicle_id"
            defaultValue={vehicleId || null}
            options={vehicles.map((v) => ({ value: v.id, label: v.label }))}
            placeholder="車両を選択"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          部品仕入原価（円）
          <span className="ml-2 text-xs font-normal text-zinc-400">
            {serviceType === '車両販売' ? '車両仕入価格を含めて入力' : '税抜'}
          </span>
        </label>
        <input
          name="parts_cost"
          type="number"
          min="0"
          value={partsCost}
          onChange={(e) => setPartsCost(e.target.value)}
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="0"
        />
      </div>

      <div className="bg-zinc-50 border border-zinc-200 rounded-md px-4 py-3">
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-zinc-500">利益（自動計算）</span>
          <span className={`text-lg font-bold ${autoBodyProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {yen(autoBodyProfit)}
          </span>
        </div>
        <p className="text-[11px] text-zinc-400 mt-1">売上 − 部品仕入原価</p>
      </div>
      </>)}
      {/* ── 自動車整備情報ここまで ──────────────────── */}

      <CustomFieldsFields fields={customFields} values={customValues} />

      <div className="flex gap-3 pt-2">
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
    </form>
  )
}
