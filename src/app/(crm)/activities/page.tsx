import { db } from '@/lib/db'
import { activities, accounts } from '@/lib/schema'
import { desc, eq } from 'drizzle-orm'
import Link from 'next/link'
import ListViewToolbar from '@/components/ListViewToolbar'
import { type FieldDef } from '@/components/FilterBuilder'
import { parseFilterParams, applyFilters } from '@/lib/filterUtils'
import CsvToolbar from '@/components/CsvToolbar'
import Pagination from '@/components/Pagination'
import { canEdit } from '@/lib/auth'
import { getListViewColumns } from '@/lib/listViewSettings'
import ActivitiesTableView from '@/components/tableviews/ActivitiesTableView'

const PAGE_SIZE = 20

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  call:    { label: '電話',   icon: '📞', color: 'bg-blue-50 text-blue-700' },
  email:   { label: 'メール', icon: '✉️', color: 'bg-purple-50 text-purple-700' },
  meeting: { label: '打合せ', icon: '🤝', color: 'bg-green-50 text-green-700' },
  note:    { label: 'メモ',   icon: '📝', color: 'bg-yellow-50 text-yellow-700' },
}

const FIELDS: FieldDef[] = [
  { value: 'subject',       label: '件名',    type: 'text' },
  { value: 'body',          label: '内容',    type: 'text' },
  { value: 'accounts.name', label: '取引先',  type: 'text' },
  {
    value: 'type', label: '種別', type: 'select',
    options: [
      { value: 'call',    label: '📞 電話' },
      { value: 'email',   label: '✉️ メール' },
      { value: 'meeting', label: '🤝 打合せ' },
      { value: 'note',    label: '📝 メモ' },
    ],
  },
  { value: 'occurred_at', label: '実施日', type: 'date' },
]

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; page?: string; group?: string }>
}) {
  const [sp, edit, colConfig] = await Promise.all([searchParams, canEdit(), getListViewColumns('activities')])
  const filterRaw  = [sp.f].flat().filter(Boolean) as string[]
  const page       = Math.max(1, parseInt(sp.page ?? '1', 10))
  const groupBy    = (sp.group ?? '').split(',').filter(Boolean)
  const isGrouped  = groupBy.length > 0
  const conditions = parseFilterParams(filterRaw)

  const raw = await db.select({
    id:          activities.id,
    type:        activities.type,
    subject:     activities.subject,
    body:        activities.body,
    occurred_at: activities.occurred_at,
    account_id:  activities.account_id,
    accounts: {
      id:   accounts.id,
      name: accounts.name,
    },
  })
    .from(activities)
    .leftJoin(accounts, eq(activities.account_id, accounts.id))
    .orderBy(desc(activities.occurred_at))

  const activitiesList = applyFilters(raw as Record<string, unknown>[], conditions)
  const hasFilter      = conditions.length > 0
  const totalCount     = activitiesList.length
  const totalPages     = isGrouped ? 1 : Math.ceil(totalCount / PAGE_SIZE)
  const displayList    = isGrouped
    ? activitiesList
    : activitiesList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const groupableFields = FIELDS.map((f) => ({ key: f.value, label: f.label }))

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">活動履歴</h1>
          <p className="text-sm text-zinc-500 mt-1">
            全 {totalCount} 件{hasFilter && <span className="ml-1 text-blue-600">（絞り込み中）</span>}
            {isGrouped && <span className="ml-1 text-violet-600">（グルーピング中）</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CsvToolbar
            exportUrl="/api/export/activities"
            importUrl="/api/import/activities"
            label="活動履歴"
            csvFormat="ID,実施日時,種別,件名,内容,取引先名,担当者名,商談名"
            fieldOptions={{
              '種別': ['電話', 'メール', '打ち合わせ', 'メモ'],
            }}
            showImport={edit}
          />
          {edit && (
            <Link
              href="/activities/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              ＋ 新規作成
            </Link>
          )}
        </div>
      </div>

      <ListViewToolbar
        fields={FIELDS}
        initialFilters={filterRaw}
        basePath="/activities"
        groupableFields={groupableFields}
        initialGroup={sp.group ?? ''}
      />

      {activitiesList.length === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <p className="text-4xl mb-4">📋</p>
          <p className="text-lg font-medium">
            {hasFilter ? '条件に一致する活動履歴がありません' : '活動履歴がまだありません'}
          </p>
          {hasFilter
            ? <Link href="/activities" className="text-sm text-blue-600 hover:underline mt-1 block">絞り込みをクリア</Link>
            : <p className="text-sm mt-1">「新規作成」ボタンから追加してください</p>
          }
        </div>
      ) : (
        <>
          {/* PC: 動的テーブル（グルーピング対応） */}
          <div className="hidden md:block">
            <ActivitiesTableView
              records={displayList}
              groupBy={groupBy}
              fields={FIELDS}
              activeKeys={colConfig}
            />
          </div>
          {/* モバイル: カード（グルーピング非対応） */}
          {!isGrouped && (
            <div className="md:hidden space-y-2">
              {(displayList as typeof raw).map((a) => {
                const type    = TYPE_CONFIG[a.type] ?? { label: a.type, icon: '📋', color: 'bg-zinc-50 text-zinc-600' }
                const account = a.accounts?.id ? a.accounts : null
                return (
                  <Link key={a.id} href={`/activities/${a.id}`} className="block bg-white rounded-lg border border-zinc-200 px-4 py-3 hover:border-zinc-300 active:bg-zinc-50">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${type.color}`}>{type.icon} {type.label}</span>
                      <span className="text-xs text-zinc-400">
                        {a.occurred_at ? new Date(a.occurred_at).toLocaleDateString('ja-JP') : '—'}
                      </span>
                    </div>
                    <p className="font-medium text-zinc-900 text-sm mt-1.5 leading-snug">{a.subject}</p>
                    {a.body && <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{a.body}</p>}
                    {account && <p className="text-xs text-zinc-500 mt-1">🏢 {account.name}</p>}
                  </Link>
                )
              })}
            </div>
          )}
        </>
      )}

      {!isGrouped && (
        <Pagination currentPage={page} totalPages={totalPages} basePath="/activities" filterParams={filterRaw} />
      )}
    </div>
  )
}
