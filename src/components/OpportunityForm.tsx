'use client'

/**
 * 商談の新規作成/編集フォーム（REQ-0051）。
 *
 * レコード詳細ページと同じ見た目に揃える:
 *   - RecordColumns（左=商談情報の dense カード / 右=基本情報・業種セクション・カスタム項目）
 *   - カードは EditableInfoCard（編集モード）と同じスタイル（CreateInfoCard）
 *   - 仲介手数料・利益のライブ計算（不動産）/ 部品原価の自動補完（板金）は
 *     制御コンポーネントのため CreateInfoCard の children として差し込む
 *   - 保存/キャンセルはページヘッダ（form 属性で紐付け）とフォーム末尾の両方
 */
import { useActionState, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import type { FieldDef } from '@/lib/bookMetadata'
import SearchableSelect from '@/components/SearchableSelect'
import CustomFieldsFields from '@/components/CustomFieldsFields'
import FormFillModal from '@/components/FormFillModal'
import CreateFeedback from '@/components/CreateFeedback'
import CreateInfoCard from '@/components/create/CreateInfoCard'
import { RecordColumns } from '@/components/record/RecordUI'
import type { CreateAction } from '@/lib/duplicateTypes'
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
  action: CreateAction
  cancelHref: string
  accounts: Account[]
  contacts?: Contact[]
  users?: UserOption[]
  customFields?: FieldDef[]
  customValues?: Record<string, string | null>
  /** 車両一覧（INDUSTRY=auto-body のとき必要） */
  vehicles?: { id: string; label: string; purchase_price?: number | string | null }[]
  /** ページヘッダの保存ボタンと紐付ける form id */
  formId?: string
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

/** CreateInfoCard の入力欄と同じ見た目（制御コンポーネント用） */
const INPUT = 'w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 transition-colors'

/** dense カード内のラベル付きフィールド（SearchableSelect 等を包むため label でなく div） */
function DenseField({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <span className="block text-[12px] text-zinc-500 mb-1">
        {label}
        {hint && <span className="ml-2 text-[11px] text-zinc-400">{hint}</span>}
      </span>
      {children}
    </div>
  )
}

/** 通常カード内のラベル付きフィールド */
function CardField({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <span className="block text-xs text-zinc-400 mb-1">
        {label}
        {hint && <span className="ml-2 text-[11px]">{hint}</span>}
      </span>
      {children}
    </div>
  )
}

export default function OpportunityForm({ action, cancelHref, accounts, contacts = [], users = [], vehicles = [], defaultValues = {}, customFields = [], customValues = {}, formId = 'record-create-form' }: OpportunityFormProps) {
  const [state, formAction, pending] = useActionState(action, null)
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
  // ユーザが parts_cost を手動編集したら以後の auto-fill を停止
  const [partsCostAutoSync, setPartsCostAutoSync] = useState<boolean>(
    defaultValues.parts_cost == null || defaultValues.parts_cost === '0' || defaultValues.parts_cost === 0,
  )
  const autoBodyProfit = calcAutoBodyProfit(
    amount ? Number(amount) : null,
    partsCost ? Number(partsCost) : null,
  )

  /** 車両販売 + 車両選択時に parts_cost を vehicle.purchase_price で初期化 */
  const tryAutoFillPartsCost = (svcType: string, vid: string) => {
    if (!partsCostAutoSync) return
    if (svcType !== '車両販売') return
    if (!vid) return
    const v = vehicles.find((x) => x.id === vid)
    const price = v?.purchase_price
    if (price == null) return
    setPartsCost(String(price))
  }

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

  // 「テキストから入力」（全フィールドを1フォームに流し込むため、どのカードからでも同じ動作）
  const fillButton = (
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
  )

  return (
    <form id={formId} ref={formRef} action={formAction}>
      <CreateFeedback state={state} formRef={formRef} />

      <RecordColumns
        narrow
        left={
          <CreateInfoCard dense title="商談情報" action={fillButton} fields={[]}>
            <DenseField label="取引先">
              <SearchableSelect
                name="account_id"
                defaultValue={defaultValues.account_id}
                options={accounts.map((a) => ({ value: a.id, label: a.name }))}
                placeholder="選択してください"
              />
            </DenseField>
            <DenseField label="人物">
              <SearchableSelect
                name="contact_id"
                defaultValue={defaultValues.contact_id}
                options={contacts.map((c) => ({ value: c.id, label: c.full_name }))}
                placeholder="選択してください"
              />
            </DenseField>
            <DenseField label="担当者">
              <select name="owner_id" defaultValue={defaultValues.owner_id ?? ''} className={INPUT}>
                <option value="">未設定</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </DenseField>
            <DenseField label="ステージ">
              <select name="stage" defaultValue={defaultValues.stage ?? 'prospecting'} className={INPUT}>
                {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </DenseField>
            <DenseField label={amountLabel} hint={amountHelper}>
              <input
                name="amount"
                type="number"
                min="0"
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
                className={INPUT}
                placeholder={isRent ? '例: 100000' : '例: 10000000'}
              />
            </DenseField>
            <DenseField label="確度（%）">
              <input
                name="probability"
                type="number"
                min="0"
                max="100"
                defaultValue={defaultValues.probability ?? ''}
                className={INPUT}
                placeholder="例: 70"
              />
            </DenseField>
            <DenseField label="完了予定日">
              <input name="close_date" type="date" defaultValue={defaultValues.close_date ?? ''} className={INPUT} />
            </DenseField>
          </CreateInfoCard>
        }
      >
        <CreateInfoCard
          title="基本情報"
          action={fillButton}
          fields={[
            { label: '商談名', name: 'name', defaultValue: defaultValues.name, required: true, placeholder: '例: クラウド移行プロジェクト', fullWidth: true },
            { label: '概要・メモ', name: 'description', kind: 'textarea', defaultValue: defaultValues.description, placeholder: '商談の詳細を記入してください...', fullWidth: true },
          ]}
        />

        {/* ── 不動産情報（INDUSTRY=real-estate のみ） ─── */}
        {activeIndustry === 'real-estate' && (
          <CreateInfoCard title="不動産情報" fields={[]}>
            <div className="space-y-4">
              <CardField label="取引区分">
                <select
                  name="transaction_type"
                  value={transactionType}
                  onChange={(e) => onTransactionTypeChange(e.target.value)}
                  className={INPUT}
                >
                  {TRANSACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </CardField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CardField
                  label="仲介手数料（円）"
                  hint={feeAutoSync ? (
                    <span className="text-zinc-400">自動算出</span>
                  ) : (
                    <button type="button" onClick={resetFeeToAuto} className="text-blue-600 hover:underline">
                      自動に戻す
                    </button>
                  )}
                >
                  <input
                    name="commission_fee"
                    type="number"
                    min="0"
                    step="1"
                    value={commissionFee}
                    onChange={(e) => onFeeChange(e.target.value)}
                    className={INPUT}
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
                </CardField>
                <CardField label="仲介種別">
                  <select
                    name="brokerage_type"
                    value={brokerageType}
                    onChange={(e) => setBrokerageType(e.target.value)}
                    className={INPUT}
                  >
                    <option value="">— 未選択 —</option>
                    {brokerageOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </CardField>
              </div>

              <CardField label="その他利益（円）" hint="税抜">
                <input
                  name="other_profit"
                  type="number"
                  min="0"
                  value={otherProfit}
                  onChange={(e) => setOtherProfit(e.target.value)}
                  className={INPUT}
                  placeholder="0"
                />
              </CardField>

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
            </div>
          </CreateInfoCard>
        )}
        {/* ── 不動産情報ここまで ─────────────────────── */}

        {/* ── 自動車整備情報（INDUSTRY=auto-body のみ） ─── */}
        {activeIndustry === 'auto-body' && (
          <CreateInfoCard title="自動車整備情報" fields={[]}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CardField label="サービス区分">
                  <select
                    name="service_type"
                    value={serviceType}
                    onChange={(e) => {
                      const v = e.target.value
                      setServiceType(v)
                      tryAutoFillPartsCost(v, vehicleId)
                    }}
                    className={INPUT}
                  >
                    <option value="">— 未選択 —</option>
                    {SERVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </CardField>
                <CardField label="対象車両">
                  <SearchableSelect
                    name="vehicle_id"
                    defaultValue={vehicleId || null}
                    options={vehicles.map((v) => ({ value: v.id, label: v.label }))}
                    placeholder="車両を選択"
                    onSelect={(v) => {
                      setVehicleId(v)
                      tryAutoFillPartsCost(serviceType, v)
                    }}
                  />
                </CardField>
              </div>

              <CardField
                label="部品仕入原価（円）"
                hint={serviceType === '車両販売'
                  ? (partsCostAutoSync ? '車両仕入価格を自動補完' : '車両仕入価格を含めて入力')
                  : '税抜'}
              >
                <input
                  name="parts_cost"
                  type="number"
                  min="0"
                  value={partsCost}
                  onChange={(e) => {
                    setPartsCost(e.target.value)
                    setPartsCostAutoSync(false)
                  }}
                  className={INPUT}
                  placeholder="0"
                />
              </CardField>

              <div className="bg-zinc-50 border border-zinc-200 rounded-md px-4 py-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-zinc-500">利益（自動計算）</span>
                  <span className={`text-lg font-bold ${autoBodyProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {yen(autoBodyProfit)}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">売上 − 部品仕入原価</p>
              </div>
            </div>
          </CreateInfoCard>
        )}
        {/* ── 自動車整備情報ここまで ──────────────────── */}

        {customFields.length > 0 && (
          <CreateInfoCard title="カスタム項目" fields={[]}>
            <CustomFieldsFields fields={customFields} values={customValues} />
          </CreateInfoCard>
        )}
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
