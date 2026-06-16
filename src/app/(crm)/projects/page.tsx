/**
 * /projects 一覧 — projects（プロジェクト管理）モジュール（REQ-0080）
 */
import { notFound } from 'next/navigation'
import { isModuleEnabled } from '@/lib/modules/registry'
import { db } from '@/lib/db'
import { accounts, projects } from '@/lib/schema'
import { desc, eq } from 'drizzle-orm'
import Link from 'next/link'
import ListViewToolbar from '@/components/ListViewToolbar'
import { type FieldDef } from '@/components/FilterBuilder'
import { parseFilterParams, applyFilters } from '@/lib/filterUtils'
import { parseSortParams, applySort } from '@/lib/sortUtils'
import Pagination from '@/components/Pagination'
import { canEdit } from '@/lib/auth'
import { requireBookRead } from '@/lib/permissions'
import { NavIcon } from '@/lib/navIcon'
import { PROJECT_STAGES, PROJECT_TYPES } from '@/lib/statusStages'

const PAGE_SIZE = 20
const STATUS_VALUES = PROJECT_STAGES.map((s) => s.value)
const STATUS_COLOR: Record<string, string> = {
  企画: 'bg-zinc-100 text-zinc-700', 計画: 'bg-sky-100 text-sky-700', 進行中: 'bg-amber-100 text-amber-700',
  完了: 'bg-emerald-100 text-emerald-700', 保留: 'bg-violet-100 text-violet-700', 中止: 'bg-rose-100 text-rose-700',
}

export default async function ProjectsListPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; page?: string; sort?: string }>
}) {
  await requireBookRead('projects')  // RBAC: Read 権限ガード（ADR-0023）
  if (!(await isModuleEnabled('projects'))) notFound()

  const [sp, edit] = await Promise.all([searchParams, canEdit()])
  const filterRaw = [sp.f].flat().filter(Boolean) as string[]
  const page      = Math.max(1, parseInt(sp.page ?? '1', 10))
  const sortRaw   = sp.sort ?? ''

  const raw = await db.select({
    id: projects.id, name: projects.name, status: projects.status, project_type: projects.project_type,
    location: projects.location, end_date: projects.end_date,
    budget: projects.budget, expected_revenue: projects.expected_revenue,
    account_name: accounts.name,
  })
    .from(projects)
    .leftJoin(accounts, eq(projects.account_id, accounts.id))
    .orderBy(desc(projects.created_at))

  const conditions  = parseFilterParams(filterRaw)
  const list        = applyFilters(raw as Record<string, unknown>[], conditions)
  const sorted      = applySort(list as Record<string, unknown>[], parseSortParams(sortRaw))
  const hasFilter   = conditions.length > 0
  const totalCount  = sorted.length
  const totalPages  = Math.ceil(totalCount / PAGE_SIZE)
  const displayList = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) as typeof raw

  const FIELDS: FieldDef[] = [
    { value: 'name',     label: 'プロジェクト名', type: 'text' },
    { value: 'status',   label: 'ステータス', type: 'select', options: STATUS_VALUES.map((s) => ({ value: s, label: s })) },
    { value: 'project_type', label: '種別', type: 'select', options: PROJECT_TYPES.map((t) => ({ value: t, label: t })) },
    { value: 'location', label: '所在地', type: 'text' },
    { value: 'end_date', label: '完了予定日', type: 'date' },
    { value: 'budget',   label: '予算', type: 'number' },
    { value: 'expected_revenue', label: '想定売上', type: 'number' },
  ]

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2"><NavIcon icon="🏗️" className="w-6 h-6" />プロジェクト</h1>
          <p className="text-sm text-zinc-500 mt-1">
            全 {totalCount} 件{hasFilter && <span className="ml-1 text-blue-600">（絞り込み中）</span>}
          </p>
        </div>
        {edit && (
          <Link href="/projects/new" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors">
            ＋ 新規追加
          </Link>
        )}
      </div>

      <ListViewToolbar fields={FIELDS} initialFilters={filterRaw} basePath="/projects" groupableFields={[]} initialGroup="" />

      {totalCount === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <div className="flex justify-center mb-4"><NavIcon icon="🏗️" className="w-12 h-12 text-zinc-300" /></div>
          <p className="text-lg font-medium">{hasFilter ? '条件に一致するプロジェクトがありません' : 'プロジェクトがまだ登録されていません'}</p>
          {hasFilter
            ? <Link href="/projects" className="text-sm text-blue-600 hover:underline mt-1 block">絞り込みをクリア</Link>
            : <p className="text-sm mt-1">「新規追加」ボタンから登録してください</p>}
        </div>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 text-left text-xs text-zinc-500">
                  <th className="px-4 py-2.5 font-medium">プロジェクト名</th>
                  <th className="px-4 py-2.5 font-medium">ステータス</th>
                  <th className="px-4 py-2.5 font-medium">種別</th>
                  <th className="px-4 py-2.5 font-medium">関連取引先</th>
                  <th className="px-4 py-2.5 font-medium">完了予定</th>
                  <th className="px-4 py-2.5 font-medium text-right">想定売上</th>
                </tr>
              </thead>
              <tbody>
                {displayList.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50 border-t border-zinc-100">
                    <td className="px-4 py-2.5 font-semibold text-zinc-900"><Link href={`/projects/${p.id}`} className="hover:text-brand-700">{p.name}</Link></td>
                    <td className="px-4 py-2.5"><span className={`inline-block px-2 py-0.5 text-xs rounded ${STATUS_COLOR[p.status] ?? 'bg-zinc-100 text-zinc-700'}`}>{p.status}</span></td>
                    <td className="px-4 py-2.5 text-zinc-600">{p.project_type ?? '—'}</td>
                    <td className="px-4 py-2.5 text-zinc-600">{p.account_name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-zinc-600">{p.end_date ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700">{p.expected_revenue ? `¥${Number(p.expected_revenue).toLocaleString()}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-2">
            {displayList.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="block bg-white rounded-lg border border-zinc-200 px-4 py-3 hover:border-zinc-300 active:bg-zinc-50">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-zinc-900 text-sm leading-snug">{p.name}</span>
                  <span className={`shrink-0 inline-block px-2 py-0.5 text-xs rounded ${STATUS_COLOR[p.status] ?? 'bg-zinc-100 text-zinc-700'}`}>{p.status}</span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-zinc-500">
                  {p.project_type && <span>{p.project_type}</span>}
                  {p.account_name && <span>{p.account_name}</span>}
                  {p.end_date && <span>完了予定 {p.end_date}</span>}
                </div>
              </Link>
            ))}
          </div>

          <Pagination currentPage={page} totalPages={totalPages} basePath="/projects" filterParams={filterRaw} />
        </>
      )}
    </div>
  )
}
