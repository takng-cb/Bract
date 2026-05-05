import { db } from '@/lib/db'
import { properties, accounts, contacts } from '@/lib/schema'
import { NextRequest, NextResponse } from 'next/server'
import { parseCsv } from '@/lib/csvUtils'

function safeNum(v: string | undefined): number | null {
  const s = v?.trim()
  if (!s) return null
  const n = Number(s)
  return isFinite(n) ? n : null
}

function safeNumStr(v: string | undefined): string | null {
  const n = safeNum(v)
  return n !== null ? String(n) : null
}

function safeBool(v: string | undefined): boolean {
  return v?.trim() === '1' || v?.trim().toLowerCase() === 'true'
}

function safeDate(v: string | undefined): string | null {
  const s = v?.trim()
  return s || null
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 })

  const text = await file.text()
  const rows = parseCsv(text)
  if (rows.length < 2) return NextResponse.json({ error: 'データがありません' }, { status: 400 })

  const [accountsData, contactsData] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name      }).from(accounts),
    db.select({ id: contacts.id, name: contacts.full_name }).from(contacts),
  ])
  const accountMap = new Map(accountsData.map((a) => [a.name, a.id]))
  const contactMap = new Map(contactsData.map((c) => [c.name, c.id]))

  // ヘッダ列番号:
  // 基本: カテゴリ(0), 件名(1), 物件種別(2), 取引種別(3), ステータス(4), 価格(5), 取引先名(6), 担当者名(7)
  // 土地表題部: 土地不動産番号(8), 土地所在(9), 地番(10), 地目(11), 地積(12), 原因及びその日付(13)
  // 土地甲区: 土地現所有者名(14), 土地所有者住所(15), 土地所有権取得原因(16), 土地所有権取得日(17), 土地差押有無(18), 土地直近差押解除日(19)
  // 建物表題部: 建物不動産番号(20), 建物所在(21), 家屋番号(22), 種類(23), 構造(24), 床面積1階(25), 床面積2階(26), 床面積3階(27), 新築年月日(28)
  // 建物甲区: 建物現所有者名(29), 建物所有者住所(30), 建物所有権取得原因(31), 建物所有権取得日(32), 建物差押有無(33), 建物直近差押解除日(34)
  // 建物乙区: 登記種別(35), 権利者名(36), 債権額(37), 損害金率(38), 共同担保目録番号(39)
  // 備考(40)

  const dataRows = rows.slice(1)
  const records = dataRows.flatMap((cols) => {
    const name = cols[1]?.trim()
    if (!name) return []
    const rawCat = cols[0]?.trim() ?? ''
    const isRE   = rawCat !== 'その他商品' && rawCat !== 'other'

    return [{
      product_category: isRE ? 'real_estate' : 'other',
      name,
      property_type:    cols[2]?.trim() || (isRE ? '土地・建物' : 'その他'),
      transaction_type: cols[3]?.trim() || (isRE ? '売買' : 'その他'),
      status:           cols[4]?.trim() || (isRE ? '募集中' : '提案中'),
      price:            safeNumStr(cols[5]),
      account_id:       cols[6]?.trim() ? (accountMap.get(cols[6].trim()) ?? null) : null,
      contact_id:       cols[7]?.trim() ? (contactMap.get(cols[7].trim()) ?? null) : null,
      // 土地 表題部
      land_fudosan_number: isRE ? (cols[8]?.trim()  || null) : null,
      address:             isRE ? (cols[9]?.trim()  || null) : null,
      land_chiban:         isRE ? (cols[10]?.trim() || null) : null,
      chimoku:             isRE ? (cols[11]?.trim() || null) : null,
      area:                isRE ? safeNumStr(cols[12]) : null,
      land_cause:          isRE ? (cols[13]?.trim() || null) : null,
      // 土地 甲区
      land_owner_name:           isRE ? (cols[14]?.trim() || null) : null,
      land_owner_address:        isRE ? (cols[15]?.trim() || null) : null,
      land_acquisition_reason:   isRE ? (cols[16]?.trim() || null) : null,
      land_acquisition_date:     isRE ? safeDate(cols[17]) : null,
      land_seizure:              isRE ? safeBool(cols[18]) : false,
      land_seizure_release_date: isRE ? safeDate(cols[19]) : null,
      // 建物 表題部
      building_fudosan_number:        isRE ? (cols[20]?.trim() || null) : null,
      building_location:              isRE ? (cols[21]?.trim() || null) : null,
      building_kaoku_number:          isRE ? (cols[22]?.trim() || null) : null,
      building_shurui:                isRE ? (cols[23]?.trim() || null) : null,
      structure:                      isRE ? (cols[24]?.trim() || null) : null,
      building_floor_area_1f:         isRE ? safeNumStr(cols[25]) : null,
      building_floor_area_2f:         isRE ? safeNumStr(cols[26]) : null,
      building_floor_area_3f:         isRE ? safeNumStr(cols[27]) : null,
      building_new_construction_date: isRE ? safeDate(cols[28]) : null,
      // 建物 甲区
      building_owner_name:           isRE ? (cols[29]?.trim() || null) : null,
      building_owner_address:        isRE ? (cols[30]?.trim() || null) : null,
      building_acquisition_reason:   isRE ? (cols[31]?.trim() || null) : null,
      building_acquisition_date:     isRE ? safeDate(cols[32]) : null,
      building_seizure:              isRE ? safeBool(cols[33]) : false,
      building_seizure_release_date: isRE ? safeDate(cols[34]) : null,
      // 建物 乙区
      building_lien_type:               isRE ? (cols[35]?.trim() || null) : null,
      building_lien_holder:             isRE ? (cols[36]?.trim() || null) : null,
      building_debt_amount:             isRE ? safeNum(cols[37]) : null,
      building_damage_rate:             isRE ? safeNumStr(cols[38]) : null,
      building_joint_collateral_number: isRE ? (cols[39]?.trim() || null) : null,
      description: cols[40]?.trim() || null,
    }]
  })

  if (records.length === 0) {
    return NextResponse.json({ error: '有効なデータ行がありません（件名が必須）' }, { status: 400 })
  }

  try {
    await db.insert(properties).values(records)
    return NextResponse.json({ imported: records.length })
  } catch (e) {
    const msg = (e as Error).message ?? ''
    if (msg.includes('invalid input syntax for type numeric')) {
      return NextResponse.json(
        { error: '数値列（地積・価格・床面積・損害金率）に数値以外の値が含まれています。CSVを確認してください。' },
        { status: 400 },
      )
    }
    if (msg.includes('violates foreign key constraint')) {
      return NextResponse.json(
        { error: '関連レコードが見つかりません。取引先名・担当者名がCRM上の名前と一致しているか確認してください。' },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: `インポートに失敗しました: ${msg}` }, { status: 500 })
  }
}
