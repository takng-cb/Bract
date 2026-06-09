/**
 * Products CSV export — inventory モジュール (Issue #48)
 * 列: ID,SKU,商品名,カテゴリ,単位,売価,原価,発注しきい値,備考
 */
import { db } from '@/lib/db'
import { products } from '@/lib/schema'
import { asc } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { buildCsv } from '@/lib/csvUtils'

export async function GET() {
  try {
    const data = await db.select({
      id:            products.id,
      sku:           products.sku,
      name:          products.name,
      category:      products.category,
      unit:          products.unit,
      unit_price:    products.unit_price,
      cost_price:    products.cost_price,
      reorder_level: products.reorder_level,
      description:   products.description,
    }).from(products).orderBy(asc(products.sku))

    const headers = ['ID', 'SKU', '商品名', 'カテゴリ', '単位', '売価', '原価', '発注しきい値', '備考']
    const rows = data.map((r) => [
      r.id,
      r.sku,
      r.name,
      r.category ?? '',
      r.unit ?? '',
      r.unit_price ?? '',
      r.cost_price ?? '',
      r.reorder_level ?? 0,
      r.description ?? '',
    ])

    return new NextResponse(buildCsv(headers, rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="products.csv"',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
