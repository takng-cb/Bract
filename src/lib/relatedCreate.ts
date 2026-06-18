/**
 * 関連先の「新規作成」共通ヘルパ（REQ-0085 / ADR-0030）。
 * AI作成（quickAi）と詳細ページの関連先 Picker（フォーム送信）の双方から使う。
 *
 * - createBareRelated: 取引先/人物/商談/プロジェクトを名前だけで作成（作成権限ガード付き）
 * - resolveRelatedFormValues: フォーム値 "api:id"（既存）/ "new:api:name"（新規）を
 *   junction 紐付け用の {object_api, record_id}[] に解決（new は作成して materialize）
 */
import 'server-only'
import { db } from '@/lib/db'
import { accounts, contacts, opportunities, projects } from '@/lib/schema'
import { getCurrentUserId } from '@/lib/auth'
import { canDo } from '@/lib/permissions'
import { isModuleEnabled } from '@/lib/modules/registry'
import { revalidatePath } from 'next/cache'
import { NEW_RELATED_TYPES } from '@/lib/quickAiTypes'

export type RelatedPairLite = { object_api: string; record_id: string }

/** 名前だけで関連レコードを作成（取引先/人物/商談/プロジェクト）。作成権限が無ければ null。 */
export async function createBareRelated(objectApi: string, name: string): Promise<RelatedPairLite | null> {
  const t = NEW_RELATED_TYPES.find((x) => x.object_api === objectApi)
  const nm = (name ?? '').trim().slice(0, 200)
  if (!t || !nm) return null
  if (!(await canDo(t.book, 'create'))) return null
  const owner_id = (await getCurrentUserId()) ?? null
  switch (objectApi) {
    case 'account': {
      const [r] = await db.insert(accounts).values({ name: nm, owner_id }).returning({ id: accounts.id })
      revalidatePath('/accounts'); return { object_api: 'account', record_id: r.id }
    }
    case 'contact': {
      const [r] = await db.insert(contacts).values({ full_name: nm, owner_id }).returning({ id: contacts.id })
      revalidatePath('/contacts'); return { object_api: 'contact', record_id: r.id }
    }
    case 'opportunity': {
      const [r] = await db.insert(opportunities).values({ name: nm, owner_id }).returning({ id: opportunities.id })
      revalidatePath('/opportunities'); return { object_api: 'opportunity', record_id: r.id }
    }
    case 'project': {
      if (!(await isModuleEnabled('projects'))) return null
      const [r] = await db.insert(projects).values({ name: nm, owner_id }).returning({ id: projects.id })
      revalidatePath('/projects'); return { object_api: 'project', record_id: r.id }
    }
    default: return null
  }
}

/**
 * 関連先フォーム値の配列を解決。
 *   "<api>:<id>"      → 既存参照
 *   "new:<api>:<name>" → 新規作成して参照（materialize）
 * 名前に ':' を含んでも壊れないよう、先頭区切りのみで分割する。
 */
export async function resolveRelatedFormValues(rawValues: string[]): Promise<RelatedPairLite[]> {
  const out: RelatedPairLite[] = []
  for (const raw of rawValues ?? []) {
    const v = (raw ?? '').trim()
    if (!v) continue
    if (v.startsWith('new:')) {
      const rest = v.slice(4)
      const sep = rest.indexOf(':')
      if (sep < 0) continue
      const created = await createBareRelated(rest.slice(0, sep).trim(), rest.slice(sep + 1))
      if (created) out.push(created)
    } else {
      const sep = v.indexOf(':')
      if (sep < 0) continue
      const api = v.slice(0, sep).trim(), id = v.slice(sep + 1).trim()
      if (api && id) out.push({ object_api: api, record_id: id })
    }
  }
  return out
}
