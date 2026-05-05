import { db } from '@/lib/db'
import { tasks, accounts, contacts, opportunities } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { buildCsv } from '@/lib/csvUtils'

export async function GET() {
  try {
    const data = await db.select({
      id:            tasks.id,
      title:         tasks.title,
      due_date:      tasks.due_date,
      priority:      tasks.priority,
      done:          tasks.done,
      accounts:      { name: accounts.name },
      contacts:      { full_name: contacts.full_name },
      opportunities: { name: opportunities.name },
    })
      .from(tasks)
      .leftJoin(accounts,      eq(tasks.account_id,     accounts.id))
      .leftJoin(contacts,      eq(tasks.contact_id,     contacts.id))
      .leftJoin(opportunities, eq(tasks.opportunity_id, opportunities.id))
      .orderBy(asc(tasks.done), asc(tasks.due_date))

    const PRIORITY_LABEL: Record<string, string> = { high: '高', medium: '中', low: '低' }

    const headers = ['ID', 'タイトル', '期日', '優先度', '完了', '取引先名', '担当者名', '商談名']
    const rows = data.map((r) => [
      r.id,
      r.title,
      r.due_date ?? '',
      PRIORITY_LABEL[r.priority] ?? r.priority,
      r.done ? '完了' : '未完了',
      r.accounts?.name      ?? '',
      r.contacts?.full_name ?? '',
      r.opportunities?.name ?? '',
    ])

    return new NextResponse(buildCsv(headers, rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="tasks.csv"',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
