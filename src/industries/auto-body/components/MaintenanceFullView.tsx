/**
 * 整備の「全体」ビュー（CarRide スタイルの 1 画面伝票）。
 *
 * 整備詳細ページの「全体」タブで使う read-only サマリー。
 * 編集は概要タブの個別サブタブ（行アイテム/諸費用/入金）で行う。
 *
 * レイアウト:
 *   - 概要（入庫日/担当者/メモ）
 *   - 顧客 + 車両（2 カラム）
 *   - 整備費用テーブル（左 2/3） + 右サイド（課税諸費用 / 非課税諸費用 / 整備明細 / 粗利益）
 *   - 入金テーブル
 *   - 帳票印刷（次フェーズで実装予定のスタブ）
 */
import { db } from '@/lib/db'
import {
  maintenance_records, customer_vehicles, accounts, contacts,
  maintenance_line_items, maintenance_fees, maintenance_payments,
} from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import Link from 'next/link'

type Props = {
  maintenanceId: string
  users: { id: string; name: string }[]
}

// 税率テーブル（tax_mode に応じた税率 %）
const TAX_RATES: Record<string, number> = {
  '税別10%': 10,
  '税別8%':  8,
  '税込10%': 10,
  '税込8%':  8,
  '非課税':  0,
}

function yen(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return `¥${Math.round(Number(n)).toLocaleString()}`
}

export default async function MaintenanceFullView({ maintenanceId, users }: Props) {
  // 必要データを並列取得
  const [mRow, lines, fees, payments] = await Promise.all([
    db.select({
      m:       maintenance_records,
      vehicle: customer_vehicles,
      account: { id: accounts.id, name: accounts.name, phone: accounts.phone, address: accounts.address },
      contact: { id: contacts.id, full_name: contacts.full_name, email: contacts.email, phone: contacts.phone },
    })
      .from(maintenance_records)
      .leftJoin(customer_vehicles, eq(maintenance_records.customer_vehicle_id, customer_vehicles.id))
      .leftJoin(accounts, eq(maintenance_records.account_id, accounts.id))
      .leftJoin(contacts, eq(maintenance_records.contact_id, contacts.id))
      .where(eq(maintenance_records.id, maintenanceId))
      .then((r) => r[0] ?? null),
    db.select().from(maintenance_line_items)
      .where(eq(maintenance_line_items.maintenance_id, maintenanceId))
      .orderBy(asc(maintenance_line_items.sort_order)),
    db.select().from(maintenance_fees)
      .where(eq(maintenance_fees.maintenance_id, maintenanceId))
      .orderBy(asc(maintenance_fees.sort_order)),
    db.select().from(maintenance_payments)
      .where(eq(maintenance_payments.maintenance_id, maintenanceId))
      .orderBy(asc(maintenance_payments.payment_date)),
  ])

  if (!mRow) return null
  const m = mRow.m
  const v = mRow.vehicle
  const account = mRow.account?.id ? mRow.account : null
  const contact = mRow.contact?.id ? mRow.contact : null

  const receptionName = m.reception_owner_id ? users.find((u) => u.id === m.reception_owner_id)?.name ?? '—' : '—'
  const workerName    = m.worker_owner_id    ? users.find((u) => u.id === m.worker_owner_id)?.name    ?? '—' : '—'

  // ─── 集計 ──────────────────────────────────────
  let laborSum = 0
  let partsSum = 0
  let laborCost = 0  // 作業原価（schema にカラム無し、参考用 0 固定）
  let partsCost = 0
  for (const l of lines) {
    if (l.is_excluded) continue
    const labor = Number(l.labor_amount ?? 0)
    const qty   = Number(l.parts_qty ?? 0)
    const unit  = Number(l.parts_unit_price ?? 0)
    const cost  = Number(l.cost_unit_price ?? 0)
    if (Number.isFinite(labor)) laborSum += labor
    if (Number.isFinite(qty) && Number.isFinite(unit)) partsSum += qty * unit
    if (Number.isFinite(qty) && Number.isFinite(cost)) partsCost += qty * cost
  }
  const linesTotal = laborSum + partsSum

  let taxableFees    = 0
  let nontaxableFees = 0
  let taxableFeesCost = 0
  for (const f of fees) {
    const a = Number(f.amount ?? 0)
    const c = Number(f.cost_amount ?? 0)
    if (f.category === '課税') {
      if (Number.isFinite(a)) taxableFees += a
      if (Number.isFinite(c)) taxableFeesCost += c
    } else if (f.category === '非課税') {
      if (Number.isFinite(a)) nontaxableFees += a
    }
  }

  const taxRate = TAX_RATES[m.tax_mode ?? '税別10%'] ?? 10
  // 税別の場合のみ外税を加算。税込/非課税は 0
  const isTaxExternal = m.tax_mode?.startsWith('税別')
  const consumptionTax = isTaxExternal
    ? Math.floor((linesTotal + taxableFees) * (taxRate / 100))
    : 0
  const grandTotal = linesTotal + taxableFees + consumptionTax + nontaxableFees

  const paidSum = payments.reduce((acc, p) => acc + Number(p.amount ?? 0), 0)
  const balance = grandTotal - paidSum

  const grossProfit = linesTotal - laborCost - partsCost
  const netGrossProfit = grossProfit  // 追加粗利益は schema に無いので same

  // ─── レンダー ──────────────────────────────────
  const editHref = (subTab: string) => `/maintenance/${maintenanceId}?tab=overview&sub=${subTab}`

  return (
    <div className="space-y-4">
      {/* ── 概要 ─────────────────────────────────── */}
      <section className="bg-white border border-zinc-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">概要</h2>
          <span className="font-mono text-xs text-zinc-500">整備No. {m.maintenance_no}</span>
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-x-3 gap-y-2 text-sm">
          <Item label="入庫日" value={m.intake_date ?? '—'} />
          <Item label="入庫時間" value={m.intake_time ?? '—'} />
          <Item label="引取場所" value={m.pickup_location ?? '—'} />
          <Item label="納車日" value={m.delivery_date ?? '—'} />
          <Item label="納車時間" value={m.delivery_time ?? '—'} />
          <Item label="引渡場所" value={m.delivery_location ?? '—'} />
          <Item label="売上計上日" value={m.sales_recording_date ?? '—'} />
          <Item label="登録日" value={m.created_at ? new Date(m.created_at).toLocaleDateString('ja-JP') : '—'} />
        </dl>
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-3 gap-y-2 text-sm mt-3 pt-3 border-t border-zinc-100">
          <Item label="入庫区分" value={m.intake_category ?? '—'} />
          <Item label="受付担当者" value={receptionName} />
          <Item label="作業担当者" value={workerName} />
          <Item label="総走行距離" value={m.mileage != null ? `${Number(m.mileage).toLocaleString()} km` : '—'} />
          <Item label="拠点" value={m.branch_id ?? '—'} />
        </dl>
        <dl className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3 pt-3 border-t border-zinc-100">
          <Memo label="整備メモ（印字なし）" value={m.internal_memo} />
          <Memo label="作業指示備考" value={m.work_order_note} />
          <Memo label="備考" value={m.general_note} />
        </dl>
      </section>

      {/* ── 顧客 + 車両 ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white border border-zinc-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">顧客</h2>
          {account ? (
            <dl className="space-y-2 text-sm">
              <Item label="顧客（取引先）" value={
                <Link href={`/accounts/${account.id}`} className="text-blue-600 hover:underline">🏢 {account.name}</Link>
              } />
              {contact && (
                <Item label="顧客担当者" value={
                  <Link href={`/contacts/${contact.id}`} className="text-blue-600 hover:underline">👤 {contact.full_name}</Link>
                } />
              )}
              <Item label="電話番号" value={contact?.phone ?? account.phone ?? '—'} />
              <Item label="メールアドレス" value={contact?.email ?? '—'} />
              <Item label="住所" value={account.address ?? '—'} />
            </dl>
          ) : <p className="text-sm text-zinc-400">顧客情報なし</p>}
        </section>

        <section className="bg-white border border-zinc-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">車両</h2>
          {v ? (
            <>
              <p className="text-sm mb-2">
                <Link href={`/customer-vehicles/${v.id}`} className="text-blue-600 hover:underline">
                  🚗 {v.plate_number ?? '—'}（{[v.car_name, v.car_model, v.grade].filter(Boolean).join(' / ')}）
                </Link>
              </p>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2 text-xs">
                <Item label="運輸支局" value={v.transport_branch ?? '—'} />
                <Item label="分類番号" value={v.classification_number ?? '—'} />
                <Item label="かな" value={v.kana ?? '—'} />
                <Item label="ナンバー" value={v.plate_number ?? '—'} />
                <Item label="種別" value={v.vehicle_kind ?? '—'} />
                <Item label="用途" value={v.vehicle_usage ?? '—'} />
                <Item label="自家・事業" value={v.private_business ?? '—'} />
                <Item label="車体の形状" value={v.body_shape ?? '—'} />
                <Item label="車台番号" value={v.vin ?? '—'} />
                <Item label="型式" value={v.type_designation ?? '—'} />
                <Item label="類別区分" value={v.class_category ?? '—'} />
                <Item label="初年度" value={[v.first_registration_year, v.first_registration_month].filter(Boolean).join('/') || '—'} />
              </dl>
              <p className="text-xs text-zinc-500 mt-2"><strong>車検満了:</strong> {v.inspection_due_date ?? '—'}</p>
              {v.memo && <p className="text-xs text-zinc-500 mt-2 whitespace-pre-wrap">📝 {v.memo}</p>}
            </>
          ) : <p className="text-sm text-zinc-400">車両情報なし</p>}
        </section>
      </div>

      {/* ── 整備費用 + 右サイドバー ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 整備費用テーブル（左 2/3） */}
        <section className="lg:col-span-2 bg-white border border-zinc-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">整備費用</h2>
            <Link href={editHref('lines')} className="text-xs text-blue-600 hover:underline">✏️ 行アイテムを編集</Link>
          </div>
          {lines.length === 0 ? (
            <p className="text-sm text-zinc-400 py-6 text-center">作業項目はまだありません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-zinc-50 border-y border-zinc-200">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium text-zinc-600 w-8">#</th>
                    <th className="px-2 py-1 text-left font-medium text-zinc-600 w-20">区分</th>
                    <th className="px-2 py-1 text-left font-medium text-zinc-600">作業項目</th>
                    <th className="px-2 py-1 text-right font-medium text-zinc-600 w-14">工数</th>
                    <th className="px-2 py-1 text-right font-medium text-zinc-600 w-20">工賃</th>
                    <th className="px-2 py-1 text-right font-medium text-zinc-600 w-12">部品数</th>
                    <th className="px-2 py-1 text-right font-medium text-zinc-600 w-20">部品単価</th>
                    <th className="px-2 py-1 text-right font-medium text-zinc-600 w-20">小計</th>
                    <th className="px-2 py-1 text-center font-medium text-zinc-600 w-12">状況</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {lines.map((l, i) => {
                    const labor = Number(l.labor_amount ?? 0)
                    const qty   = Number(l.parts_qty ?? 0)
                    const unit  = Number(l.parts_unit_price ?? 0)
                    const sub = (Number.isFinite(labor) ? labor : 0) + (Number.isFinite(qty) && Number.isFinite(unit) ? qty * unit : 0)
                    return (
                      <tr key={l.id} className={l.is_excluded ? 'opacity-50' : ''}>
                        <td className="px-2 py-1.5 text-zinc-400 font-mono">{i + 1}</td>
                        <td className="px-2 py-1.5 text-zinc-700">{l.work_category ?? '—'}</td>
                        <td className="px-2 py-1.5 text-zinc-800">
                          {l.item_name}
                          {l.is_excluded && <span className="ml-1 text-[10px] text-red-600 bg-red-50 px-1 rounded">除外</span>}
                          {l.state && <span className="ml-1 text-[10px] text-yellow-700 bg-yellow-50 px-1 rounded">{l.state}</span>}
                          {l.note && <p className="text-[10px] text-zinc-500 mt-0.5">{l.note}</p>}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-zinc-700">{l.hours ?? '—'}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-zinc-700">{yen(labor)}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-zinc-700">{l.parts_qty ?? '—'}{l.parts_unit ? ` ${l.parts_unit}` : ''}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-zinc-700">{yen(unit)}</td>
                        <td className="px-2 py-1.5 text-right font-mono font-semibold text-zinc-900">{yen(sub)}</td>
                        <td className="px-2 py-1.5 text-center">
                          {l.work_status === '完了'
                            ? <span className="text-[10px] text-green-700 bg-green-50 px-1 rounded">完了</span>
                            : <span className="text-[10px] text-zinc-500 bg-zinc-100 px-1 rounded">未完了</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-zinc-50 border-t-2 border-zinc-200">
                  <tr>
                    <td colSpan={4} className="px-2 py-2 text-right text-xs text-zinc-600">作業代計</td>
                    <td className="px-2 py-2 text-right font-mono text-sm">{yen(laborSum)}</td>
                    <td colSpan={2} className="px-2 py-2 text-right text-xs text-zinc-600">部品代計</td>
                    <td className="px-2 py-2 text-right font-mono text-sm">{yen(partsSum)}</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan={7} className="px-2 py-2 text-right text-xs font-semibold text-zinc-700">整備費用計</td>
                    <td className="px-2 py-2 text-right font-mono font-semibold">{yen(linesTotal)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* 右サイドバー */}
        <div className="space-y-4">
          {/* 課税諸費用 */}
          <section className="bg-white border border-zinc-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold text-zinc-500 uppercase">課税諸費用</h2>
              <Link href={editHref('fees')} className="text-[10px] text-blue-600 hover:underline">✏️ 編集</Link>
            </div>
            {fees.filter((f) => f.category === '課税').length === 0 ? (
              <p className="text-xs text-zinc-400 py-2">なし</p>
            ) : (
              <dl className="space-y-1 text-xs">
                {fees.filter((f) => f.category === '課税').map((f) => (
                  <div key={f.id} className="flex justify-between">
                    <dt className="text-zinc-700 truncate">{f.item_name}</dt>
                    <dd className="font-mono text-zinc-900 shrink-0 ml-2">{yen(Number(f.amount))}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="border-t border-zinc-100 pt-2 mt-2 text-xs flex justify-between font-semibold">
              <span className="text-zinc-700">課税諸費用計</span>
              <span className="font-mono">{yen(taxableFees)}</span>
            </div>
          </section>

          {/* 非課税諸費用 */}
          <section className="bg-white border border-zinc-200 rounded-lg p-4">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase mb-2">非課税諸費用</h2>
            {fees.filter((f) => f.category === '非課税').length === 0 ? (
              <p className="text-xs text-zinc-400 py-2">なし</p>
            ) : (
              <dl className="space-y-1 text-xs">
                {fees.filter((f) => f.category === '非課税').map((f) => (
                  <div key={f.id} className="flex justify-between">
                    <dt className="text-zinc-700 truncate">{f.item_name}</dt>
                    <dd className="font-mono text-zinc-900 shrink-0 ml-2">{yen(Number(f.amount))}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="border-t border-zinc-100 pt-2 mt-2 text-xs flex justify-between font-semibold">
              <span className="text-zinc-700">非課税諸費用計</span>
              <span className="font-mono">{yen(nontaxableFees)}</span>
            </div>
          </section>

          {/* 車両整備明細 */}
          <section className="bg-white border border-zinc-200 rounded-lg p-4">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase mb-2">車両整備明細</h2>
            <dl className="space-y-1 text-xs">
              <Row label="整備費用計" value={yen(linesTotal)} />
              <Row label="課税諸費用計" value={yen(taxableFees)} />
              {isTaxExternal && (
                <Row label={`消費税（外税${taxRate}%）`} value={yen(consumptionTax)} />
              )}
              <Row label="非課税諸費用計" value={yen(nontaxableFees)} />
            </dl>
            <div className="border-t-2 border-zinc-200 pt-2 mt-2 text-sm flex justify-between font-bold">
              <span>費用計</span>
              <span className="font-mono text-blue-700">{yen(grandTotal)}</span>
            </div>
          </section>

          {/* 粗利益 */}
          <section className="bg-white border border-zinc-200 rounded-lg p-4">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase mb-2">粗利益</h2>
            <dl className="space-y-1 text-xs">
              <Row label="税別価格" value={yen(linesTotal)} />
              <Row label="作業原価計（税別）" value={yen(laborCost)} muted />
              <Row label="部品原価計（税別）" value={yen(partsCost)} muted />
              <Row label="課税諸費用原価計" value={yen(taxableFeesCost)} muted />
              <Row label="差引粗利益（税別）" value={yen(grossProfit)} />
            </dl>
            <div className="border-t-2 border-zinc-200 pt-2 mt-2 text-sm flex justify-between font-bold">
              <span>粗利益</span>
              <span className="font-mono text-green-700">{yen(netGrossProfit)}</span>
            </div>
          </section>
        </div>
      </div>

      {/* ── 入金・預かり金 ──────────────────────── */}
      <section className="bg-white border border-zinc-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">入金・預かり金</h2>
          <Link href={editHref('payments')} className="text-xs text-blue-600 hover:underline">✏️ 入金を編集</Link>
        </div>
        {payments.length === 0 ? (
          <p className="text-sm text-zinc-400 py-4 text-center">入金記録はまだありません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-zinc-50 border-y border-zinc-200">
                <tr>
                  <th className="px-2 py-1 text-left font-medium text-zinc-600 w-8">#</th>
                  <th className="px-2 py-1 text-left font-medium text-zinc-600 w-24">入金日</th>
                  <th className="px-2 py-1 text-left font-medium text-zinc-600 w-24">支払方法</th>
                  <th className="px-2 py-1 text-right font-medium text-zinc-600 w-24">金額</th>
                  <th className="px-2 py-1 text-left font-medium text-zinc-600">メモ</th>
                  <th className="px-2 py-1 text-left font-medium text-zinc-600 w-32">担当者</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {payments.map((p, i) => {
                  const owner = users.find((u) => u.id === p.owner_id)?.name
                  return (
                    <tr key={p.id}>
                      <td className="px-2 py-1.5 text-zinc-400 font-mono">{i + 1}</td>
                      <td className="px-2 py-1.5 text-zinc-700">{p.payment_date}</td>
                      <td className="px-2 py-1.5 text-zinc-700">{p.payment_method}</td>
                      <td className="px-2 py-1.5 text-right font-mono font-semibold text-zinc-900">{yen(Number(p.amount))}</td>
                      <td className="px-2 py-1.5 text-zinc-500 text-xs truncate">{p.memo ?? ''}</td>
                      <td className="px-2 py-1.5 text-zinc-600">{owner ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t-2 border-zinc-200 pt-2 mt-3 grid grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-700">入金額計</span>
            <span className="font-mono font-semibold">{yen(paidSum)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-700">入金不足額</span>
            <span className={`font-mono font-bold ${balance > 0 ? 'text-red-600' : 'text-green-700'}`}>{yen(balance)}</span>
          </div>
        </div>
      </section>

      {/* ── 帳票印刷（スタブ）──────────────── */}
      <section className="bg-white border border-zinc-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">帳票印刷</h2>
          <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">次フェーズで実装予定</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {[
            '📄 概算見積書',
            '📄 見積書',
            '📄 作業指示書',
            '📄 納品書',
            '📄 請求書',
            '📄 次回整備提案書',
            '📄 入庫概要シート',
            '📄 領収証',
            '📄 預かり証',
            '📄 検査諸費用計算書',
            '📄 はがき宛名（車検案内）',
            '📄 申請書類',
          ].map((label) => (
            <button
              key={label}
              type="button"
              disabled
              className="px-3 py-2 text-xs text-zinc-500 bg-zinc-50 border border-zinc-200 rounded-md cursor-not-allowed"
              title="まだ実装されていません"
            >
              {label}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

// ───────────────────────────────────────────────
// 小さなプレゼンテーション用ヘルパ（コンポーネント外で declare）
// ───────────────────────────────────────────────
function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] text-zinc-400 mb-0.5">{label}</dt>
      <dd className="text-zinc-800">{value || '—'}</dd>
    </div>
  )
}

function Memo({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-[10px] text-zinc-400 mb-0.5">{label}</dt>
      <dd className="text-xs text-zinc-700 whitespace-pre-wrap bg-zinc-50 rounded px-2 py-1.5 min-h-[2.5rem]">{value || <span className="text-zinc-300">—</span>}</dd>
    </div>
  )
}

function Row({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className={muted ? 'text-zinc-500' : 'text-zinc-700'}>{label}</dt>
      <dd className={`font-mono ${muted ? 'text-zinc-500' : 'text-zinc-900'}`}>{value}</dd>
    </div>
  )
}
