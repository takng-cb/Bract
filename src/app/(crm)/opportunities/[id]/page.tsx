import { db } from '@/lib/db'
import { opportunities, accounts, contacts, activities, tasks, attachments, expenses, change_logs } from '@/lib/schema'
import { activityIdsRelatedTo, taskIdsRelatedTo, expenseIdsRelatedTo } from '@/lib/relatedRecords'
import { eq, and, asc, desc, inArray, count } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import StageBar, { type StageConfig } from '@/components/StageBar'
import { updateOpportunityStage, deleteOpportunity } from '@/app/actions/opportunities'
import { uploadAttachment, deleteAttachment } from '@/app/actions/attachments'
import { toggleTaskDone } from '@/app/actions/tasks'
import TagsSection from '@/components/TagsSection'
import ChangeLogSection from '@/components/ChangeLogSection'
import DeleteButton from '@/components/DeleteButton'
import RecordId from '@/components/RecordId'
import AuthGuard from '@/components/AuthGuard'
import CustomFieldsCard from '@/components/CustomFieldsCard'
import { getCustomFieldsWithValues } from '@/lib/customFields'
import { getAllUsers } from '@/lib/userUtils'
import { canEdit } from '@/lib/auth'
import TextImportModal from '@/components/TextImportModal'
import RecordHeader from '@/components/RecordHeader'
import RecordTabs, { type TabDef } from '@/components/RecordTabs'
import RelatedRecordsSection from '@/components/RelatedRecordsSection'
import { calcProfit, commissionBreakdown, effectiveCommissionRatePct, effectiveCommissionMonths } from '@/industries/real-estate/lib/realEstateCommission'
import { calcAutoBodyProfit } from '@/industries/auto-body/lib/autoBodyService'
import { vehicles } from '@/lib/schema'
import { activeIndustry } from '@/lib/industry'
import { getActivityTypes } from '@/lib/activityTypes'

const OPPORTUNITY_STAGES: StageConfig[] = [
  { value: 'prospecting',   label: '見込み',   activeColor: '#71717a', pastColor: '#d4d4d8' },
  { value: 'qualification', label: '要件確認', activeColor: '#2563eb', pastColor: '#93c5fd' },
  { value: 'proposal',      label: '提案',     activeColor: '#d97706', pastColor: '#fcd34d' },
  { value: 'negotiation',   label: '交渉',     activeColor: '#ea580c', pastColor: '#fdba74' },
  { value: 'closed_won',    label: '受注 🎉',  activeColor: '#16a34a', pastColor: '#86efac' },
  { value: 'closed_lost',   label: '失注',     activeColor: '#dc2626', pastColor: '#fca5a5' },
]

const STAGE_LABEL: Record<string, string> = {
  prospecting: '見込み', qualification: '要件確認', proposal: '提案',
  negotiation: '交渉', closed_won: '受注', closed_lost: '失注',
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  high:   { label: '高', color: 'text-red-600 bg-red-50' },
  medium: { label: '中', color: 'text-yellow-700 bg-yellow-50' },
  low:    { label: '低', color: 'text-green-700 bg-green-50' },
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [opportunity, activitiesList, tasksList, attachmentsList, expensesList, customData, , allUsers, activityTypes, changeLogCountRow] = await Promise.all([
    db.select({
      id: opportunities.id, name: opportunities.name, stage: opportunities.stage,
      amount: opportunities.amount, probability: opportunities.probability,
      close_date: opportunities.close_date, description: opportunities.description,
      created_at: opportunities.created_at, owner_id: opportunities.owner_id,
      transaction_type: opportunities.transaction_type,
      commission_fee:  opportunities.commission_fee,
      brokerage_type:  opportunities.brokerage_type,
      other_profit:    opportunities.other_profit,
      service_type:    opportunities.service_type,
      vehicle_id:      opportunities.vehicle_id,
      parts_cost:      opportunities.parts_cost,
      accounts: { id: accounts.id, name: accounts.name },
      contacts: { id: contacts.id, full_name: contacts.full_name },
    })
      .from(opportunities)
      .leftJoin(accounts, eq(opportunities.account_id, accounts.id))
      .leftJoin(contacts, eq(opportunities.contact_id, contacts.id))
      .where(eq(opportunities.id, id))
      .then((r) => r[0] ?? null),
    db.select().from(activities)
      .where(inArray(activities.id, activityIdsRelatedTo('opportunity', id)))
      .orderBy(desc(activities.occurred_at)),
    db.select().from(tasks)
      .where(inArray(tasks.id, taskIdsRelatedTo('opportunity', id)))
      .orderBy(asc(tasks.done), asc(tasks.due_date)),
    db.select().from(attachments).where(eq(attachments.opportunity_id, id)).orderBy(desc(attachments.created_at)),
    db.select().from(expenses)
      .where(inArray(expenses.id, expenseIdsRelatedTo('opportunity', id)))
      .orderBy(desc(expenses.expense_date)),
    getCustomFieldsWithValues('opportunities', id),
    canEdit(),
    getAllUsers(),
    getActivityTypes(),
    db.select({ c: count() }).from(change_logs)
      .where(and(eq(change_logs.object_type, 'opportunity'), eq(change_logs.object_id, id))),
  ])

  const ACTIVITY_TYPE_LABELS: Record<string, string> = {}
  for (const t of activityTypes) ACTIVITY_TYPE_LABELS[t.value] = `${t.icon} ${t.label}`

  if (!opportunity) notFound()
  const account   = opportunity.accounts?.id ? opportunity.accounts : null
  const contact   = opportunity.contacts?.id ? opportunity.contacts : null
  const ownerName = opportunity.owner_id ? (allUsers.find((u) => u.id === opportunity.owner_id)?.name ?? null) : null

  const vehicleInfo =
    activeIndustry === 'auto-body' && opportunity.vehicle_id
      ? await db.select({
          id: vehicles.id, maker: vehicles.maker, model: vehicles.model,
          license_plate: vehicles.license_plate, year: vehicles.year,
        }).from(vehicles).where(eq(vehicles.id, opportunity.vehicle_id)).then((r) => r[0] ?? null)
      : null

  async function changeStage(stage: string) {
    'use server'
    await updateOpportunityStage(id, stage)
  }

  async function handleDelete() {
    'use server'
    await deleteOpportunity(id)
  }

  async function toggleTask(formData: FormData) {
    'use server'
    const taskId = formData.get('task_id') as string
    const done   = formData.get('done') === 'true'
    await toggleTaskDone(taskId, done, `/opportunities/${id}`)
  }

  async function uploadFile(formData: FormData) {
    'use server'
    formData.set('opportunity_id', id)
    formData.set('revalidate', `/opportunities/${id}`)
    await uploadAttachment(formData)
  }

  async function deleteFile(formData: FormData) {
    'use server'
    const attachId = formData.get('attach_id') as string
    const path     = formData.get('storage_path') as string
    await deleteAttachment(attachId, path, `/opportunities/${id}`)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

  // ── 概要タブ ─────────────────────────────────────────────────────
  const overviewContent = (
    <>
      <div className="mb-6">
        <StageBar stages={OPPORTUNITY_STAGES} currentStage={opportunity.stage} updateAction={changeStage} />
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">商談情報</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-zinc-400 mb-1">ステージ</dt>
            <dd className="text-sm font-medium text-zinc-800">{STAGE_LABEL[opportunity.stage] ?? opportunity.stage}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">完了予定日</dt>
            <dd className="text-sm text-zinc-800">{opportunity.close_date ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">{activeIndustry === 'real-estate' && opportunity.transaction_type === '賃貸' ? '月額賃料' : '金額'}</dt>
            <dd className="text-sm font-semibold text-zinc-800">{opportunity.amount ? `¥${Number(opportunity.amount).toLocaleString()}` : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">確度</dt>
            <dd className="text-sm text-zinc-800">{opportunity.probability != null ? `${opportunity.probability}%` : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">担当者</dt>
            <dd className="text-sm text-zinc-800">{ownerName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">登録日</dt>
            <dd className="text-sm text-zinc-800">{opportunity.created_at ? new Date(opportunity.created_at).toLocaleDateString('ja-JP') : '—'}</dd>
          </div>
        </dl>
        <div className="mt-4 pt-4 border-t border-zinc-100">
          <dt className="text-xs text-zinc-400 mb-1">概要・メモ</dt>
          <dd className="text-sm text-zinc-800 whitespace-pre-wrap min-h-[2.5rem]">
            {opportunity.description ?? <span className="text-zinc-300">—</span>}
          </dd>
        </div>
        {(() => {
          const isReal     = activeIndustry === 'real-estate'
          const isAutoBody = activeIndustry === 'auto-body'
          const totalExp = expensesList.reduce((s, e) => s + Number(e.amount), 0)
          const prob     = opportunity.probability != null ? opportunity.probability / 100 : null

          let weighted: number | null = null
          let gross: number | null = null
          let weightedLabel = ''
          let showWeighted = false
          let baseValue = 0

          if (isReal) {
            const fee    = opportunity.commission_fee != null ? Number(opportunity.commission_fee) : null
            const oth    = opportunity.other_profit != null ? Number(opportunity.other_profit) : 0
            const profit = fee != null ? calcProfit(fee, opportunity.brokerage_type, oth) : 0
            weighted     = prob != null && fee != null ? Math.round(profit * prob) : (fee != null ? profit : null)
            gross        = weighted != null ? weighted - totalExp : null
            weightedLabel = `想定売上${prob != null ? '（利益 × 確度）' : '（利益）'}`
            showWeighted = fee != null
            baseValue    = fee ?? 0
          } else if (isAutoBody) {
            const amt    = opportunity.amount != null ? Number(opportunity.amount) : null
            const pc     = opportunity.parts_cost != null ? Number(opportunity.parts_cost) : 0
            const profit = amt != null ? calcAutoBodyProfit(amt, pc) : 0
            weighted     = prob != null && amt != null ? Math.round(profit * prob) : (amt != null ? profit : null)
            gross        = weighted != null ? weighted - totalExp : null
            weightedLabel = `想定売上${prob != null ? '（利益 × 確度）' : '（利益）'}`
            showWeighted = amt != null
            baseValue    = amt ?? 0
          } else {
            const amount = Number(opportunity.amount ?? 0)
            weighted     = prob != null && amount > 0 ? Math.round(amount * prob) : null
            gross        = weighted != null ? weighted - totalExp : null
            weightedLabel = '想定売上（金額 × 確度）'
            showWeighted = weighted != null
            baseValue    = amount
          }

          if (baseValue === 0 && totalExp === 0) return null
          return (
            <div className="mt-4 pt-4 border-t border-zinc-200">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">財務サマリー</p>
              <div className="space-y-2">
                {showWeighted && weighted != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">{weightedLabel}</span>
                    <span className="font-semibold text-blue-700">¥{weighted.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">経費合計</span>
                  <span className="font-semibold text-orange-600">− ¥{totalExp.toLocaleString()}</span>
                </div>
                {gross != null && (
                  <div className="flex justify-between text-sm pt-2 border-t border-zinc-100">
                    <span className="font-semibold text-zinc-700">粗利（想定）</span>
                    <span className={`font-bold text-base ${gross >= 0 ? 'text-green-700' : 'text-red-600'}`}>¥{gross.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })()}
      </div>

      {/* 不動産情報 */}
      {activeIndustry === 'real-estate' && (() => {
        const tx    = opportunity.transaction_type === '賃貸' ? '賃貸' : '売買'
        const isRent = tx === '賃貸'
        const price = opportunity.amount != null ? Number(opportunity.amount) : null
        const fee   = opportunity.commission_fee != null ? Number(opportunity.commission_fee) : null
        const oth   = opportunity.other_profit != null ? Number(opportunity.other_profit) : 0
        const bk    = opportunity.brokerage_type ?? null
        const hasAny = fee != null || bk != null || oth > 0
        if (!hasAny) return null
        const profit = calcProfit(fee, bk, oth)
        const breakdown = commissionBreakdown(price, tx)
        const effRate = !isRent ? effectiveCommissionRatePct(price, fee) : null
        const effMonths = isRent ? effectiveCommissionMonths(price, fee) : null
        return (
          <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">不動産情報</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-zinc-400 mb-1">取引区分</dt>
                <dd className="text-sm text-zinc-800">{tx}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-400 mb-1">仲介種別</dt>
                <dd className="text-sm text-zinc-800">{bk ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-400 mb-1">仲介手数料</dt>
                <dd className="text-sm text-zinc-800">
                  {fee != null ? `¥${Math.round(fee).toLocaleString('ja-JP')}` : '—'}
                  {(breakdown || effRate != null || effMonths != null) && (
                    <span className="block text-[11px] text-zinc-400 mt-0.5">
                      {breakdown}
                      {breakdown && (effRate != null || effMonths != null) && ' ・ '}
                      {effRate != null && `実効率 ${effRate.toFixed(2)}%`}
                      {effMonths != null && `${effMonths.toFixed(2)}ヶ月分`}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-400 mb-1">その他利益</dt>
                <dd className="text-sm text-zinc-800">¥{Math.round(oth).toLocaleString('ja-JP')}</dd>
              </div>
            </dl>
            <div className="mt-4 pt-4 border-t border-zinc-200">
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-semibold text-zinc-700">利益（自動計算）</span>
                <span className={`text-xl font-bold ${profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  ¥{Math.round(profit).toLocaleString('ja-JP')}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                仲介手数料 × {bk === '両手' ? '2（両手）' : '1'} ＋ その他利益（税抜）
              </p>
            </div>
          </div>
        )
      })()}

      {/* 自動車整備情報 */}
      {activeIndustry === 'auto-body' && (() => {
        const st  = opportunity.service_type
        const amt = opportunity.amount != null ? Number(opportunity.amount) : 0
        const pc  = opportunity.parts_cost != null ? Number(opportunity.parts_cost) : 0
        const profit = calcAutoBodyProfit(amt, pc)
        const hasAny = st || vehicleInfo || pc > 0
        if (!hasAny) return null
        return (
          <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">自動車整備情報</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-zinc-400 mb-1">サービス区分</dt>
                <dd className="text-sm text-zinc-800">{st ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-400 mb-1">対象車両</dt>
                <dd className="text-sm text-zinc-800">
                  {vehicleInfo ? (
                    <Link href={`/vehicles/${vehicleInfo.id}`} className="text-blue-600 hover:underline">
                      🚗 {vehicleInfo.maker} {vehicleInfo.model}
                      {vehicleInfo.year && <span className="text-xs text-zinc-400 ml-1">({vehicleInfo.year}年式)</span>}
                      {vehicleInfo.license_plate && <span className="text-xs text-zinc-400 ml-1">{vehicleInfo.license_plate}</span>}
                    </Link>
                  ) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-400 mb-1">売上（金額）</dt>
                <dd className="text-sm text-zinc-800">{amt > 0 ? `¥${amt.toLocaleString()}` : '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-400 mb-1">部品仕入原価</dt>
                <dd className="text-sm text-zinc-800">¥{pc.toLocaleString()}</dd>
              </div>
            </dl>
            <div className="mt-4 pt-4 border-t border-zinc-200">
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-semibold text-zinc-700">利益（自動計算）</span>
                <span className={`text-xl font-bold ${profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  ¥{profit.toLocaleString()}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">売上 − 部品仕入原価（税抜）</p>
            </div>
          </div>
        )
      })()}

      {customData.fields.length > 0 && (
        <div className="mb-6">
          <CustomFieldsCard fields={customData.fields} values={customData.values} />
        </div>
      )}

      {/* 添付ファイル */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-zinc-800">添付ファイル <span className="text-zinc-400 font-normal text-sm">({attachmentsList.length})</span></h2>
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          {attachmentsList.length > 0 && (
            <div className="divide-y divide-zinc-100">
              {attachmentsList.map((f) => (
                <div key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50">
                  <span className="text-xl shrink-0">📄</span>
                  <div className="flex-1 min-w-0">
                    <a href={`${supabaseUrl}/storage/v1/object/public/attachments/${f.storage_path}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline truncate block">{f.file_name}</a>
                    <p className="text-xs text-zinc-400">{formatFileSize(f.file_size)} · {f.created_at ? new Date(f.created_at).toLocaleDateString('ja-JP') : ''}</p>
                  </div>
                  <AuthGuard minRole="editor">
                    <form action={deleteFile}>
                      <input type="hidden" name="attach_id" value={f.id} />
                      <input type="hidden" name="storage_path" value={f.storage_path} />
                      <button type="submit" className="text-xs text-red-400 hover:text-red-600 shrink-0">削除</button>
                    </form>
                  </AuthGuard>
                </div>
              ))}
            </div>
          )}
          <AuthGuard minRole="editor">
            <form action={uploadFile} className="px-4 py-3 border-t border-zinc-100 flex items-center gap-3">
              <input type="file" name="file" className="flex-1 text-sm text-zinc-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200" />
              <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors shrink-0">アップロード</button>
            </form>
          </AuthGuard>
        </div>
      </section>

      {/* 関係性（多対多） */}
      <section className="mb-6">
        <h2 className="text-base font-semibold text-zinc-800 mb-3">関連レコード</h2>
        <RelatedRecordsSection
          objectType="opportunities"
          recordId={id}
          pagePath={`/opportunities/${id}`}
        />
      </section>
    </>
  )

  // ── 活動・ToDo・経費タブ ───────────────────────────────────────
  const interactionCount = activitiesList.length + tasksList.length + expensesList.length
  const interactionsContent = interactionCount === 0 ? (
    <div className="bg-white border border-zinc-200 rounded-lg p-8 text-center">
      <p className="text-sm text-zinc-400 mb-4">活動・ToDo・経費はまだありません</p>
      <AuthGuard minRole="editor">
        <div className="flex flex-wrap justify-center gap-2">
          <Link href={`/activities/new?opportunity_id=${id}`} className="inline-flex items-center gap-1 px-3 py-1.5 border border-blue-200 text-blue-600 text-sm rounded-md hover:bg-blue-50 transition-colors">＋ 活動を記録</Link>
          <Link href={`/tasks/new?opportunity_id=${id}`}      className="inline-flex items-center gap-1 px-3 py-1.5 border border-blue-200 text-blue-600 text-sm rounded-md hover:bg-blue-50 transition-colors">＋ ToDo を追加</Link>
          <Link href={`/expenses/new?opportunity_id=${id}`}   className="inline-flex items-center gap-1 px-3 py-1.5 border border-blue-200 text-blue-600 text-sm rounded-md hover:bg-blue-50 transition-colors">＋ 経費を追加</Link>
        </div>
      </AuthGuard>
    </div>
  ) : (
    <>
      {activitiesList.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-zinc-800">活動履歴 <span className="text-zinc-400 font-normal text-sm">({activitiesList.length})</span></h2>
            <AuthGuard minRole="editor">
              <div className="flex items-center gap-2">
                <TextImportModal importUrl="/api/import/activities" title="活動履歴インポート" csvFormat="ID,実施日時,種別,件名,内容,担当者名" fieldOptions={{ '種別': ['電話','メール','打ち合わせ','メモ'] }} defaultContext={{ opportunity_id: id }} />
                <Link href={`/activities/new?opportunity_id=${id}`} className="text-xs text-blue-600 hover:text-blue-800">＋ 追加</Link>
              </div>
            </AuthGuard>
          </div>
          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100">
            {activitiesList.map((a) => (
              <div key={a.id} className="px-4 py-3 hover:bg-zinc-50">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-zinc-400">{ACTIVITY_TYPE_LABELS[a.type] ?? a.type}</span>
                  <span className="text-xs text-zinc-400">•</span>
                  <span className="text-xs text-zinc-400">{a.occurred_at ? new Date(a.occurred_at).toLocaleDateString('ja-JP') : '—'}</span>
                </div>
                <Link href={`/activities/${a.id}`} className="text-sm font-medium text-zinc-800 hover:text-blue-600">{a.subject}</Link>
                {a.body && <p className="text-xs text-zinc-500 mt-1">{a.body}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {tasksList.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-zinc-800">ToDo <span className="text-zinc-400 font-normal text-sm">({tasksList.length})</span></h2>
            <AuthGuard minRole="editor">
              <div className="flex items-center gap-2">
                <TextImportModal importUrl="/api/import/tasks" title="ToDoインポート" csvFormat="ID,タイトル,期日,優先度,完了,担当者名" fieldOptions={{ '優先度': ['高','中','低'], '完了': ['完了（済みの場合）','空（未完了の場合）'] }} defaultContext={{ opportunity_id: id }} />
                <Link href={`/tasks/new?opportunity_id=${id}`} className="text-xs text-blue-600 hover:text-blue-800">＋ 追加</Link>
              </div>
            </AuthGuard>
          </div>
          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100">
            {tasksList.map((t) => {
              const priority  = PRIORITY_CONFIG[t.priority] ?? PRIORITY_CONFIG.medium
              const isOverdue = !t.done && t.due_date && new Date(t.due_date) < new Date()
              return (
                <div key={t.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 ${t.done ? 'opacity-60' : ''}`}>
                  <AuthGuard minRole="editor">
                    <form action={toggleTask} className="shrink-0">
                      <input type="hidden" name="task_id" value={t.id} />
                      <input type="hidden" name="done" value={(!t.done).toString()} />
                      <button type="submit" className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${t.done ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-300 hover:border-blue-400'}`}>
                        {t.done && <span className="text-xs leading-none">✓</span>}
                      </button>
                    </form>
                  </AuthGuard>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/tasks/${t.id}`} className={`text-sm hover:text-blue-600 ${t.done ? 'line-through text-zinc-400' : 'text-zinc-900 font-medium'}`}>{t.title}</Link>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priority.color}`}>{priority.label}</span>
                    </div>
                    {t.due_date && <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-500' : 'text-zinc-400'}`}>📅 {new Date(t.due_date).toLocaleDateString('ja-JP')}{isOverdue && ' (期限超過)'}</p>}
                  </div>
                  <AuthGuard minRole="editor">
                    <Link href={`/tasks/${t.id}/edit`} className="text-xs text-zinc-400 hover:text-zinc-700 shrink-0">編集</Link>
                  </AuthGuard>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {expensesList.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-zinc-800">経費 <span className="text-zinc-400 font-normal text-sm">({expensesList.length})</span></h2>
            <AuthGuard minRole="editor">
              <div className="flex items-center gap-2">
                <TextImportModal importUrl="/api/import/expenses" title="経費インポート" csvFormat="ID,件名,金額,カテゴリ,日付,備考" fieldOptions={{ 'カテゴリ': ['交通費','接待費','通信費','消耗品費','広告費','外注費','その他'] }} defaultContext={{ opportunity_id: id }} />
                <Link href={`/expenses/new?opportunity_id=${id}`} className="text-xs text-blue-600 hover:text-blue-800">＋ 追加</Link>
              </div>
            </AuthGuard>
          </div>
          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100">
            {expensesList.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50">
                <div className="flex-1 min-w-0">
                  <Link href={`/expenses/${e.id}`} className="text-sm font-medium text-zinc-800 hover:text-blue-600 block truncate">{e.title}</Link>
                  <p className="text-xs text-zinc-400 mt-0.5">{e.category} · {e.expense_date}</p>
                </div>
                <span className="text-sm font-semibold text-orange-600 shrink-0">¥{Number(e.amount).toLocaleString()}</span>
              </div>
            ))}
            <div className="px-4 py-2 bg-zinc-50 flex justify-between items-center">
              <span className="text-xs font-semibold text-zinc-500">合計</span>
              <span className="text-sm font-bold text-orange-700">¥{expensesList.reduce((s, e) => s + Number(e.amount), 0).toLocaleString()}</span>
            </div>
          </div>
        </section>
      )}
    </>
  )

  // ── 履歴タブ ─────────────────────────────────────────────────────
  const changeLogCount = Number(changeLogCountRow[0]?.c ?? 0)
  const historyContent = (
    <div className="bg-white border border-zinc-200 rounded-lg px-4 py-2">
      <ChangeLogSection objectType="opportunity" objectId={id} />
    </div>
  )

  const tabsConfig: TabDef[] = [
    { id: 'overview', label: '概要', content: overviewContent },
  ]
  tabsConfig.push({
    id: 'interactions',
    label: '活動・ToDo・経費',
    badge: interactionCount > 0 ? interactionCount : undefined,
    content: interactionsContent,
  })
  if (changeLogCount > 0) {
    tabsConfig.push({ id: 'history', label: '履歴', badge: changeLogCount, content: historyContent })
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <RecordHeader
        crumbs={[
          { label: '商談', href: '/opportunities' },
          { label: opportunity.name },
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <Link href={`/opportunities/${id}/edit`} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors">✏️ 編集</Link>
              <DeleteButton action={handleDelete} confirmMessage="この商談を削除しますか？" />
            </div>
          </AuthGuard>
        }
      />

      <div className="mb-4">
        <h1 className="text-2xl font-bold text-zinc-900 break-words">{opportunity.name}</h1>
        {account && <Link href={`/accounts/${account.id}`} className="text-sm text-blue-600 hover:underline mt-1 block">🏢 {account.name}</Link>}
        {contact && <Link href={`/contacts/${contact.id}`} className="text-sm text-blue-600 hover:underline mt-0.5 block">👤 {contact.full_name}</Link>}
        <div className="mt-2">
          <TagsSection objectType="opportunity" objectId={id} revalidatePath={`/opportunities/${id}`} />
        </div>
      </div>

      <RecordTabs defaultTab="overview" tabs={tabsConfig} />

      <div className="mt-6 text-right">
        <RecordId id={id} />
      </div>
    </div>
  )
}
