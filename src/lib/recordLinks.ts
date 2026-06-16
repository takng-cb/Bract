/**
 * record_links（任意レコード↔任意レコードの汎用双方向リンク。REQ-0078）の
 * サーバ側ヘルパ。双方向は `<object_api>:<id>` 昇順で 1 行に正規化して扱う。
 * ラベル/href/アイコン解決は既存の resolveRelatedRecords を再利用する。
 */
import { db } from '@/lib/db'
import { record_links } from '@/lib/schema'
import { and, eq, or, desc } from 'drizzle-orm'
import { resolveRelatedRecords, type ResolvedRecord } from '@/lib/relatedRecords'

export type LinkEnd = { object_api: string; record_id: string }

const keyOf = (api: string, id: string) => `${api}:${id}`

/** (x, y) を a <= b になるよう正規化（`api:id` 文字列の辞書順）。 */
export function normalizePair(x: LinkEnd, y: LinkEnd): {
  a_object_api: string; a_record_id: string; b_object_api: string; b_record_id: string
} {
  const xy = keyOf(x.object_api, x.record_id)
  const yx = keyOf(y.object_api, y.record_id)
  const [a, b] = xy <= yx ? [x, y] : [y, x]
  return {
    a_object_api: a.object_api, a_record_id: a.record_id,
    b_object_api: b.object_api, b_record_id: b.record_id,
  }
}

/** RBAC 判定に使う book_api（object_api → ブック api 名）。search/records と同語彙。 */
export function bookForObjectApi(objectApi: string): string {
  switch (objectApi) {
    case 'account':          return 'accounts'
    case 'contact':          return 'contacts'
    case 'opportunity':      return 'opportunities'
    case 'vehicle':          return 'vehicles'
    case 'maintenance':      return 'maintenance_records'
    case 'customer-vehicle': return 'customer_vehicles'
    default:                 return objectApi // カスタムブックは api_name そのもの
  }
}

/**
 * self（object_api, record_id）に紐づく相手側レコードを表示用に解決して返す。
 * 双方向のため a 側・b 側どちらに self が居ても拾い、相手側だけを返す。
 * 並びは作成日時の降順（新しい関連が上）。
 */
export async function getRecordLinks(self: LinkEnd): Promise<ResolvedRecord[]> {
  const rows = await db
    .select()
    .from(record_links)
    .where(or(
      and(eq(record_links.a_object_api, self.object_api), eq(record_links.a_record_id, self.record_id)),
      and(eq(record_links.b_object_api, self.object_api), eq(record_links.b_record_id, self.record_id)),
    ))
    .orderBy(desc(record_links.created_at))

  const selfKey = keyOf(self.object_api, self.record_id)
  const pairs = rows.map((r) => {
    // self でない側を相手として返す
    const aKey = keyOf(r.a_object_api, r.a_record_id)
    return aKey === selfKey
      ? { object_api: r.b_object_api, record_id: r.b_record_id }
      : { object_api: r.a_object_api, record_id: r.a_record_id }
  })

  return resolveRelatedRecords(pairs)
}

/**
 * 親レコード削除時の掃除。self を a 側・b 側どちらかに含むリンク行を全削除。
 * accounts/contacts/opportunities/book_records/vehicles 等の delete 時に呼ぶ。
 */
export async function cleanupRecordLinksForParent(objectApi: string, recordId: string): Promise<void> {
  await db.delete(record_links).where(or(
    and(eq(record_links.a_object_api, objectApi), eq(record_links.a_record_id, recordId)),
    and(eq(record_links.b_object_api, objectApi), eq(record_links.b_record_id, recordId)),
  ))
}
