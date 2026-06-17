import { db } from '@/lib/db'
import { expenses, accounts, opportunities, expense_related_records } from '@/lib/schema'
import { eq, desc, inArray, and } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { buildCsv } from '@/lib/csvUtils'
import { requireApiBookRead } from '@/lib/apiAuth'
import { parseFilterParams, applyFilters } from '@/lib/filterUtils'

export async function GET(request: Request) {
  // 認証＋ブック Read 権限＋外部ユーザー遮断（経費は owner_id 無しのためレコードスコープは非対象）
  const auth = await requireApiBookRead('expenses')
  if (auth instanceof NextResponse) return auth

  // エクスポートのフィルタ指定（REQ-0052）: 一覧と同じ f パラメータ
  const filterRaw = new URL(request.url).searchParams.getAll('f')
  const conditions = parseFilterParams(filterRaw)

  try {
    const data = await db.select({
      id:           expenses.id,
      title:        expenses.title,
      amount:       expenses.amount,
      category:     expenses.category,
      expense_date: expenses.expense_date,
      notes:        expenses.notes,
    })
      .from(expenses)
      .orderBy(desc(expenses.expense_date))

    const filtered = conditions.length > 0
      ? (applyFilters(data as unknown as Record<string, unknown>[], conditions) as unknown as typeof data)
      : data

    const ids = filtered.map((d) => d.id)
    const [accRows, oppRows] = await Promise.all([
      ids.length === 0 ? Promise.resolve([]) : db.select({
        host_id: expense_related_records.expense_id,
        name:    accounts.name,
      })
        .from(expense_related_records)
        .innerJoin(accounts, eq(accounts.id, expense_related_records.related_record_id))
        .where(and(inArray(expense_related_records.expense_id, ids), eq(expense_related_records.related_object_api, 'account'))),
      ids.length === 0 ? Promise.resolve([]) : db.select({
        host_id: expense_related_records.expense_id,
        name:    opportunities.name,
      })
        .from(expense_related_records)
        .innerJoin(opportunities, eq(opportunities.id, expense_related_records.related_record_id))
        .where(and(inArray(expense_related_records.expense_id, ids), eq(expense_related_records.related_object_api, 'opportunity'))),
    ])

    const namesByApi = (rows: Array<{ host_id: string; name: string }>) => {
      const m = new Map<string, string[]>()
      for (const r of rows) {
        if (!m.has(r.host_id)) m.set(r.host_id, [])
        m.get(r.host_id)!.push(r.name)
      }
      return m
    }
    const accNamesById = namesByApi(accRows)
    const oppNamesById = namesByApi(oppRows)

    const headers = ['ID', '件名', '金額', 'カテゴリ', '日付', '取引先名', '商談名', '備考']
    const rows = filtered.map((r) => [
      r.id,
      r.title,
      r.amount,
      r.category,
      r.expense_date ?? '',
      (accNamesById.get(r.id) ?? []).join(', '),
      (oppNamesById.get(r.id) ?? []).join(', '),
      r.notes ?? '',
    ])

    return new NextResponse(buildCsv(headers, rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="expenses.csv"',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
