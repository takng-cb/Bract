import { db } from '@/lib/db'
import { expenses, accounts, opportunities } from '@/lib/schema'
import { desc, eq, gte, lte } from 'drizzle-orm'
import Link from 'next/link'
import FilterBuilder, { type FieldDef } from '@/components/FilterBuilder'
import { parseFilterParams, applyFilters } from '@/lib/filterUtils'

const CATEGORY_COLORS: Record<string, string> = {
  交通費:   'bg-blue-50 text-blue-700',
  接待費:   'bg-purple-50 text-purple-700',
  通信費:   'bg-cyan-50 text-cyan-700',
  消耗品費: 'bg-yellow-50 text-yellow-700',
  広告費:   'bg-orange-50 text-orange-700',
  外注費:   'bg-red-50 text-red-700',
  その他:   'bg-zinc-100 text-zinc-600',
}

const FIELDS: FieldDef[] = [
  { value: 'title',               label: '件名',    type: 'text' },
  { value: 'accounts.name',       label: '取引先',  type: 'text' },
  { value: 'opportunities.name',  label: '商談',    type: 'text' },
  {
    value: 'category', label: 'カテゴリ', type: 'select',
    options: [
      { value: '交通費',   label: '交通費' },
      { value: '接待費',   label: '接待費' },
      { value: '通信費',   label: '通信費' },
      { value: '消耗品費', label: '消耗品費' },
      { value: '広告費',   label: '広告費' },
      { value: '外注費',   label: '外注費' },
      { value: 'その他',   label: 'その他' },
    ],
  },
  { value: 'amount',       label: '金額（円）', type: 'number' },
  { value: 'expense_date', label: '日付',       type: 'date' },
]

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ from_year?: string; from_month?: string; to_year?: string; to_month?: string; f?: string | string[] }>
}) {
  const sp  = await searchParams
  const now = new Date()

  const fromYear  = Number(sp.from_year  ?? now.getFullYear())
  const fromMonth = Number(sp.from_month ?? now.getMonth() + 1)
  const toYear    = Number(sp.to_year    ?? now.getFullYear())
  const toMonth   = Number(sp.to_month   ?? now.getMonth() + 1)

  const from = `${fromYear}-${String(fromMonth).padStart(2, '0')}-01`
  const to   = new Date(toYear, toMonth, 0).toISOString().slice(0, 10)

  const filterRaw  = [sp.f].flat().filter(Boolean) as string[]
  const conditions = parseFilterParams(filterRaw)

  const raw = await db.select({
    id:           expenses.id,
    title:        expenses.title,
    amount:       expenses.amount,
    category:     expenses.category,
    expense_date: expenses.expense_date,
    accounts: {
      id:   accounts.id,
      name: accounts.name,
    },
    opportunities: {
      id:   opportunities.id,
      name: opportunities.name,
    },
  })
    .from(expenses)
    .leftJoin(accounts, eq(expenses.account_id, accounts.id))
    .leftJoin(opportunities, eq(expenses.opportunity_id, opportunities.id))
    .where(gte(expenses.expense_date, from))
    .orderBy(desc(expenses.expense_date))

  // to の日付フィルタは JS 側で適用（lte は同じ型で比較）
  const filtered = raw.filter((e) => e.expense_date! <= to)

  const expensesList = applyFilters(filtered as Record<string, unknown>[], conditions) as typeof raw
  const total        = expensesList.reduce((s, e) => s + Number(e.amount), 0)
  const hasFilter    = conditions.length > 0

  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1)
  const yearOptions  = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)

  const periodLabel = fromYear === toYear && fromMonth === toMonth
    ? `${fromYear}年${fromMonth}月`
    : `${fromYear}年${fromMonth}月 〜 ${toYear}年${toMonth}月`

  const persistParams = {
    from_year: String(fromYear), from_month: String(fromMonth),
    to_year: String(toYear),     to_month: String(toMonth),
  }
  const clearUrl = `/expenses?${new URLSearchParams(persistParams).toString()}`

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">経費管理</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {periodLabel} — {expensesList.length} 件 合計{' '}
            <span className="font-semibold text-zinc-800">¥{total.toLocaleString()}</span>
            {hasFilter && <span className="ml-1 text-blue-600">（絞り込み中）</span>}
          </p>
        </div>
        <Link
          href="/expenses/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          ＋ 新規作成
        </Link>
      </div>

      {/* 期間セレクター */}
      <form method="get" className="flex items-center gap-2 mb-3 bg-white border border-zinc-200 rounded-lg px-4 py-3">
        {filterRaw.map((v, i) => (
          <input key={i} type="hidden" name="f" value={v} />
        ))}
        <span className="text-sm text-zinc-500 shrink-0">期間</span>
        <select name="from_year" defaultValue={fromYear}
          className="border border-zinc-300 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          {yearOptions.map((y) => <option key={y} value={y}>{y}年</option>)}
        </select>
        <select name="from_month" defaultValue={fromMonth}
          className="border border-zinc-300 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          {monthOptions.map((m) => <option key={m} value={m}>{m}月</option>)}
        </select>
        <span className="text-sm text-zinc-400">〜</span>
        <select name="to_year" defaultValue={toYear}
          className="border border-zinc-300 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          {yearOptions.map((y) => <option key={y} value={y}>{y}年</option>)}
        </select>
        <select name="to_month" defaultValue={toMonth}
          className="border border-zinc-300 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          {monthOptions.map((m) => <option key={m} value={m}>{m}月</option>)}
        </select>
        <button type="submit"
          className="px-3 py-1.5 bg-zinc-700 text-white text-sm rounded-md hover:bg-zinc-600 transition-colors shrink-0">
          適用
        </button>
      </form>

      <FilterBuilder
        fields={FIELDS}
        initialFilters={filterRaw}
        basePath="/expenses"
        persistParams={persistParams}
      />

      {expensesList.length === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <p className="text-4xl mb-4">💰</p>
          <p className="text-lg font-medium">
            {hasFilter ? '条件に一致する経費がありません' : 'この期間の経費がありません'}
          </p>
          {hasFilter && (
            <Link href={clearUrl} className="text-sm text-blue-600 hover:underline mt-1 block">絞り込みをクリア</Link>
          )}
          {!hasFilter && (
            <p className="text-sm mt-1">「新規作成」ボタンから追加してください</p>
          )}
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-zinc-600">日付</th>
                <th className="text-left px-4 py-2 font-medium text-zinc-600">件名</th>
                <th className="text-left px-4 py-2 font-medium text-zinc-600">カテゴリ</th>
                <th className="text-right px-4 py-2 font-medium text-zinc-600">金額</th>
                <th className="text-left px-4 py-2 font-medium text-zinc-600">商談</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {expensesList.map((e) => {
                const account     = e.accounts?.id     ? e.accounts     : null
                const opportunity = e.opportunities?.id ? e.opportunities : null
                const catColor    = CATEGORY_COLORS[e.category] ?? CATEGORY_COLORS['その他']
                return (
                  <tr key={e.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-2 text-zinc-500 whitespace-nowrap">{e.expense_date}</td>
                    <td className="px-4 py-2 font-medium">
                      <Link href={`/expenses/${e.id}`} className="hover:text-blue-600">{e.title}</Link>
                      {account && (
                        <div className="text-xs text-zinc-400 mt-0.5">
                          <Link href={`/accounts/${account.id}`} className="hover:text-blue-500">🏢 {account.name}</Link>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColor}`}>{e.category}</span>
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-zinc-800">
                      ¥{Number(e.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-zinc-500 text-xs">
                      {opportunity
                        ? <Link href={`/opportunities/${opportunity.id}`} className="hover:text-blue-600">💼 {opportunity.name}</Link>
                        : '—'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link href={`/expenses/${e.id}`} className="text-blue-600 hover:text-blue-800 text-xs">詳細 →</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t-2 border-zinc-200 bg-zinc-50">
              <tr>
                <td colSpan={3} className="px-4 py-2 text-sm font-semibold text-zinc-700">合計</td>
                <td className="px-4 py-2 text-right font-bold text-zinc-900">¥{total.toLocaleString()}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
