import { db } from '@/lib/db'
import { opportunities, accounts, tags, taggables } from '@/lib/schema'
import { desc, eq } from 'drizzle-orm'
import Link from 'next/link'
import FilterBuilder, { type FieldDef } from '@/components/FilterBuilder'
import { parseFilterParams, applyFilters, splitTagConditions, applyTagFilter } from '@/lib/filterUtils'
import CsvToolbar from '@/components/CsvToolbar'
import Pagination from '@/components/Pagination'
import { canEdit } from '@/lib/auth'

const PAGE_SIZE = 20

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  prospecting:   { label: '見込み',   color: 'bg-zinc-100 text-zinc-600' },
  qualification: { label: '要件確認', color: 'bg-blue-100 text-blue-700' },
  proposal:      { label: '提案',     color: 'bg-yellow-100 text-yellow-700' },
  negotiation:   { label: '交渉',     color: 'bg-orange-100 text-orange-700' },
  closed_won:    { label: '受注',     color: 'bg-green-100 text-green-700' },
  closed_lost:   { label: '失注',     color: 'bg-red-100 text-red-600' },
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; page?: string }>
}) {
  const [sp, edit] = await Promise.all([searchParams, canEdit()])
  const filterRaw  = [sp.f].flat().filter(Boolean) as string[]
  const page = Math.max(1, parseInt(sp.page ?? '1', 10))
  const conditions = parseFilterParams(filterRaw)
  const { tagConditions, otherConditions } = splitTagConditions(conditions)

  const [raw, allTags, taggableRows] = await Promise.all([
    db.select({
      id:          opportunities.id,
      name:        opportunities.name,
      stage:       opportunities.stage,
      amount:      opportunities.amount,
      probability: opportunities.probability,
      close_date:  opportunities.close_date,
      account_id:  opportunities.account_id,
      accounts: {
        id:   accounts.id,
        name: accounts.name,
      },
    })
      .from(opportunities)
      .leftJoin(accounts, eq(opportunities.account_id, accounts.id))
      .orderBy(desc(opportunities.created_at)),
    db.select({ id: tags.id, name: tags.name, color: tags.color }).from(tags).orderBy(tags.name),
    tagConditions.length > 0
      ? db.select({ tag_id: taggables.tag_id, object_id: taggables.object_id })
          .from(taggables).where(eq(taggables.object_type, 'opportunity'))
      : Promise.resolve([]),
  ])

  const taggedIdsByTagId = new Map<string, Set<string>>()
  for (const t of taggableRows) {
    if (!taggedIdsByTagId.has(t.tag_id)) taggedIdsByTagId.set(t.tag_id, new Set())
    taggedIdsByTagId.get(t.tag_id)!.add(t.object_id)
  }

  const FIELDS: FieldDef[] = [
    { value: 'name',          label: '商談名',    type: 'text' },
    { value: 'accounts.name', label: '取引先',    type: 'text' },
    {
      value: 'stage', label: 'ステージ', type: 'select',
      options: [
        { value: 'prospecting',   label: '見込み' },
        { value: 'qualification', label: '要件確認' },
        { value: 'proposal',      label: '提案' },
        { value: 'negotiation',   label: '交渉' },
        { value: 'closed_won',    label: '受注' },
        { value: 'closed_lost',   label: '失注' },
      ],
    },
    { value: 'amount',      label: '金額（円）', type: 'number' },
    { value: 'probability', label: '確度（%）',  type: 'number' },
    { value: 'close_date',  label: '完了予定日', type: 'date' },
    {
      value: 'tag', label: 'タグ', type: 'select',
      options: allTags.map((t) => ({ value: t.id, label: t.name })),
    },
  ]

  let opportunitiesList = applyFilters(raw as Record<string, unknown>[], otherConditions)
  opportunitiesList     = applyTagFilter(opportunitiesList, tagConditions, taggedIdsByTagId)
  const hasFilter       = conditions.length > 0
  const totalCount      = opportunitiesList.length
  const totalPages      = Math.ceil(totalCount / PAGE_SIZE)
  const pagedList       = opportunitiesList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">商談</h1>
          <p className="text-sm text-zinc-500 mt-1">
            全 {totalCount} 件{hasFilter && <span className="ml-1 text-blue-600">（絞り込み中）</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CsvToolbar
            exportUrl="/api/export/opportunities"
            importUrl="/api/import/opportunities"
            label="商談"
            showImport={edit}
          />
          {edit && (
            <Link
              href="/opportunities/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              ＋ 新規作成
            </Link>
          )}
        </div>
      </div>

      <FilterBuilder
        fields={FIELDS}
        initialFilters={filterRaw}
        basePath="/opportunities"
      />

      {totalCount === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <p className="text-4xl mb-4">💼</p>
          <p className="text-lg font-medium">
            {hasFilter ? '条件に一致する商談がありません' : '商談がまだありません'}
          </p>
          {hasFilter
            ? <Link href="/opportunities" className="text-sm text-blue-600 hover:underline mt-1 block">絞り込みをクリア</Link>
            : <p className="text-sm mt-1">「新規作成」ボタンから追加してください</p>
          }
        </div>
      ) : (
        <>
          {/* PC: テーブル */}
          <div className="hidden md:block bg-white rounded-lg border border-zinc-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-zinc-600">商談名</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-600">取引先</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-600">ステージ</th>
                  <th className="text-right px-4 py-3 font-medium text-zinc-600">金額</th>
                  <th className="text-right px-4 py-3 font-medium text-zinc-600">確度</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-600">完了予定日</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(pagedList as typeof raw).map((o) => {
                  const stageConf = STAGE_LABELS[o.stage] ?? { label: o.stage, color: 'bg-zinc-100 text-zinc-600' }
                  const account   = o.accounts?.id ? o.accounts : null
                  return (
                    <tr key={o.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        <Link href={`/opportunities/${o.id}`} className="hover:text-blue-600">{o.name}</Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {account ? <Link href={`/accounts/${account.id}`} className="hover:text-blue-600">{account.name}</Link> : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stageConf.color}`}>{stageConf.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-700 font-medium">
                        {o.amount ? `¥${Number(o.amount).toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-500">
                        {o.probability != null ? `${o.probability}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{o.close_date ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/opportunities/${o.id}`} className="text-blue-600 hover:text-blue-800 text-xs">詳細 →</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {/* モバイル: カード */}
          <div className="md:hidden space-y-2">
            {(pagedList as typeof raw).map((o) => {
              const stageConf = STAGE_LABELS[o.stage] ?? { label: o.stage, color: 'bg-zinc-100 text-zinc-600' }
              const account   = o.accounts?.id ? o.accounts : null
              return (
                <Link key={o.id} href={`/opportunities/${o.id}`} className="block bg-white rounded-lg border border-zinc-200 px-4 py-3 hover:border-zinc-300 active:bg-zinc-50">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-zinc-900 text-sm leading-snug">{o.name}</span>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${stageConf.color}`}>{stageConf.label}</span>
                  </div>
                  {account && <p className="text-xs text-zinc-500 mt-0.5">🏢 {account.name}</p>}
                  <div className="flex items-center justify-between mt-1.5 text-xs text-zinc-500">
                    <span>{o.close_date ? `📅 ${o.close_date}` : '期限なし'}</span>
                    <div className="text-right">
                      {o.amount && <span className="font-semibold text-zinc-800">¥{Number(o.amount).toLocaleString()}</span>}
                      {o.probability != null && <span className="ml-2 text-zinc-400">確度{o.probability}%</span>}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}
      <Pagination currentPage={page} totalPages={totalPages} basePath="/opportunities" filterParams={filterRaw} />
    </div>
  )
}
