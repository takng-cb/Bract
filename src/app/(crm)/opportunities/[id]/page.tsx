import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import StageBar, { type StageConfig } from '@/components/StageBar'
import { updateOpportunityStage, deleteOpportunity } from '@/app/actions/opportunities'
import { uploadAttachment, deleteAttachment } from '@/app/actions/attachments'
import TagsSection from '@/components/TagsSection'
import ChangeLogSection from '@/components/ChangeLogSection'
import DeleteButton from '@/components/DeleteButton'

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

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  call: '📞 電話', email: '✉️ メール', meeting: '🤝 打合せ', note: '📝 メモ',
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

  const [
    { data: opportunity },
    { data: activities },
    { data: tasks },
    { data: attachments },
    { data: expenses },
  ] = await Promise.all([
    supabase.from('opportunities').select('*, accounts(id, name)').eq('id', id).single(),
    supabase.from('activities').select('*').eq('opportunity_id', id).order('occurred_at', { ascending: false }),
    supabase.from('tasks').select('*').eq('opportunity_id', id)
      .order('done', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase.from('attachments').select('*').eq('opportunity_id', id).order('created_at', { ascending: false }),
    supabase.from('expenses').select('*').eq('opportunity_id', id).order('expense_date', { ascending: false }),
  ])

  if (!opportunity) notFound()
  const account = opportunity.accounts as { id: string; name: string } | null

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
    const done = formData.get('done') === 'true'
    await supabase.from('tasks').update({ done, updated_at: new Date().toISOString() }).eq('id', taskId)
    revalidatePath(`/opportunities/${id}`)
    revalidatePath('/tasks')
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
    const path = formData.get('storage_path') as string
    await deleteAttachment(attachId, path, `/opportunities/${id}`)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

  return (
    <div className="p-8 max-w-3xl">
      {/* パンくず */}
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/opportunities" className="hover:text-zinc-600">商談</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">{opportunity.name}</span>
      </div>

      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{opportunity.name}</h1>
          {account && (
            <Link href={`/accounts/${account.id}`} className="text-sm text-blue-600 hover:underline mt-1 block">
              🏢 {account.name}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/opportunities/${id}/edit`}
            className="px-4 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors"
          >
            編集
          </Link>
          <DeleteButton
            action={handleDelete}
            confirmMessage="この商談を削除しますか？"
          />
        </div>
      </div>

      {/* ステージバー */}
      <div className="mb-6">
        <StageBar
          stages={OPPORTUNITY_STAGES}
          currentStage={opportunity.stage}
          updateAction={changeStage}
        />
      </div>

      {/* 商談情報 */}
      <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">商談情報</h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-zinc-400 mb-1">ステージ</dt>
            <dd className="text-sm font-medium text-zinc-800">{STAGE_LABEL[opportunity.stage] ?? opportunity.stage}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">完了予定日</dt>
            <dd className="text-sm text-zinc-800">{opportunity.close_date ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">金額</dt>
            <dd className="text-sm font-semibold text-zinc-800">
              {opportunity.amount ? `¥${Number(opportunity.amount).toLocaleString()}` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">確度</dt>
            <dd className="text-sm text-zinc-800">
              {opportunity.probability != null ? `${opportunity.probability}%` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400 mb-1">登録日</dt>
            <dd className="text-sm text-zinc-800">{new Date(opportunity.created_at).toLocaleDateString('ja-JP')}</dd>
          </div>
        </dl>
        <div className="mt-4 pt-4 border-t border-zinc-100">
          <dt className="text-xs text-zinc-400 mb-1">概要・メモ</dt>
          <dd className="text-sm text-zinc-800 whitespace-pre-wrap min-h-[2.5rem]">
            {opportunity.description ?? <span className="text-zinc-300">—</span>}
          </dd>
        </div>

        {/* 財務サマリー */}
        {(() => {
          const base       = Number(opportunity.amount ?? 0)
          const prob       = opportunity.probability != null ? opportunity.probability / 100 : null
          const weighted   = prob != null ? Math.round(base * prob) : null
          const totalExp   = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0)
          const grossProfit = weighted != null ? weighted - totalExp : null
          if (!base && totalExp === 0) return null
          return (
            <div className="mt-4 pt-4 border-t border-zinc-200">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">財務サマリー</p>
              <div className="space-y-2">
                {weighted != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">想定売上（金額 × 確度）</span>
                    <span className="font-semibold text-blue-700">¥{weighted.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">経費合計</span>
                  <span className="font-semibold text-orange-600">− ¥{totalExp.toLocaleString()}</span>
                </div>
                {grossProfit != null && (
                  <div className="flex justify-between text-sm pt-2 border-t border-zinc-100">
                    <span className="font-semibold text-zinc-700">粗利（想定）</span>
                    <span className={`font-bold text-base ${grossProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      ¥{grossProfit.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })()}
      </div>

      {/* ToDoリスト */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-zinc-800">
            ToDo <span className="text-zinc-400 font-normal text-sm">({tasks?.length ?? 0})</span>
          </h2>
          <Link href={`/tasks/new?opportunity_id=${id}`} className="text-xs text-blue-600 hover:text-blue-800">＋ 追加</Link>
        </div>
        {tasks && tasks.length > 0 ? (
          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100">
            {tasks.map((t) => {
              const priority = PRIORITY_CONFIG[t.priority] ?? PRIORITY_CONFIG.medium
              const isOverdue = !t.done && t.due_date && new Date(t.due_date) < new Date()
              return (
                <div key={t.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 ${t.done ? 'opacity-60' : ''}`}>
                  <form action={toggleTask} className="shrink-0">
                    <input type="hidden" name="task_id" value={t.id} />
                    <input type="hidden" name="done" value={(!t.done).toString()} />
                    <button
                      type="submit"
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                        ${t.done ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-300 hover:border-blue-400'}`}
                    >
                      {t.done && <span className="text-xs leading-none">✓</span>}
                    </button>
                  </form>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/tasks/${t.id}`} className={`text-sm hover:text-blue-600 ${t.done ? 'line-through text-zinc-400' : 'text-zinc-900 font-medium'}`}>
                        {t.title}
                      </Link>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priority.color}`}>{priority.label}</span>
                    </div>
                    {t.due_date && (
                      <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-500' : 'text-zinc-400'}`}>
                        📅 {new Date(t.due_date).toLocaleDateString('ja-JP')}{isOverdue && ' (期限超過)'}
                      </p>
                    )}
                  </div>
                  <Link href={`/tasks/${t.id}/edit`} className="text-xs text-zinc-400 hover:text-zinc-700 shrink-0">編集</Link>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-zinc-400 bg-white border border-zinc-200 rounded-lg px-4 py-6 text-center">ToDoがありません</p>
        )}
      </section>

      {/* 経費 */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-zinc-800">
            経費 <span className="text-zinc-400 font-normal text-sm">({expenses?.length ?? 0})</span>
          </h2>
          <Link href={`/expenses/new?opportunity_id=${id}`} className="text-xs text-blue-600 hover:text-blue-800">＋ 追加</Link>
        </div>
        {expenses && expenses.length > 0 ? (
          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100">
            {expenses.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50">
                <div className="flex-1 min-w-0">
                  <Link href={`/expenses/${e.id}`} className="text-sm font-medium text-zinc-800 hover:text-blue-600 block truncate">
                    {e.title}
                  </Link>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {e.category} · {e.expense_date}
                  </p>
                </div>
                <span className="text-sm font-semibold text-orange-600 shrink-0">
                  ¥{Number(e.amount).toLocaleString()}
                </span>
              </div>
            ))}
            <div className="px-4 py-2 bg-zinc-50 flex justify-between items-center">
              <span className="text-xs font-semibold text-zinc-500">合計</span>
              <span className="text-sm font-bold text-orange-700">
                ¥{(expenses.reduce((s, e) => s + Number(e.amount), 0)).toLocaleString()}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-400 bg-white border border-zinc-200 rounded-lg px-4 py-6 text-center">経費がありません</p>
        )}
      </section>

      {/* 活動履歴 */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-zinc-800">
            活動履歴 <span className="text-zinc-400 font-normal text-sm">({activities?.length ?? 0})</span>
          </h2>
          <Link href={`/activities/new?opportunity_id=${id}`} className="text-xs text-blue-600 hover:text-blue-800">＋ 追加</Link>
        </div>
        {activities && activities.length > 0 ? (
          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100">
            {activities.map((a) => (
              <div key={a.id} className="px-4 py-3 hover:bg-zinc-50">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-zinc-400">{ACTIVITY_TYPE_LABELS[a.type] ?? a.type}</span>
                  <span className="text-xs text-zinc-400">•</span>
                  <span className="text-xs text-zinc-400">{new Date(a.occurred_at).toLocaleDateString('ja-JP')}</span>
                </div>
                <Link href={`/activities/${a.id}`} className="text-sm font-medium text-zinc-800 hover:text-blue-600">
                  {a.subject}
                </Link>
                {a.body && <p className="text-xs text-zinc-500 mt-1">{a.body}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-400 bg-white border border-zinc-200 rounded-lg px-4 py-6 text-center">活動履歴がありません</p>
        )}
      </section>

      {/* 添付ファイル */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-zinc-800">
            添付ファイル <span className="text-zinc-400 font-normal text-sm">({attachments?.length ?? 0})</span>
          </h2>
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          {attachments && attachments.length > 0 && (
            <div className="divide-y divide-zinc-100">
              {attachments.map((f) => (
                <div key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50">
                  <span className="text-xl shrink-0">📄</span>
                  <div className="flex-1 min-w-0">
                    <a
                      href={`${supabaseUrl}/storage/v1/object/public/attachments/${f.storage_path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:underline truncate block"
                    >
                      {f.file_name}
                    </a>
                    <p className="text-xs text-zinc-400">
                      {formatFileSize(f.file_size)} · {new Date(f.created_at).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                  <form action={deleteFile}>
                    <input type="hidden" name="attach_id" value={f.id} />
                    <input type="hidden" name="storage_path" value={f.storage_path} />
                    <button type="submit" className="text-xs text-red-400 hover:text-red-600 shrink-0">削除</button>
                  </form>
                </div>
              ))}
            </div>
          )}
          <form action={uploadFile} className="px-4 py-3 border-t border-zinc-100 flex items-center gap-3">
            <input
              type="file"
              name="file"
              className="flex-1 text-sm text-zinc-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors shrink-0"
            >
              アップロード
            </button>
          </form>
        </div>
      </section>

      {/* タグ */}
      <section className="mb-6">
        <h2 className="text-base font-semibold text-zinc-800 mb-3">タグ</h2>
        <div className="bg-white border border-zinc-200 rounded-lg px-4 py-3">
          <TagsSection objectType="opportunity" objectId={id} revalidatePath={`/opportunities/${id}`} />
        </div>
      </section>

      {/* 変更履歴 */}
      <section className="mb-6">
        <h2 className="text-base font-semibold text-zinc-800 mb-3">変更履歴</h2>
        <div className="bg-white border border-zinc-200 rounded-lg px-4 py-2">
          <ChangeLogSection objectType="opportunity" objectId={id} />
        </div>
      </section>
    </div>
  )
}
