import { db } from '@/lib/db'
import { tasks, accounts, contacts, opportunities, task_related_records } from '@/lib/schema'
import { eq, asc, inArray, and } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { buildCsv } from '@/lib/csvUtils'
import { requireApiUser } from '@/lib/apiAuth'

export async function GET() {
  // 認証確認（未ログインは 401）
  const denied = await requireApiUser()
  if (denied) return denied

  try {
    const data = await db.select({
      id:       tasks.id,
      title:    tasks.title,
      due_date: tasks.due_date,
      priority: tasks.priority,
      done:     tasks.done,
    })
      .from(tasks)
      .orderBy(asc(tasks.done), asc(tasks.due_date))

    const ids = data.map((d) => d.id)
    const [accRows, contRows, oppRows] = await Promise.all([
      ids.length === 0 ? Promise.resolve([]) : db.select({
        host_id: task_related_records.task_id,
        name:    accounts.name,
      })
        .from(task_related_records)
        .innerJoin(accounts, eq(accounts.id, task_related_records.related_record_id))
        .where(and(inArray(task_related_records.task_id, ids), eq(task_related_records.related_object_api, 'account'))),
      ids.length === 0 ? Promise.resolve([]) : db.select({
        host_id: task_related_records.task_id,
        name:    contacts.full_name,
      })
        .from(task_related_records)
        .innerJoin(contacts, eq(contacts.id, task_related_records.related_record_id))
        .where(and(inArray(task_related_records.task_id, ids), eq(task_related_records.related_object_api, 'contact'))),
      ids.length === 0 ? Promise.resolve([]) : db.select({
        host_id: task_related_records.task_id,
        name:    opportunities.name,
      })
        .from(task_related_records)
        .innerJoin(opportunities, eq(opportunities.id, task_related_records.related_record_id))
        .where(and(inArray(task_related_records.task_id, ids), eq(task_related_records.related_object_api, 'opportunity'))),
    ])

    const namesByApi = (rows: Array<{ host_id: string; name: string }>) => {
      const m = new Map<string, string[]>()
      for (const r of rows) {
        if (!m.has(r.host_id)) m.set(r.host_id, [])
        m.get(r.host_id)!.push(r.name)
      }
      return m
    }
    const accNamesById  = namesByApi(accRows)
    const contNamesById = namesByApi(contRows)
    const oppNamesById  = namesByApi(oppRows)

    const PRIORITY_LABEL: Record<string, string> = { high: '高', medium: '中', low: '低' }

    const headers = ['ID', 'タイトル', '期日', '優先度', '完了', '取引先名', '担当者名', '商談名']
    const rows = data.map((r) => [
      r.id,
      r.title,
      r.due_date ?? '',
      PRIORITY_LABEL[r.priority] ?? r.priority,
      r.done ? '完了' : '未完了',
      (accNamesById.get(r.id)  ?? []).join(', '),
      (contNamesById.get(r.id) ?? []).join(', '),
      (oppNamesById.get(r.id)  ?? []).join(', '),
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
