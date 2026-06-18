/**
 * /portal/[objectApi]/[recordId] — 共有レコードの読み取り専用詳細（REQ-0084・Phase2）。
 * grant を必ず検証（無ければ notFound）。編集導線は一切無し。
 */
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getSupabaseUser } from '@/lib/auth'
import { userHasGrant } from '@/lib/recordGrants'
import { getPortalRecord } from '@/lib/portalRecord'
import RecordComments from '@/components/record/RecordComments'
import PortalAttachments from '@/components/record/PortalAttachments'

export default async function PortalRecordPage({
  params,
}: {
  params: Promise<{ objectApi: string; recordId: string }>
}) {
  const { objectApi, recordId } = await params
  const user = await getSupabaseUser()
  if (!user) redirect('/login')

  // セキュリティ: 自分宛ての有効な grant が無ければ存在を隠す（404）
  if (!(await userHasGrant(objectApi, recordId, user.id))) notFound()

  const record = await getPortalRecord(objectApi, recordId)
  if (!record) notFound()

  return (
    <div className="space-y-5">
      <Link href="/portal" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800">
        <ArrowLeft className="h-4 w-4" aria-hidden /> 共有一覧へ
      </Link>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <span aria-hidden className="text-2xl">{record.icon}</span>
          <div className="min-w-0">
            <p className="text-xs text-zinc-400">{record.typeLabel}</p>
            <h1 className="truncate text-lg font-bold text-zinc-900">{record.title}</h1>
          </div>
        </div>

        <dl className="divide-y divide-zinc-100">
          {record.fields.map((f) => (
            <div key={f.label} className="flex items-start gap-4 py-2.5">
              <dt className="w-28 shrink-0 text-sm text-zinc-500">{f.label}</dt>
              <dd className="min-w-0 flex-1 text-sm text-zinc-800">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="text-center text-xs text-zinc-400">基本情報は閲覧専用です。コメント・ファイルは追加できます。</p>

      <PortalAttachments objectApi={objectApi} recordId={recordId} revalidatePath={`/portal/${objectApi}/${recordId}`} />
      <RecordComments objectApi={objectApi} recordId={recordId} revalidatePath={`/portal/${objectApi}/${recordId}`} />
    </div>
  )
}
