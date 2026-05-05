import { db } from '@/lib/db'
import { properties, accounts, contacts } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { parseCsvWithHeaders } from '@/lib/csvUtils'

function safeNumStr(v: string | undefined): string | null {
  const s = v?.trim()
  if (!s) return null
  const n = Number(s)
  return isFinite(n) ? String(n) : null
}

function safeNum(v: string | undefined): number | null {
  const s = v?.trim()
  if (!s) return null
  const n = Number(s)
  return isFinite(n) ? n : null
}

function safeBool(v: string | undefined): boolean | undefined {
  if (v === undefined || v.trim() === '') return undefined
  return v.trim() === '1' || v.trim().toLowerCase() === 'true'
}

function safeDate(v: string | undefined): string | null {
  const s = v?.trim()
  return s || null
}

export async function POST(req: NextRequest) {
  const formData  = await req.formData()
  const file      = formData.get('file') as File | null
  const textInput = formData.get('text') as string | null
  const ctxAccountId = formData.get('account_id') as string | null

  let text: string
  if (file) {
    text = await file.text()
  } else if (textInput) {
    text = textInput
  } else {
    return NextResponse.json({ error: 'ファイルまたはテキストが必要です' }, { status: 400 })
  }

  const rows = parseCsvWithHeaders(text)
  if (rows.length === 0) return NextResponse.json({ error: 'データがありません' }, { status: 400 })

  const [accountsData, contactsData] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name      }).from(accounts),
    db.select({ id: contacts.id, name: contacts.full_name }).from(contacts),
  ])
  const accountMap = new Map(accountsData.map((a) => [a.name, a.id]))
  const contactMap = new Map(contactsData.map((c) => [c.name, c.id]))

  let inserted = 0
  let updated  = 0
  const errors: string[] = []

  for (const row of rows) {
    const id   = row['ID']?.trim()
    const name = row['件名']?.trim()
    if (!id && !name) continue

    const rawCat     = row['カテゴリ']?.trim() ?? ''
    const isRE       = rawCat !== 'その他商品' && rawCat !== 'other'
    const accountName = row['取引先名']?.trim()
    const contactName = row['担当者名']?.trim()

    const record = {
      name:             name || undefined,
      product_category: rawCat ? (isRE ? 'real_estate' : 'other') : undefined,
      property_type:    row['物件種別']?.trim() || undefined,
      transaction_type: row['取引種別']?.trim() || undefined,
      status:           row['ステータス']?.trim() || undefined,
      price:            safeNumStr(row['価格(円)']),
      account_id:       accountName ? (accountMap.get(accountName) ?? null) : (ctxAccountId ?? null),
      contact_id:       contactName ? (contactMap.get(contactName) ?? null) : null,
      // 土地 表題部
      land_fudosan_number: row['土地不動産番号']?.trim() || null,
      address:             row['土地所在']?.trim() || null,
      land_chiban:         row['地番']?.trim() || null,
      chimoku:             row['地目']?.trim() || null,
      area:                safeNumStr(row['地積(㎡)']),
      land_cause:          row['原因及びその日付']?.trim() || null,
      // 土地 甲区
      land_owner_name:           row['土地現所有者名']?.trim() || null,
      land_owner_address:        row['土地所有者住所']?.trim() || null,
      land_acquisition_reason:   row['土地所有権取得原因']?.trim() || null,
      land_acquisition_date:     safeDate(row['土地所有権取得日']),
      land_seizure:              safeBool(row['土地差押有無']),
      land_seizure_release_date: safeDate(row['土地直近差押解除日']),
      // 建物 表題部
      building_fudosan_number:        row['建物不動産番号']?.trim() || null,
      building_location:              row['建物所在']?.trim() || null,
      building_kaoku_number:          row['家屋番号']?.trim() || null,
      building_shurui:                row['種類']?.trim() || null,
      structure:                      row['構造']?.trim() || null,
      building_floor_area_1f:         safeNumStr(row['床面積1階(㎡)']),
      building_floor_area_2f:         safeNumStr(row['床面積2階(㎡)']),
      building_floor_area_3f:         safeNumStr(row['床面積3階(㎡)']),
      building_new_construction_date: safeDate(row['新築年月日']),
      // 建物 甲区
      building_owner_name:           row['建物現所有者名']?.trim() || null,
      building_owner_address:        row['建物所有者住所']?.trim() || null,
      building_acquisition_reason:   row['建物所有権取得原因']?.trim() || null,
      building_acquisition_date:     safeDate(row['建物所有権取得日']),
      building_seizure:              safeBool(row['建物差押有無']),
      building_seizure_release_date: safeDate(row['建物直近差押解除日']),
      // 建物 乙区
      building_lien_type:               row['登記種別']?.trim() || null,
      building_lien_holder:             row['権利者名']?.trim() || null,
      building_debt_amount:             safeNum(row['債権額(円)']),
      building_damage_rate:             safeNumStr(row['損害金率(%)']),
      building_joint_collateral_number: row['共同担保目録番号']?.trim() || null,
      description:                      row['備考']?.trim() || null,
    }

    try {
      if (id) {
        const { name: _n, product_category: _pc, property_type: _pt, transaction_type: _tt, status: _s, ...rest } = record
        await db.update(properties)
          .set({
            ...rest,
            ...(record.name             ? { name: record.name }                         : {}),
            ...(record.product_category ? { product_category: record.product_category } : {}),
            ...(record.property_type    ? { property_type: record.property_type }       : {}),
            ...(record.transaction_type ? { transaction_type: record.transaction_type } : {}),
            ...(record.status           ? { status: record.status }                     : {}),
          })
          .where(eq(properties.id, id))
        updated++
      } else {
        if (!record.name) { errors.push('件名が空の行をスキップしました'); continue }
        await db.insert(properties).values({
          ...record,
          name:             record.name,
          product_category: record.product_category ?? 'real_estate',
          property_type:    record.property_type    ?? '土地・建物',
          transaction_type: record.transaction_type ?? '売買',
          status:           record.status           ?? '募集中',
          land_seizure:     record.land_seizure     ?? false,
          building_seizure: record.building_seizure ?? false,
        })
        inserted++
      }
    } catch (e) {
      errors.push((e as Error).message)
    }
  }

  return NextResponse.json({ imported: inserted, updated, errors })
}
