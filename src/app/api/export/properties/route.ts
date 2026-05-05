import { db } from '@/lib/db'
import { properties, accounts, contacts } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { buildCsv } from '@/lib/csvUtils'

export async function GET() {
  try {
    const data = await db.select({
      product_category: properties.product_category,
      name:             properties.name,
      property_type:    properties.property_type,
      transaction_type: properties.transaction_type,
      status:           properties.status,
      address:          properties.address,
      area:             properties.area,
      price:            properties.price,
      floor:            properties.floor,
      total_floors:     properties.total_floors,
      built_year:       properties.built_year,
      chimoku:               properties.chimoku,
      land_chiban:           properties.land_chiban,
      rights_status:         properties.rights_status,
      structure:             properties.structure,
      building_kaoku_number: properties.building_kaoku_number,
      building_shurui:       properties.building_shurui,
      building_floor_area:   properties.building_floor_area,
      description:           properties.description,
      accounts:         { name: accounts.name },
      contacts:         { full_name: contacts.full_name },
    })
      .from(properties)
      .leftJoin(accounts, eq(properties.account_id, accounts.id))
      .leftJoin(contacts, eq(properties.contact_id, contacts.id))
      .orderBy(desc(properties.created_at))

    const headers = [
      'カテゴリ', '件名', '物件種別', '取引種別', 'ステータス',
      '所在地', '面積(㎡)', '価格(円)', '所在階', '総階数', '築年',
      '取引先名', '担当者名',
      '地目', '地番', '権利状況',
      '構造', '家屋番号', '建物種類', '床面積(㎡)',
      '備考',
    ]
    const rows = data.map((r) => [
      r.product_category === 'other' ? 'その他商品' : '不動産',
      r.name,
      r.property_type,
      r.transaction_type,
      r.status,
      r.address        ?? '',
      r.area           ?? '',
      r.price          ?? '',
      r.floor          ?? '',
      r.total_floors   ?? '',
      r.built_year     ?? '',
      r.accounts?.name      ?? '',
      r.contacts?.full_name ?? '',
      r.chimoku              ?? '',
      r.land_chiban          ?? '',
      r.rights_status        ?? '',
      r.structure            ?? '',
      r.building_kaoku_number ?? '',
      r.building_shurui       ?? '',
      r.building_floor_area   ?? '',
      r.description    ?? '',
    ])

    return new NextResponse(buildCsv(headers, rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="properties.csv"',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
