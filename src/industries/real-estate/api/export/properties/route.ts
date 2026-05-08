import { db } from '@/lib/db'
import { accounts, contacts } from '@/lib/schema'
import { properties } from '@/industries/real-estate/schema'
import { eq, desc } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { buildCsv } from '@/lib/csvUtils'

export async function GET() {
  try {
    const data = await db.select({
      id:               properties.id,
      product_category: properties.product_category,
      name:             properties.name,
      property_type:    properties.property_type,
      transaction_type: properties.transaction_type,
      status:           properties.status,
      price:            properties.price,
      accounts:         { name: accounts.name },
      contacts:         { full_name: contacts.full_name },
      // 土地 表題部
      land_fudosan_number: properties.land_fudosan_number,
      address:             properties.address,
      land_chiban:         properties.land_chiban,
      chimoku:             properties.chimoku,
      area:                properties.area,
      land_cause:          properties.land_cause,
      // 土地 甲区
      land_owner_name:           properties.land_owner_name,
      land_owner_address:        properties.land_owner_address,
      land_acquisition_reason:   properties.land_acquisition_reason,
      land_acquisition_date:     properties.land_acquisition_date,
      land_seizure:              properties.land_seizure,
      land_seizure_release_date: properties.land_seizure_release_date,
      // 建物 表題部
      building_fudosan_number:        properties.building_fudosan_number,
      building_location:              properties.building_location,
      building_kaoku_number:          properties.building_kaoku_number,
      building_shurui:                properties.building_shurui,
      structure:                      properties.structure,
      building_floor_area_1f:         properties.building_floor_area_1f,
      building_floor_area_2f:         properties.building_floor_area_2f,
      building_floor_area_3f:         properties.building_floor_area_3f,
      building_new_construction_date: properties.building_new_construction_date,
      // 建物 甲区
      building_owner_name:           properties.building_owner_name,
      building_owner_address:        properties.building_owner_address,
      building_acquisition_reason:   properties.building_acquisition_reason,
      building_acquisition_date:     properties.building_acquisition_date,
      building_seizure:              properties.building_seizure,
      building_seizure_release_date: properties.building_seizure_release_date,
      // 建物 乙区
      building_lien_type:               properties.building_lien_type,
      building_lien_holder:             properties.building_lien_holder,
      building_debt_amount:             properties.building_debt_amount,
      building_damage_rate:             properties.building_damage_rate,
      building_joint_collateral_number: properties.building_joint_collateral_number,
      description: properties.description,
    })
      .from(properties)
      .leftJoin(accounts, eq(properties.account_id, accounts.id))
      .leftJoin(contacts, eq(properties.contact_id, contacts.id))
      .orderBy(desc(properties.created_at))

    const headers = [
      // 基本 (0-8)
      'ID', 'カテゴリ', '件名', '物件種別', '取引種別', 'ステータス', '価格(円)', '取引先名', '担当者名',
      // 土地 表題部 (8-13)
      '土地不動産番号', '土地所在', '地番', '地目', '地積(㎡)', '原因及びその日付',
      // 土地 甲区 (14-19)
      '土地現所有者名', '土地所有者住所', '土地所有権取得原因', '土地所有権取得日', '土地差押有無', '土地直近差押解除日',
      // 建物 表題部 (20-28)
      '建物不動産番号', '建物所在', '家屋番号', '種類', '構造', '床面積1階(㎡)', '床面積2階(㎡)', '床面積3階(㎡)', '新築年月日',
      // 建物 甲区 (29-34)
      '建物現所有者名', '建物所有者住所', '建物所有権取得原因', '建物所有権取得日', '建物差押有無', '建物直近差押解除日',
      // 建物 乙区 (35-39)
      '登記種別', '権利者名', '債権額(円)', '損害金率(%)', '共同担保目録番号',
      // 備考 (40)
      '備考',
    ]

    const bool = (v: boolean | null) => v ? '1' : '0'

    const rows = data.map((r) => [
      r.id,
      r.product_category === 'other' ? 'その他商品' : '不動産',
      r.name,
      r.property_type,
      r.transaction_type,
      r.status,
      r.price             ?? '',
      r.accounts?.name      ?? '',
      r.contacts?.full_name ?? '',
      // 土地 表題部
      r.land_fudosan_number ?? '',
      r.address             ?? '',
      r.land_chiban         ?? '',
      r.chimoku             ?? '',
      r.area                ?? '',
      r.land_cause          ?? '',
      // 土地 甲区
      r.land_owner_name           ?? '',
      r.land_owner_address        ?? '',
      r.land_acquisition_reason   ?? '',
      r.land_acquisition_date     ?? '',
      bool(r.land_seizure),
      r.land_seizure_release_date ?? '',
      // 建物 表題部
      r.building_fudosan_number        ?? '',
      r.building_location              ?? '',
      r.building_kaoku_number          ?? '',
      r.building_shurui                ?? '',
      r.structure                      ?? '',
      r.building_floor_area_1f         ?? '',
      r.building_floor_area_2f         ?? '',
      r.building_floor_area_3f         ?? '',
      r.building_new_construction_date ?? '',
      // 建物 甲区
      r.building_owner_name           ?? '',
      r.building_owner_address        ?? '',
      r.building_acquisition_reason   ?? '',
      r.building_acquisition_date     ?? '',
      bool(r.building_seizure),
      r.building_seizure_release_date ?? '',
      // 建物 乙区
      r.building_lien_type               ?? '',
      r.building_lien_holder             ?? '',
      r.building_debt_amount             ?? '',
      r.building_damage_rate             ?? '',
      r.building_joint_collateral_number ?? '',
      r.description ?? '',
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
