import { db } from '@/lib/db'
import { accounts } from '@/lib/schema'
import { vehicles } from '@/industries/auto-body/schema'
import { alias } from 'drizzle-orm/pg-core'
import { eq, desc } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { buildCsv } from '@/lib/csvUtils'

export async function GET() {
  try {
    const supplier = alias(accounts, 'supplier')
    const buyer    = alias(accounts, 'buyer')
    const data = await db.select({
      id:                   vehicles.id,
      maker:                vehicles.maker,
      model:                vehicles.model,
      year:                 vehicles.year,
      mileage:              vehicles.mileage,
      color:                vehicles.color,
      license_plate:        vehicles.license_plate,
      vin:                  vehicles.vin,
      status:               vehicles.status,
      purchase_date:        vehicles.purchase_date,
      purchase_price:       vehicles.purchase_price,
      sale_price:           vehicles.sale_price,
      sold_date:            vehicles.sold_date,
      sold_price:           vehicles.sold_price,
      next_inspection_date: vehicles.next_inspection_date,
      description:          vehicles.description,
      created_at:           vehicles.created_at,
      supplier:             { name: supplier.name },
      buyer:                { name: buyer.name },
    })
      .from(vehicles)
      .leftJoin(supplier, eq(vehicles.supplier_account_id, supplier.id))
      .leftJoin(buyer,    eq(vehicles.buyer_account_id,    buyer.id))
      .orderBy(desc(vehicles.created_at))

    const headers = [
      'ID', 'メーカー', '車種', '年式', '走行距離(km)', '色', 'ナンバー', '車台番号', '状態',
      '仕入日', '仕入価格', '仕入元',
      '希望売価', '売却日', '売却価格', '売却先',
      '次回車検期日', '備考', '登録日',
    ]
    const rows = data.map((r) => [
      r.id,
      r.maker,
      r.model,
      r.year ?? '',
      r.mileage ?? '',
      r.color ?? '',
      r.license_plate ?? '',
      r.vin ?? '',
      r.status,
      r.purchase_date ? new Date(r.purchase_date).toLocaleDateString('ja-JP') : '',
      r.purchase_price ?? '',
      r.supplier?.name ?? '',
      r.sale_price ?? '',
      r.sold_date ? new Date(r.sold_date).toLocaleDateString('ja-JP') : '',
      r.sold_price ?? '',
      r.buyer?.name ?? '',
      r.next_inspection_date ? new Date(r.next_inspection_date).toLocaleDateString('ja-JP') : '',
      r.description ?? '',
      r.created_at ? new Date(r.created_at).toLocaleDateString('ja-JP') : '',
    ])

    return new NextResponse(buildCsv(headers, rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="vehicles.csv"',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
