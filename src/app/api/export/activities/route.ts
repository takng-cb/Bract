import { db } from '@/lib/db'
import { activities, accounts, contacts, opportunities, activity_related_records } from '@/lib/schema'
import { eq, desc, inArray, and } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { buildCsv } from '@/lib/csvUtils'

export async function GET() {
  try {
    // 全活動を取得（FK 列に依存しない）
    const data = await db.select({
      id:          activities.id,
      occurred_at: activities.occurred_at,
      type:        activities.type,
      subject:     activities.subject,
      body:        activities.body,
    })
      .from(activities)
      .orderBy(desc(activities.occurred_at))

    // junction 経由で関連レコード名を bulk fetch
    const ids = data.map((d) => d.id)
    const [accRows, contRows, oppRows] = await Promise.all([
      ids.length === 0 ? Promise.resolve([]) : db.select({
        host_id: activity_related_records.activity_id,
        name:    accounts.name,
      })
        .from(activity_related_records)
        .innerJoin(accounts, eq(accounts.id, activity_related_records.related_record_id))
        .where(and(inArray(activity_related_records.activity_id, ids), eq(activity_related_records.related_object_api, 'account'))),
      ids.length === 0 ? Promise.resolve([]) : db.select({
        host_id: activity_related_records.activity_id,
        name:    contacts.full_name,
      })
        .from(activity_related_records)
        .innerJoin(contacts, eq(contacts.id, activity_related_records.related_record_id))
        .where(and(inArray(activity_related_records.activity_id, ids), eq(activity_related_records.related_object_api, 'contact'))),
      ids.length === 0 ? Promise.resolve([]) : db.select({
        host_id: activity_related_records.activity_id,
        name:    opportunities.name,
      })
        .from(activity_related_records)
        .innerJoin(opportunities, eq(opportunities.id, activity_related_records.related_record_id))
        .where(and(inArray(activity_related_records.activity_id, ids), eq(activity_related_records.related_object_api, 'opportunity'))),
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

    const headers = ['ID', '実施日時', '種別', '件名', '内容', '取引先名', '担当者名', '商談名']
    const rows = data.map((r) => [
      r.id,
      r.occurred_at ? new Date(r.occurred_at).toLocaleString('ja-JP') : '',
      r.type,
      r.subject,
      r.body ?? '',
      (accNamesById.get(r.id)  ?? []).join(', '),
      (contNamesById.get(r.id) ?? []).join(', '),
      (oppNamesById.get(r.id)  ?? []).join(', '),
    ])

    return new NextResponse(buildCsv(headers, rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="activities.csv"',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
