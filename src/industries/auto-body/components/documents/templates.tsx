/**
 * 整備帳票テンプレート集（12 種）。
 *
 * 各テンプレートは DocumentData を受け取り、A4 縦の HTML を返す。
 * 印刷時のページ余白は DocumentLayout 側で @page で設定。
 */
import {
  yen, SectionTitle, CompanyHeader, CustomerHeader,
  VehicleBlock, LineItemsTable, FeesTable, TotalsBlock,
  BankAccountBlock, NoteBox,
  type CustomerInfo, type VehicleSummary, type LineItem, type Fee, type TotalsBreakdown,
} from './DocumentPieces'
import { COMPANY_INFO } from '@/industries/auto-body/lib/companyInfo'

// ─── 共通 DocumentData ─────────────────────────────────
export type Payment = {
  id:             string
  payment_date:   string | null
  payment_method: string
  amount:         string | null
  memo:           string | null
}

export type DocumentData = {
  maintenance: {
    id:               string
    maintenance_no:   string
    intake_date:      string | null
    intake_time:      string | null
    delivery_date:    string | null
    delivery_time:    string | null
    pickup_location:  string | null
    delivery_location:string | null
    sales_recording_date: string | null
    branch_id:        string | null
    intake_category:  string | null
    receptionName:    string
    workerName:       string
    internal_memo:    string | null
    work_order_note:  string | null
    general_note:     string | null
    tax_mode:         string | null
  }
  customer:    CustomerInfo
  billingCustomer?: CustomerInfo | null
  vehicle:     VehicleSummary
  lines:       LineItem[]
  fees:        Fee[]
  payments:    Payment[]
  totals:      TotalsBreakdown
  issueDate:   string  // 今日の日付
}

// ─── テンプレート: 1. 概算見積書 ────────────────────────
function EstimateRoughTemplate({ d }: { d: DocumentData }) {
  return (
    <>
      <div className="flex justify-between items-start mb-6">
        <div className="flex-1 mr-4">
          <CustomerHeader customer={d.customer} />
        </div>
        <CompanyHeader issueDate={d.issueDate} />
      </div>
      <SectionTitle title="概 算 見 積 書" no={d.maintenance.maintenance_no} />
      <p className="text-sm mb-4">下記のとおり概算でお見積もり申し上げます。正式な見積は車両確認後にお出しいたします。</p>
      <VehicleBlock vehicle={d.vehicle} />
      <LineItemsTable lines={d.lines} />
      <FeesTable fees={d.fees} />
      <TotalsBlock totals={d.totals} />
      <p className="text-xs text-zinc-600 mt-4">※ 本見積は概算であり、車両確認・部品供給状況により金額が変動する場合がございます。</p>
    </>
  )
}

// ─── テンプレート: 2. 見積書 ───────────────────────────
function EstimateTemplate({ d }: { d: DocumentData }) {
  return (
    <>
      <div className="flex justify-between items-start mb-6">
        <div className="flex-1 mr-4">
          <CustomerHeader customer={d.customer} />
        </div>
        <CompanyHeader issueDate={d.issueDate} />
      </div>
      <SectionTitle title="見　積　書" no={d.maintenance.maintenance_no} />
      <p className="text-sm mb-4">下記のとおりお見積り申し上げます。</p>
      <VehicleBlock vehicle={d.vehicle} />
      <LineItemsTable lines={d.lines} />
      <FeesTable fees={d.fees} />
      <TotalsBlock totals={d.totals} />
      {d.maintenance.general_note && (
        <NoteBox title="備考" content={d.maintenance.general_note} />
      )}
      <p className="text-xs text-zinc-600 mt-6">見積有効期限: 発行日より 30 日間</p>
    </>
  )
}

// ─── テンプレート: 3. 作業指示書 ───────────────────────
function WorkOrderTemplate({ d }: { d: DocumentData }) {
  return (
    <>
      <div className="flex justify-between items-start mb-6">
        <div>
          <p className="text-sm">整備No: <span className="font-mono">{d.maintenance.maintenance_no}</span></p>
          <p className="text-sm">入庫: {d.maintenance.intake_date ?? '—'} {d.maintenance.intake_time ?? ''}</p>
          <p className="text-sm">納車予定: {d.maintenance.delivery_date ?? '—'} {d.maintenance.delivery_time ?? ''}</p>
          <p className="text-sm">受付担当: {d.maintenance.receptionName} / 作業担当: {d.maintenance.workerName}</p>
        </div>
        <CompanyHeader issueDate={d.issueDate} withSeal={false} />
      </div>
      <SectionTitle title="作 業 指 示 書" no={d.maintenance.maintenance_no} />
      <VehicleBlock vehicle={d.vehicle} />
      <p className="text-sm text-zinc-700 mb-2">顧客: {d.customer.primaryName}{d.customer.attentionName ? ` / 担当: ${d.customer.attentionName}` : ''}</p>
      <h2 className="text-base font-semibold mt-4 mb-2">作業項目（除外含む全件）</h2>
      <LineItemsTable lines={d.lines} showStatus showHidden />
      {d.maintenance.work_order_note && (
        <NoteBox title="作業指示備考" content={d.maintenance.work_order_note} />
      )}
      <div className="mt-12 grid grid-cols-3 gap-4 text-xs">
        <div className="border-t border-zinc-400 pt-2 text-center">受付担当 印</div>
        <div className="border-t border-zinc-400 pt-2 text-center">作業担当 印</div>
        <div className="border-t border-zinc-400 pt-2 text-center">最終確認 印</div>
      </div>
    </>
  )
}

// ─── テンプレート: 4. 納品書 ───────────────────────────
function DeliveryNoteTemplate({ d }: { d: DocumentData }) {
  return (
    <>
      <div className="flex justify-between items-start mb-6">
        <div className="flex-1 mr-4">
          <CustomerHeader customer={d.customer} />
        </div>
        <CompanyHeader issueDate={d.issueDate} />
      </div>
      <SectionTitle title="納　品　書" no={d.maintenance.maintenance_no} />
      <p className="text-sm mb-4">下記のとおり納品いたしました。</p>
      <VehicleBlock vehicle={d.vehicle} />
      <p className="text-sm mb-2">納車日: {d.maintenance.delivery_date ?? '—'} {d.maintenance.delivery_time ?? ''}</p>
      <p className="text-sm mb-4">納車場所: {d.maintenance.delivery_location ?? '当工場'}</p>
      <LineItemsTable lines={d.lines} />
      <FeesTable fees={d.fees} />
      <TotalsBlock totals={d.totals} />
      <p className="text-xs text-zinc-600 mt-4">納品物に不備等ございましたら 7 日以内にご連絡ください。</p>
    </>
  )
}

// ─── テンプレート: 5. 請求書 ───────────────────────────
function InvoiceTemplate({ d }: { d: DocumentData }) {
  const customer = d.billingCustomer ?? d.customer
  const paid = d.payments.reduce((s, p) => s + Number(p.amount ?? 0), 0)
  const balance = d.totals.grandTotal - paid
  return (
    <>
      <div className="flex justify-between items-start mb-6">
        <div className="flex-1 mr-4">
          <CustomerHeader customer={customer} />
          {d.billingCustomer && (
            <p className="text-[10px] text-zinc-500 mt-1">（顧客: {d.customer.primaryName} に代わり請求）</p>
          )}
        </div>
        <CompanyHeader issueDate={d.issueDate} />
      </div>
      <SectionTitle title="請　求　書" no={d.maintenance.maintenance_no} />
      <p className="text-sm mb-4">下記のとおりご請求申し上げます。お振込みのほど、よろしくお願いいたします。</p>
      <VehicleBlock vehicle={d.vehicle} />
      <LineItemsTable lines={d.lines} />
      <FeesTable fees={d.fees} />
      <TotalsBlock totals={d.totals} />
      {paid > 0 && (
        <div className="flex justify-end mb-4">
          <table className="text-sm border-collapse border border-zinc-400 w-72">
            <tbody>
              <tr><th className="bg-zinc-100 border border-zinc-400 px-3 py-1.5 text-left">入金済額</th><td className="border border-zinc-400 px-3 py-1.5 text-right font-mono">{yen(paid)}</td></tr>
              <tr className={balance > 0 ? 'bg-red-50' : 'bg-green-50'}>
                <th className="border border-zinc-400 px-3 py-2 text-left font-bold">差引残額</th>
                <td className="border border-zinc-400 px-3 py-2 text-right font-mono font-bold">{yen(balance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-6">
        <BankAccountBlock />
      </div>
      <p className="text-xs text-zinc-600 mt-3">支払期日: 発行月の翌月末日</p>
    </>
  )
}

// ─── テンプレート: 6. 次回整備提案書 ────────────────────
function NextProposalTemplate({ d }: { d: DocumentData }) {
  return (
    <>
      <div className="flex justify-between items-start mb-6">
        <div className="flex-1 mr-4">
          <CustomerHeader customer={d.customer} />
        </div>
        <CompanyHeader issueDate={d.issueDate} withSeal={false} />
      </div>
      <SectionTitle title="次 回 整 備 提 案 書" />
      <p className="text-sm mb-4">
        いつもご利用ありがとうございます。前回整備の点検結果に基づき、次回の整備をご提案させていただきます。
      </p>
      <VehicleBlock vehicle={d.vehicle} />
      <NoteBox
        title="今回ご提案する整備内容"
        content={d.maintenance.general_note ?? '（次回提案内容を未記入）担当者にご相談ください。'}
      />
      <p className="text-sm mt-4">ご質問・ご相談は下記までお気軽にお問い合わせください。</p>
      <p className="text-sm text-zinc-700 mt-1">TEL: {COMPANY_INFO.phone}</p>
    </>
  )
}

// ─── テンプレート: 7. 入庫概要シート ────────────────────
function IntakeSummaryTemplate({ d }: { d: DocumentData }) {
  return (
    <>
      <div className="flex justify-between items-start mb-6">
        <div>
          <p className="text-sm">整備No: <span className="font-mono">{d.maintenance.maintenance_no}</span></p>
          <p className="text-sm">入庫: {d.maintenance.intake_date ?? '—'} {d.maintenance.intake_time ?? ''}</p>
          <p className="text-sm">入庫場所: {d.maintenance.pickup_location ?? '当工場'}</p>
          <p className="text-sm">入庫区分: {d.maintenance.intake_category ?? '—'}</p>
        </div>
        <CompanyHeader issueDate={d.issueDate} withSeal={false} />
      </div>
      <SectionTitle title="入 庫 概 要 シ ー ト" />
      <p className="text-sm mb-2">顧客: {d.customer.primaryName}{d.customer.attentionName ? ` / 担当: ${d.customer.attentionName}` : ''}</p>
      <VehicleBlock vehicle={d.vehicle} />
      <NoteBox title="お預かり時のご相談内容" content={d.maintenance.internal_memo ?? '（記入なし）'} />
      <NoteBox title="作業指示" content={d.maintenance.work_order_note ?? '（記入なし）'} />
      <div className="mt-8 grid grid-cols-2 gap-6 text-xs">
        <div className="border-t border-zinc-400 pt-2 text-center">お客様確認 印</div>
        <div className="border-t border-zinc-400 pt-2 text-center">受付担当 印</div>
      </div>
    </>
  )
}

// ─── テンプレート: 8. 領収証 ───────────────────────────
function ReceiptTemplate({ d }: { d: DocumentData }) {
  const paid = d.payments.reduce((s, p) => s + Number(p.amount ?? 0), 0)
  return (
    <>
      <div className="flex justify-between items-start mb-6">
        <div className="flex-1 mr-4">
          <CustomerHeader customer={d.customer} salutation="様" />
        </div>
        <CompanyHeader issueDate={d.issueDate} />
      </div>
      <SectionTitle title="領　収　証" />
      <div className="my-8 text-center">
        <p className="text-sm text-zinc-700 mb-2">金　額</p>
        <p className="text-5xl font-bold tracking-widest border-b-4 border-double border-zinc-700 inline-block px-12 pb-2">
          {yen(paid)}
        </p>
        <p className="text-xs text-zinc-500 mt-2">（うち消費税 {COMPANY_INFO.bank_account ? `¥${Math.floor(d.totals.consumptionTax).toLocaleString()}` : '—'}）</p>
      </div>
      <p className="text-sm mb-4">但し、下記の整備代金として上記の通り正に領収いたしました。</p>
      <VehicleBlock vehicle={d.vehicle} />
      <p className="text-sm mt-4 mb-2">対象整備 No: <span className="font-mono">{d.maintenance.maintenance_no}</span></p>
      {d.payments.length > 0 && (
        <table className="w-full text-xs border-collapse border border-zinc-400 mt-2">
          <thead className="bg-zinc-100">
            <tr>
              <th className="border border-zinc-400 px-2 py-1">日付</th>
              <th className="border border-zinc-400 px-2 py-1">支払方法</th>
              <th className="border border-zinc-400 px-2 py-1 text-right">金額</th>
              <th className="border border-zinc-400 px-2 py-1">摘要</th>
            </tr>
          </thead>
          <tbody>
            {d.payments.map((p) => (
              <tr key={p.id}>
                <td className="border border-zinc-400 px-2 py-1">{p.payment_date ?? '—'}</td>
                <td className="border border-zinc-400 px-2 py-1">{p.payment_method}</td>
                <td className="border border-zinc-400 px-2 py-1 text-right font-mono">{yen(Number(p.amount))}</td>
                <td className="border border-zinc-400 px-2 py-1">{p.memo ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

// ─── テンプレート: 9. 預かり証 ─────────────────────────
function CustodyTemplate({ d }: { d: DocumentData }) {
  return (
    <>
      <div className="flex justify-between items-start mb-6">
        <div className="flex-1 mr-4">
          <CustomerHeader customer={d.customer} salutation="様" />
        </div>
        <CompanyHeader issueDate={d.issueDate} />
      </div>
      <SectionTitle title="預　か　り　証" no={d.maintenance.maintenance_no} />
      <p className="text-sm mb-4">下記車両を整備のため、当工場にて確かにお預かりいたしました。</p>
      <VehicleBlock vehicle={d.vehicle} />
      <table className="w-full text-sm border border-zinc-400 mb-4">
        <tbody>
          <tr>
            <th className="bg-zinc-100 border border-zinc-400 px-3 py-1.5 text-left w-32">預かり日時</th>
            <td className="border border-zinc-400 px-3 py-1.5">{d.maintenance.intake_date ?? '—'} {d.maintenance.intake_time ?? ''}</td>
          </tr>
          <tr>
            <th className="bg-zinc-100 border border-zinc-400 px-3 py-1.5 text-left">預かり場所</th>
            <td className="border border-zinc-400 px-3 py-1.5">{d.maintenance.pickup_location ?? COMPANY_INFO.address}</td>
          </tr>
          <tr>
            <th className="bg-zinc-100 border border-zinc-400 px-3 py-1.5 text-left">返却予定日時</th>
            <td className="border border-zinc-400 px-3 py-1.5">{d.maintenance.delivery_date ?? '—'} {d.maintenance.delivery_time ?? ''}</td>
          </tr>
          <tr>
            <th className="bg-zinc-100 border border-zinc-400 px-3 py-1.5 text-left">返却場所</th>
            <td className="border border-zinc-400 px-3 py-1.5">{d.maintenance.delivery_location ?? COMPANY_INFO.address}</td>
          </tr>
          <tr>
            <th className="bg-zinc-100 border border-zinc-400 px-3 py-1.5 text-left">整備区分</th>
            <td className="border border-zinc-400 px-3 py-1.5">{d.maintenance.intake_category ?? '—'}</td>
          </tr>
        </tbody>
      </table>
      <NoteBox
        title="お預かり時の状況・特記事項"
        content={d.maintenance.internal_memo ?? '（特になし）'}
      />
      <p className="text-xs text-zinc-600 mt-4">
        ※ 車両返却時に本証と引き換えとなります。紛失の際は身分証明書をご提示ください。
      </p>
    </>
  )
}

// ─── テンプレート: 10. 検査諸費用計算書 ────────────────
function InspectionFeesTemplate({ d }: { d: DocumentData }) {
  const taxable    = d.fees.filter((f) => f.category === '課税')
  const nontaxable = d.fees.filter((f) => f.category === '非課税')
  return (
    <>
      <div className="flex justify-between items-start mb-6">
        <div className="flex-1 mr-4">
          <CustomerHeader customer={d.customer} />
        </div>
        <CompanyHeader issueDate={d.issueDate} withSeal={false} />
      </div>
      <SectionTitle title="検 査 諸 費 用 計 算 書" no={d.maintenance.maintenance_no} />
      <VehicleBlock vehicle={d.vehicle} />
      {nontaxable.length > 0 && (
        <>
          <h2 className="text-base font-semibold mt-4 mb-2">法定費用（非課税）</h2>
          <FeesTable fees={nontaxable} />
        </>
      )}
      {taxable.length > 0 && (
        <>
          <h2 className="text-base font-semibold mt-4 mb-2">代行手数料等（課税）</h2>
          <FeesTable fees={taxable} />
        </>
      )}
      <TotalsBlock totals={d.totals} />
      <p className="text-xs text-zinc-600 mt-4">
        ※ 法定費用（自動車重量税・自動車賠償責任保険料・印紙代等）は非課税です。
      </p>
    </>
  )
}

// ─── テンプレート: 11. はがき宛名（車検案内） ──────────
function PostcardTemplate({ d }: { d: DocumentData }) {
  return (
    <div className="text-center py-12">
      <div className="inline-block text-left border-2 border-dashed border-zinc-300 p-12 bg-white">
        <p className="text-xs text-zinc-500 mb-2">郵便はがき</p>
        <div className="my-6">
          <p className="text-sm">{d.customer.address ?? ''}</p>
          <p className="text-2xl font-bold mt-2">{d.customer.primaryName} <span className="text-base ml-2">様</span></p>
          {d.customer.attentionName && <p className="text-base mt-1">{d.customer.attentionName} 様</p>}
        </div>
        <hr className="my-6 border-zinc-300" />
        <div className="text-sm">
          <p className="font-semibold mb-1">車検時期のお知らせ</p>
          <p>お車（{d.vehicle.plate_number} {d.vehicle.car_name} {d.vehicle.car_model}）の</p>
          <p>車検満了が近付いておりますのでお知らせいたします。</p>
          <p className="mt-3">ご予約・お問い合わせ:</p>
          <p>{COMPANY_INFO.name}</p>
          <p>{COMPANY_INFO.phone}</p>
        </div>
      </div>
    </div>
  )
}

// ─── テンプレート: 12. 申請書類 ───────────────────────
function ApplicationTemplate({ d }: { d: DocumentData }) {
  return (
    <>
      <div className="flex justify-between items-start mb-6">
        <div>
          <p className="text-sm">整備No: <span className="font-mono">{d.maintenance.maintenance_no}</span></p>
          <p className="text-sm">発行日: {d.issueDate}</p>
        </div>
        <CompanyHeader issueDate={d.issueDate} withSeal={false} />
      </div>
      <SectionTitle title="申　請　書　類" />
      <p className="text-sm mb-4">下記の整備に関する申請書類一覧</p>
      <VehicleBlock vehicle={d.vehicle} />
      <p className="text-sm mb-2">顧客: {d.customer.primaryName}{d.customer.attentionName ? ` / 担当: ${d.customer.attentionName}` : ''}</p>
      <table className="w-full text-sm border-collapse border border-zinc-400 mb-4">
        <thead className="bg-zinc-100">
          <tr>
            <th className="border border-zinc-400 px-3 py-1.5 text-left">書類名</th>
            <th className="border border-zinc-400 px-3 py-1.5 text-center w-24">必要</th>
            <th className="border border-zinc-400 px-3 py-1.5 text-center w-24">提出済</th>
          </tr>
        </thead>
        <tbody>
          {[
            '自動車検査証 (車検証)',
            '自賠責保険証明書',
            '自動車税納税証明書',
            '点検整備記録簿',
            '委任状',
            '印鑑証明書',
            'その他',
          ].map((row) => (
            <tr key={row}>
              <td className="border border-zinc-400 px-3 py-2">{row}</td>
              <td className="border border-zinc-400 px-3 py-2 text-center">☐</td>
              <td className="border border-zinc-400 px-3 py-2 text-center">☐</td>
            </tr>
          ))}
        </tbody>
      </table>
      <NoteBox title="備考" content={d.maintenance.general_note ?? ''} />
    </>
  )
}

// ─── エクスポート: type → コンポーネント ──────────────
export const TEMPLATES = {
  'estimate-rough':  EstimateRoughTemplate,
  'estimate':        EstimateTemplate,
  'work-order':      WorkOrderTemplate,
  'delivery-note':   DeliveryNoteTemplate,
  'invoice':         InvoiceTemplate,
  'next-proposal':   NextProposalTemplate,
  'intake-summary':  IntakeSummaryTemplate,
  'receipt':         ReceiptTemplate,
  'custody':         CustodyTemplate,
  'inspection-fees': InspectionFeesTemplate,
  'postcard':        PostcardTemplate,
  'application':     ApplicationTemplate,
} as const
