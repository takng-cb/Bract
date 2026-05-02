import { db } from '@/lib/db'
import { activities, accounts, contacts, opportunities } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { buildCsv } from '@/lib/csvUtils'

export async function GET() {
  try {
    const data = await db.select({
      occurred_at:   activities.occurred_at,
      type:          activities.type,
      subject:       activities.subject,
      body:          activities.body,
      accounts:      { name: accounts.name },
      contacts:      { full_name: contacts.full_name },
      opportunities: { name: opportunities.name },
    })
      .from(activities)
      .leftJoin(accounts,      eq(activities.account_id,     accounts.id))
      .leftJoin(contacts,      eq(activities.contact_id,     contacts.id))
      .leftJoin(opportunities, eq(activities.opportunity_id, opportunities.id))
      .orderBy(desc(activities.occurred_at))

    const headers = ['実施日時', '種別', '件名', '内容', '取引先名', '担当者名', '商談名']
    const rows = data.map((r) => [
      r.occurred_at ? new Date(r.occurred_at).toLocaleString('ja-JP') : '',
      r.type,
      r.subject,
      r.body ?? '',
      r.accounts?.name      ?? '',
      r.contacts?.full_name ?? '',
      r.opportunities?.name ?? '',
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
