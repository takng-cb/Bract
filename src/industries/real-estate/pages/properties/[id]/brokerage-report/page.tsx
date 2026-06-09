/**
 * 媒介契約報告書 (Issue #1)
 *
 * 物件の活動・ToDo を期間でまとめ、媒介者として売主へ提出する報告書を生成する。
 * 印刷プレビュー方式（HTML + 印刷用 CSS）。
 *
 * URL: /properties/{id}/brokerage-report?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * デフォルト期間: 直近 14 日
 */
import { db } from '@/lib/db'
import { properties } from '@/industries/real-estate/schema'
import { accounts, contacts, activities, tasks } from '@/lib/schema'
import { activityIdsRelatedTo, taskIdsRelatedTo } from '@/lib/relatedRecords'
import { eq, and, gte, lte, inArray, asc } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { activeIndustry } from '@/lib/industry'
import { getActivityTypes } from '@/lib/activityTypes'
import { getSystemSetting } from '@/lib/systemSettings'
import { NavIcon } from '@/lib/navIcon'

export const dynamic = 'force-dynamic'

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function getDefaultRange(): { from: string; to: string } {
  const now = new Date()
  const past = new Date()
  past.setDate(now.getDate() - 14)
  return { from: ymd(past), to: ymd(now) }
}

function formatDateJP(d: Date | string | null | undefined): string {
  if (!d) return '—'
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return '—'
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

export default async function BrokerageReportPage({
  params,
  searchParams,
}: {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  if (activeIndustry !== 'real-estate') notFound()

  const { id } = await params
  const sp = await searchParams
  const def = getDefaultRange()
  const from = sp.from || def.from
  const to   = sp.to   || def.to

  // 物件取得
  const property = await db.select()
    .from(properties)
    .where(eq(properties.id, id))
    .then((r) => r[0] ?? null)
  if (!property) notFound()

  // 売主情報取得（properties.account_id / contact_id）
  const [seller, sellerContact] = await Promise.all([
    property.account_id
      ? db.select({ id: accounts.id, name: accounts.name, address: accounts.address, phone: accounts.phone })
          .from(accounts).where(eq(accounts.id, property.account_id)).then((r) => r[0] ?? null)
      : null,
    property.contact_id
      ? db.select({ id: contacts.id, full_name: contacts.full_name, phone: contacts.phone, email: contacts.email })
          .from(contacts).where(eq(contacts.id, property.contact_id)).then((r) => r[0] ?? null)
      : null,
  ])

  // 期間内の活動・ToDo
  const fromDate = new Date(`${from}T00:00:00`)
  const toDate   = new Date(`${to}T23:59:59`)
  const [activityList, taskList, activityTypes, companyName] = await Promise.all([
    db.select({
      id:          activities.id,
      type:        activities.type,
      subject:     activities.subject,
      body:        activities.body,
      occurred_at: activities.occurred_at,
    })
      .from(activities)
      .where(and(
        inArray(activities.id, activityIdsRelatedTo('properties', id)),
        gte(activities.occurred_at, fromDate),
        lte(activities.occurred_at, toDate),
      ))
      .orderBy(asc(activities.occurred_at)),
    db.select({
      id:          tasks.id,
      title:       tasks.title,
      description: tasks.description,
      done:        tasks.done,
      due_date:    tasks.due_date,
    })
      .from(tasks)
      .where(and(
        inArray(tasks.id, taskIdsRelatedTo('properties', id)),
        gte(tasks.due_date, from),
        lte(tasks.due_date, to),
      ))
      .orderBy(asc(tasks.due_date)),
    getActivityTypes(),
    getSystemSetting('company_name'),
  ])

  const typeLabels: Record<string, string> = {}
  for (const t of activityTypes) typeLabels[t.value] = t.label

  // 活動を種別ごとに集計
  const activityByType: Record<string, number> = {}
  for (const a of activityList) {
    activityByType[a.type] = (activityByType[a.type] ?? 0) + 1
  }

  const today = new Date()

  return (
    <>
      {/* 印刷用 CSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { size: A4; margin: 18mm; }
        }
        @media screen {
          .report-paper {
            background: white;
            padding: 24mm;
            max-width: 210mm;
            min-height: 297mm;
            margin: 1rem auto;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          }
        }
        .report-paper {
          font-family: "Hiragino Mincho ProN", "MS Mincho", serif;
          color: #18181b;
          line-height: 1.7;
        }
        .report-paper h1 {
          text-align: center;
          font-size: 1.5rem;
          letter-spacing: 0.4em;
          margin: 0 0 1.5rem 0;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid #18181b;
        }
        .report-paper h2 {
          font-size: 1rem;
          margin: 1.5rem 0 0.5rem;
          padding: 0.25rem 0.5rem;
          background: #f4f4f5;
          border-left: 4px solid #18181b;
        }
        .report-paper table {
          width: 100%;
          border-collapse: collapse;
          margin: 0.5rem 0;
          font-size: 0.875rem;
        }
        .report-paper table.bordered th,
        .report-paper table.bordered td {
          border: 1px solid #71717a;
          padding: 0.4rem 0.6rem;
        }
        .report-paper table.bordered th {
          background: #f4f4f5;
          font-weight: normal;
          width: 28%;
          text-align: left;
        }
        .report-paper .sig-block {
          margin-top: 3rem;
          display: flex;
          justify-content: flex-end;
          gap: 2rem;
        }
        .report-paper .sig-block .seal-box {
          width: 4rem;
          height: 4rem;
          border: 1px dashed #71717a;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          color: #a1a1aa;
        }
      `}</style>

      {/* 操作バー（印刷時は非表示） */}
      <div className="no-print bg-zinc-50 border-b border-zinc-200 p-3 flex items-center gap-3 sticky top-0 z-10">
        <form className="flex items-center gap-2 text-sm">
          <label>期間
            <input type="date" name="from" defaultValue={from} className="ml-1 border rounded px-2 py-1" />
            〜
            <input type="date" name="to" defaultValue={to} className="ml-1 border rounded px-2 py-1" />
          </label>
          <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded text-sm">更新</button>
        </form>
        <button onClick={undefined} type="button"
          className="ml-auto px-3 py-1 bg-zinc-800 text-white rounded text-sm cursor-default"
          // クライアント JS なしでも window.print() を window.onload に仕込めないので、表示のみ
        >
          <a href="javascript:window.print()" className="text-white no-underline inline-flex items-center gap-1"><NavIcon icon="🖨" className="w-4 h-4 shrink-0" />印刷</a>
        </button>
      </div>

      {/* 報告書本体 */}
      <div className="report-paper">
        <h1>媒介業務処理状況報告書</h1>

        <div style={{ textAlign: 'right', marginBottom: '1rem' }}>
          発行日: {formatDateJP(today)}
        </div>

        {/* 売主情報 */}
        <h2>1. 報告先（売主）</h2>
        <table className="bordered">
          <tbody>
            <tr>
              <th>氏名 / 法人名</th>
              <td>
                {seller?.name ?? sellerContact?.full_name ?? '—'}
                {' '}様
              </td>
            </tr>
            {seller?.address && (
              <tr>
                <th>住所</th>
                <td>{seller.address}</td>
              </tr>
            )}
            {(sellerContact?.phone || seller?.phone) && (
              <tr>
                <th>連絡先</th>
                <td>{sellerContact?.phone ?? seller?.phone}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* 物件情報 */}
        <h2>2. 対象物件</h2>
        <table className="bordered">
          <tbody>
            <tr><th>物件名</th><td>{property.name}</td></tr>
            <tr><th>所在地</th><td>{property.address ?? '—'}</td></tr>
            {property.land_chiban && <tr><th>地番</th><td>{property.land_chiban}</td></tr>}
            {property.chimoku && <tr><th>地目</th><td>{property.chimoku}</td></tr>}
            {property.area && <tr><th>地積</th><td>{Number(property.area).toLocaleString()} ㎡</td></tr>}
            {property.structure && <tr><th>建物の構造</th><td>{property.structure}</td></tr>}
            {property.price && (
              <tr><th>売却希望価格</th><td>¥{Number(property.price).toLocaleString()}</td></tr>
            )}
            <tr><th>物件種別</th><td>{property.property_type ?? '—'}</td></tr>
            <tr><th>取引区分</th><td>{property.transaction_type ?? '—'}</td></tr>
          </tbody>
        </table>

        {/* 報告対象期間 */}
        <h2>3. 報告対象期間</h2>
        <p>
          {formatDateJP(fromDate)} 〜 {formatDateJP(toDate)}
        </p>

        {/* 期間中の活動 */}
        <h2>4. 期間中の活動報告</h2>
        {activityList.length === 0 ? (
          <p>本期間内に該当する活動はございませんでした。</p>
        ) : (
          <>
            <p style={{ marginBottom: '0.5rem' }}>
              本期間中、以下のとおり {activityList.length} 件の業務を実施いたしました。
            </p>
            {/* 種別サマリー */}
            {Object.keys(activityByType).length > 0 && (
              <table className="bordered" style={{ marginBottom: '1rem' }}>
                <thead>
                  <tr><th>種別</th><th style={{ textAlign: 'right', width: '20%' }}>件数</th></tr>
                </thead>
                <tbody>
                  {Object.entries(activityByType).map(([type, count]) => (
                    <tr key={type}>
                      <td>{typeLabels[type] ?? type}</td>
                      <td style={{ textAlign: 'right' }}>{count} 件</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {/* 詳細 */}
            <table className="bordered">
              <thead>
                <tr>
                  <th style={{ width: '15%' }}>実施日</th>
                  <th style={{ width: '15%' }}>種別</th>
                  <th>件名 / 内容</th>
                </tr>
              </thead>
              <tbody>
                {activityList.map((a) => (
                  <tr key={a.id}>
                    <td>{a.occurred_at ? new Date(a.occurred_at).toLocaleDateString('ja-JP') : '—'}</td>
                    <td>{typeLabels[a.type] ?? a.type}</td>
                    <td>
                      <strong>{a.subject}</strong>
                      {a.body && <div style={{ marginTop: '0.25rem', fontSize: '0.8rem' }}>{a.body}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* 今後の予定 */}
        <h2>5. 今後の予定</h2>
        {taskList.length === 0 ? (
          <p>本期間中に予定されていた業務はございませんでした。</p>
        ) : (
          <table className="bordered">
            <thead>
              <tr>
                <th style={{ width: '15%' }}>予定日</th>
                <th style={{ width: '15%' }}>状況</th>
                <th>業務内容</th>
              </tr>
            </thead>
            <tbody>
              {taskList.map((t) => (
                <tr key={t.id}>
                  <td>{t.due_date ?? '—'}</td>
                  <td>{t.done ? '完了' : '予定'}</td>
                  <td>
                    <strong>{t.title}</strong>
                    {t.description && <div style={{ marginTop: '0.25rem', fontSize: '0.8rem' }}>{t.description}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* 所見・特記事項 */}
        <h2>6. 所見・特記事項</h2>
        <p style={{ minHeight: '4rem' }}>
          {/* 自由記述用エリア。本機能の v2 では編集可能にする */}
          —
        </p>

        {/* 報告者署名欄 */}
        <div className="sig-block">
          <div>
            <p style={{ margin: 0 }}>{companyName ?? 'Bract'}</p>
            <p style={{ marginTop: '0.5rem' }}>担当者：__________________</p>
          </div>
          <div>
            <p style={{ textAlign: 'center', fontSize: '0.75rem', marginBottom: '0.25rem' }}>印</p>
            <div className="seal-box">印</div>
          </div>
        </div>

        <p style={{ marginTop: '2rem', fontSize: '0.75rem', color: '#71717a', textAlign: 'center' }}>
          ※ 本書は Bract CRM により自動生成された媒介業務処理状況報告書です。
        </p>
      </div>
    </>
  )
}
