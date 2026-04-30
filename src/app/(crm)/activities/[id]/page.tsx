import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deleteActivity } from '@/app/actions/activities'
import DeleteButton from '@/components/DeleteButton'

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  call:    { label: '電話',   icon: '📞', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  email:   { label: 'メール', icon: '✉️', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  meeting: { label: '打合せ', icon: '🤝', color: 'bg-green-50 text-green-700 border-green-200' },
  note:    { label: 'メモ',   icon: '📝', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
}

export default async function ActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [{ data: activity }, { data: activityContacts }] = await Promise.all([
    supabase
      .from('activities')
      .select('*, accounts(id, name), opportunities(id, name)')
      .eq('id', id)
      .single(),
    supabase
      .from('activity_contacts')
      .select('contact_id, contacts(id, full_name)')
      .eq('activity_id', id),
  ])

  if (!activity) notFound()

  async function handleDelete() {
    'use server'
    await deleteActivity(id)
  }

  const account     = activity.accounts     as unknown as { id: string; name: string } | null
  const opportunity = activity.opportunities as unknown as { id: string; name: string } | null
  const linkedContacts = (activityContacts ?? []).map(
    (ac) => (ac.contacts as unknown as { id: string; full_name: string } | null)
  ).filter(Boolean) as { id: string; full_name: string }[]
  const typeConf    = TYPE_CONFIG[activity.type] ?? { label: activity.type, icon: '📋', color: 'bg-zinc-50 text-zinc-600 border-zinc-200' }

  return (
    <div className="p-8 max-w-2xl">
      {/* パンくず */}
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/activities" className="hover:text-zinc-600">活動履歴</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700 line-clamp-1">{activity.subject}</span>
      </div>

      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-sm font-medium ${typeConf.color}`}>
              {typeConf.icon} {typeConf.label}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">{activity.subject}</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {new Date(activity.occurred_at).toLocaleString('ja-JP', {
              year: 'numeric', month: 'long', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/activities/${id}/edit`}
            className="px-4 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors"
          >
            編集
          </Link>
          <DeleteButton
            action={handleDelete}
            confirmMessage="この活動履歴を削除しますか？"
          />
        </div>
      </div>

      {/* 内容 */}
      <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">内容</h2>
        <p className="text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed min-h-[3rem]">
          {activity.body ?? <span className="text-zinc-300">—</span>}
        </p>
      </div>

      {/* 関連情報 */}
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">関連情報</h2>
        <dl className="grid grid-cols-2 gap-4">
          {account && (
            <div>
              <dt className="text-xs text-zinc-400 mb-1">取引先</dt>
              <dd className="text-sm">
                <Link href={`/accounts/${account.id}`} className="text-blue-600 hover:underline">
                  🏢 {account.name}
                </Link>
              </dd>
            </div>
          )}
          {linkedContacts.length > 0 && (
            <div className="col-span-2">
              <dt className="text-xs text-zinc-400 mb-1">担当者</dt>
              <dd className="flex flex-wrap gap-2 mt-1">
                {linkedContacts.map((c) => (
                  <Link key={c.id} href={`/contacts/${c.id}`} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                    👤 {c.full_name}
                  </Link>
                ))}
              </dd>
            </div>
          )}
          {opportunity && (
            <div>
              <dt className="text-xs text-zinc-400 mb-1">商談</dt>
              <dd className="text-sm">
                <Link href={`/opportunities/${opportunity.id}`} className="text-blue-600 hover:underline">
                  💼 {opportunity.name}
                </Link>
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-zinc-400 mb-1">登録日</dt>
            <dd className="text-sm text-zinc-800">{new Date(activity.created_at).toLocaleDateString('ja-JP')}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
