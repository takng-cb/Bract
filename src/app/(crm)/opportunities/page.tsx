import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import FilterBuilder, { type FieldDef } from '@/components/FilterBuilder'
import { parseFilterParams, applyFilters, splitTagConditions, applyTagFilter } from '@/lib/filterUtils'
import CsvToolbar from '@/components/CsvToolbar'

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
  searchParams: Promise<{ f?: string | string[] }>
}) {
  const sp = await searchParams
  const filterRaw  = [sp.f].flat().filter(Boolean) as string[]
  const conditions = parseFilterParams(filterRaw)
  const { tagConditions, otherConditions } = splitTagConditions(conditions)

  const [{ data: raw, error }, { data: tags }, { data: taggables }] = await Promise.all([
    supabase
      .from('opportunities')
      .select('id, name, stage, amount, probability, close_date, account_id, accounts(id, name)')
      .order('created_at', { ascending: false }),
    supabase.from('tags').select('id, name, color').order('name'),
    tagConditions.length > 0
      ? supabase.from('taggables').select('tag_id, object_id').eq('object_type', 'opportunity')
      : Promise.resolve({ data: [] }),
  ])

  if (error) {
    return <div className="p-8 text-red-600">データの取得に失敗しました: {error.message}</div>
  }

  const taggedIdsByTagId = new Map<string, Set<string>>()
  for (const t of taggables ?? []) {
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
      options: (tags ?? []).map((t) => ({ value: t.id, label: t.name })),
    },
  ]

  let opportunities = applyFilters(raw as Record<string, unknown>[], otherConditions)
  opportunities     = applyTagFilter(opportunities, tagConditions, taggedIdsByTagId)
  const hasFilter   = conditions.length > 0

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">商談</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {opportunities.length} 件{hasFilter && <span className="ml-1 text-blue-600">（絞り込み中）</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CsvToolbar
            exportUrl="/api/export/opportunities"
            importUrl="/api/import/opportunities"
            label="商談"
          />
          <Link
            href="/opportunities/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            ＋ 新規作成
          </Link>
        </div>
      </div>

      <FilterBuilder
        fields={FIELDS}
        initialFilters={filterRaw}
        basePath="/opportunities"
      />

      {opportunities.length === 0 ? (
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
        <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
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
              {(opportunities as typeof raw).map((o) => {
                const stageConf = STAGE_LABELS[o.stage] ?? { label: o.stage, color: 'bg-zinc-100 text-zinc-600' }
                const account   = o.accounts as unknown as { id: string; name: string } | null
                return (
                  <tr key={o.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      <Link href={`/opportunities/${o.id}`} className="hover:text-blue-600">{o.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {account
                        ? <Link href={`/accounts/${account.id}`} className="hover:text-blue-600">{account.name}</Link>
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stageConf.color}`}>
                        {stageConf.label}
                      </span>
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
      )}
    </div>
  )
}
