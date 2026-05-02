import { db } from '@/lib/db'
import { expenses, accounts, opportunities } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { buildCsv } from '@/lib/csvUtils'

export async function GET() {
  try {
    const data = await db.select({
      title:         expenses.title,
      amount:        expenses.amount,
      category:      expenses.category,
      expense_date:  expenses.expense_date,
      notes:         expenses.notes,
      accounts:      { name: accounts.name },
      opportunities: { name: opportunities.name },
    })
      .from(expenses)
      .leftJoin(accounts,      eq(expenses.account_id,     accounts.id))
      .leftJoin(opportunities, eq(expenses.opportunity_id, opportunities.id))
      .orderBy(desc(expenses.expense_date))

    const headers = ['件名', '金額', 'カテゴリ', '日付', '取引先名', '商談名', '備考']
    const rows = data.map((r) => [
      r.title,
      r.amount,
      r.category,
      r.expense_date ?? '',
      r.accounts?.name      ?? '',
      r.opportunities?.name ?? '',
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
